import {
  Type,
  Variable,
  Primitive,
  FunctionType,
  isBaseType,
  isTypeVariable,
  isFunctionType
} from '../types'
import { printType } from '../utils/inferencerUtils'
import { currentTypeEnvironment } from './inferencer'

export const constraintStore = new Map()

export function updateTypeConstraints(newConstraintLhs: Type, newConstraintRhs: Type) {
  console.log('constraintStore.updateTypeConstraints:')

  // Note: If no error, returns undefined (i.e. nothing), else return error obj for logging
  const errorObj = solveConstraint(newConstraintLhs, newConstraintRhs)

  if (!errorObj) {
    // Update Type Env where applicable
    // Iterate through all Type Envs and replace any TVar with their value from the constraintStore, if available
    for (const val of currentTypeEnvironment.values()) {
      const typesArray = val.types // Todo: Consider refactor later
      for (let i = 0; i < typesArray.length; i++) {
        const type = typesArray[i]

        if (isTypeVariable(type)) {
          typesArray[i] = getUpdatedTypeVariable(type)
        } else if (isFunctionType(type)) {
          for (let j = 0; j < type.parameterTypes.length; j++) {
            type.parameterTypes[j] = getUpdatedTypeVariable(type.parameterTypes[j])
          }
          type.returnType = getUpdatedTypeVariable(type.returnType)
        }
      }
    }
  }

  console.log('')
  return errorObj
}

function getUpdatedTypeVariable(typeVariable: Type) {
  if (isTypeVariable(typeVariable) && constraintStore.get(typeVariable)) {
    return constraintStore.get(typeVariable)
  } else {
    return typeVariable
  }
}

