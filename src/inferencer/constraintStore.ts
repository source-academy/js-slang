import {
  Type,
  Variable,
  Primitive,
  FunctionType,
  isBaseType,
  isTypeVariable,
  isFunctionType
} from '../types'

export const constraintStore = new Map()

export function updateTypeConstraints(newConstraintLhs: Type, newConstraintRhs: Type) {
  console.log('constraintStore.updateTypeConstraints:')

  // Note: If no error, returns undefined (i.e. nothing), else return error obj for logging
  return solveConstraint(newConstraintLhs, newConstraintRhs)
}

function solveConstraint(constraintLhs: Type, constraintRhs: Type): any | undefined {
  // temp logging for debug
  let toPrint = '> Trying to add: '
  if (constraintLhs === null) toPrint += 'null'
  else if (constraintLhs.kind === 'variable')
    toPrint += (constraintLhs.isAddable ? 'A' : 'T') + constraintLhs.id
  else if (constraintLhs.kind === 'primitive') toPrint += constraintLhs.name
  toPrint += ' = '
  if (constraintRhs === null) toPrint += 'null'
  else if (constraintRhs.kind === 'variable')
    toPrint += (constraintRhs.isAddable ? 'A' : 'T') + constraintRhs.id
  else if (constraintRhs.kind === 'primitive') toPrint += constraintRhs.name
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
    isTypeVariable(constraintLhs) &&
    constraintStore.get(constraintRhs) !== undefined &&
    isTypeVariable(constraintStore.get(constraintRhs)) &&
    (constraintStore.get(constraintRhs) as Variable).id === (constraintLhs as Variable).id
  ) {
    // do nothing
    return
  }
  // Rule 4
  else if (
    (isTypeVariable(constraintLhs) &&
      constraintStore.get(constraintRhs) !== undefined &&
      isFunctionType(constraintStore.get(constraintRhs)) &&
      (constraintStore.get(constraintRhs) as FunctionType).parameterTypes.includes(
        constraintLhs
      )) ||
    (constraintStore.get(constraintRhs) as FunctionType).returnType.kind ===
      (constraintLhs as Variable).kind
  ) {
    console.log('[debug] Error in Rule 4!')
    return { constraintLhs, constraintRhs } // for error logging
  }
  // Rule 5
  else if (
    (constraintLhs as Variable).isAddable &&
    constraintStore.get(constraintRhs) !== undefined &&
    !isTypeVariable(constraintStore.get(constraintRhs)) &&
    ((constraintRhs as Primitive).name !== 'number' ||
      (constraintRhs as Primitive).name !== 'string')
  ) {
    console.log('[debug] Error in Rule 5')
    return { constraintLhs, constraintRhs } // for error logging
  }
  // Rule 6
  else if (isTypeVariable(constraintLhs) && constraintStore.get(constraintLhs) !== undefined) {
    return solveConstraint(constraintRhs, constraintStore.get(constraintLhs))
  }
  // Rule 7
  else if (
    isTypeVariable(constraintLhs) &&
    constraintStore.get(constraintLhs) === undefined &&
    constraintStore.get(constraintRhs) !== undefined
  ) {
    // Rule 7B
    if (
      constraintStore.get(constraintLhs) !== undefined &&
      (constraintStore.get(constraintLhs) as Variable).isAddable &&
      constraintStore.get(constraintRhs) !== undefined &&
      isTypeVariable(constraintStore.get(constraintRhs))
    ) {
      (constraintStore.get(constraintRhs) as Variable).isAddable = true
    }
    return solveConstraint(constraintLhs, constraintStore.get(constraintRhs))
  }
  // Rule 8
  else if (
    isFunctionType(constraintLhs) &&
    constraintStore.get(constraintRhs) !== undefined &&
    isFunctionType(constraintStore.get(constraintRhs)) &&
    (constraintLhs as FunctionType).parameterTypes.length ===
      (constraintStore.get(constraintRhs) as FunctionType).parameterTypes.length
  ) {
    addConstraint(constraintLhs as FunctionType, constraintStore.get(constraintRhs))
  }
  // check for mismatch base types (Rule 9)
  else if (
    isBaseType(constraintLhs) &&
    isBaseType(constraintRhs) &&
    (constraintLhs as Primitive).name !== (constraintRhs as Primitive).name
  ) {
    console.log('[debug] Error in Rule 9')
    return { constraintLhs, constraintRhs } // for error logging
  } else {
    constraintStore.set(constraintLhs, constraintRhs)
    return
  }
}

function addConstraint(constraintLhs: FunctionType, constraintRhs: FunctionType) {
  for (let index = 0; index < constraintLhs.parameterTypes.length; index++) {
    solveConstraint(constraintLhs.parameterTypes[index], constraintRhs.parameterTypes[index])
  }
  solveConstraint(constraintLhs.returnType, constraintRhs.returnType)
}