function solveConstraint(constraintLhs: Type, constraintRhs: Type): any | undefined {
  // temp logging for debug
  const toPrint = `> Trying to add: ${printType(constraintLhs)} = ${printType(constraintRhs)}`
  console.log(toPrint)
  // logging - end

  // check if both sides are base types and of the same kind (Rule 1)
  if (
    isBaseType(constraintLhs) &&
    isBaseType(constraintRhs) &&
    (constraintLhs as Primitive).name === (constraintRhs as Primitive).name
  ) {
    // do nothing
    return
  }
  // check if lhs is not a type variable and rhs is a type variable (Rule 2)
  else if (!isTypeVariable(constraintLhs) && isTypeVariable(constraintRhs)) {
    return solveConstraint(constraintRhs, constraintLhs)
  }
  // check if both sides are type variables and they have the same name (Rule 3)
  else if (
    (isTypeVariable(constraintLhs) &&
      ifConstraintStoreHas(constraintRhs) &&
      isTypeVariable(constraintStore.get(constraintRhs)) &&
      (constraintStore.get(constraintRhs) as Variable).id === (constraintLhs as Variable).id) ||
    (isTypeVariable(constraintLhs) &&
      isTypeVariable(constraintRhs) &&
      (constraintLhs as Variable).id === (constraintRhs as Variable).id)
  ) {
    // do nothing
    return
  }
  // Rule 4
  else if (
    isTypeVariable(constraintLhs) &&
    ifConstraintStoreHas(constraintRhs) &&
    isFunctionType(constraintStore.get(constraintRhs)) &&
    (ifFunctionContains(constraintStore.get(constraintRhs) as FunctionType, constraintLhs) ||
      ((constraintStore.get(constraintRhs) as FunctionType).returnType as Variable).id ===
        (constraintLhs as Variable).id)
  ) {
    console.log('[debug] Error in Rule 4!')
    return { constraintLhs, constraintRhs } // for error logging
  }
  // Rule 5
  else if (
    (constraintLhs as Variable).isAddable &&
    ifConstraintStoreHas(constraintRhs) &&
    !isTypeVariable(constraintStore.get(constraintRhs)) &&
    (constraintStore.get(constraintRhs) as Primitive).name !== 'number' &&
    (constraintStore.get(constraintRhs) as Primitive).name !== 'string'
  ) {
    console.log('[debug] Error in Rule 5')
    return { constraintLhs, constraintRhs } // for error logging
  }
  // Rule 5 (b) - if constraintStore does not contain constraintRhs, we try to use constraintRhs as the condition. E.g. when adding A13 = boolean
  else if (
    (constraintLhs as Variable).isAddable &&
    // ifConstraintStoreHas(constraintRhs) &&
    !isTypeVariable(constraintRhs) &&
    (constraintRhs as Primitive).name !== 'number' &&
    (constraintRhs as Primitive).name !== 'string'
  ) {
    console.log('[debug] Error in Rule 5(b)')
    return { constraintLhs, constraintRhs } // for error logging
  }
  // Rule 6
  else if (isTypeVariable(constraintLhs) && ifConstraintStoreHas(constraintLhs)) {
    return solveConstraint(constraintRhs, constraintStore.get(constraintLhs))
  }
  // Rule 7
  else if (
    isTypeVariable(constraintLhs) &&
    !ifConstraintStoreHas(constraintLhs) &&
    ifConstraintStoreHas(constraintRhs)
  ) {
    if (
      (constraintLhs as Variable).isAddable &&
      isTypeVariable(constraintStore.get(constraintRhs)) &&
      !constraintStore.get(constraintRhs).isAddable
    ) {
      ;(constraintStore.get(constraintRhs) as Variable).isAddable = true
    }
    return solveConstraint(constraintLhs, constraintStore.get(constraintRhs))
  }
  // Rule 7B
  else if (
    isTypeVariable(constraintLhs) &&
    (constraintLhs as Variable).isAddable &&
    isTypeVariable(constraintRhs) &&
    !(constraintRhs as Variable).isAddable
  ) {
    // Convert (all occurrences of) Σ(t′) into an addable type
    constraintStore.forEach((value: Type, key: Type) => {
      if (isTypeVariable(key) && (key as Variable).id === (constraintRhs as Variable).id) {
        ;(key as Variable).isAddable = true
      }
      if (isTypeVariable(value) && (value as Variable).id === (constraintRhs as Variable).id) {
        ;(value as Variable).isAddable = true
      }
    })
  }
  // Rule 8
  else if (
    isFunctionType(constraintLhs) &&
    ifConstraintStoreHas(constraintRhs) &&
    isFunctionType(constraintStore.get(constraintRhs)) &&
    (constraintLhs as FunctionType).parameterTypes.length ===
      (constraintStore.get(constraintRhs) as FunctionType).parameterTypes.length
  ) {
    addNConstraint(constraintLhs as FunctionType, constraintStore.get(constraintRhs))
  }
  // check for mismatch base types (Rule 9)
  else if (
    (isBaseType(constraintLhs) &&
      isBaseType(constraintRhs) &&
      (constraintLhs as Primitive).name !== (constraintRhs as Primitive).name) ||
    (isFunctionType(constraintLhs) && isBaseType(constraintRhs)) ||
    (isBaseType(constraintLhs) && isFunctionType(constraintRhs))
  ) {
    console.log('[debug] Error in Rule 9')
    return { constraintLhs, constraintRhs } // for error logging
  } else {
    constraintStore.set(constraintLhs, constraintRhs)
    return
  }
}

function ifConstraintStoreHas(constraint: Type) {
  return constraintStore.get(constraint) !== undefined
}

function ifFunctionContains(constraintLhs: FunctionType, constraintRhs: Type) {
  for (const parameter of constraintLhs.parameterTypes) {
    if ((parameter as Variable).id === (constraintRhs as Variable).id) return true
  }
  return false
}

function addNConstraint(constraintLhs: FunctionType, constraintRhs: FunctionType) {
  for (let index = 0; index < constraintLhs.parameterTypes.length; index++) {
    solveConstraint(constraintLhs.parameterTypes[index], constraintRhs.parameterTypes[index])
  }
  solveConstraint(constraintLhs.returnType, constraintRhs.returnType)
}
