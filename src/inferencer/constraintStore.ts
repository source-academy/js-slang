import { Type, Variable, Primitive, isBaseType, isTypeVariable } from '../types'
import { printType } from '../utils/inferencerUtils'

export const constraintStore = new Map()

export function updateTypeConstraints(newConstraintLhs: Type, newConstraintRhs: Type) {
  console.log('constraintStore.updateTypeConstraints:')

  // Note: If no error, returns undefined (i.e. nothing), else return error obj for logging
  return solveConstraint(newConstraintLhs, newConstraintRhs)
}

function solveConstraint(constraintLhs: Type, constraintRhs: Type): any | undefined {
  // temp logging for debug
  const toPrint = `> Trying to add: ${printType(constraintLhs)} = ${printType(constraintRhs)}`
  console.log(toPrint)
  // logging - end
  // check if both key and value are base types and of the same kind (Rule 1)
  if (
    isBaseType(constraintLhs) &&
    isBaseType(constraintRhs) &&
    (constraintLhs as Primitive).name === (constraintRhs as Primitive).name
  ) {
    // do nothing
    return
  }
  // check if key is not a type variable and value is a type variable (Rule 2)
  else if (!isTypeVariable(constraintLhs) && isTypeVariable(constraintRhs)) {
    return solveConstraint(constraintRhs, constraintLhs)
  }
  // Rule 3
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
  // else if (isTypeVariable(constraintLhs) && is_function_type(constraintStore.get(constraintRhs))
  //   && ) {
  //   // error
  //   console.log('[debug] Error in Rule 4!')
  //   return {constraintLhs: constraintLhs, constraintRhs: constraintRhs} // for error logging
  // }
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
    return solveConstraint(constraintLhs, constraintStore.get(constraintRhs))
  }
  // Rule 9
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
  // console.log('After solving')
  // constraintStore.forEach((value, key) => console.log(key, value))
}

// Note: Moved the below to ./types.ts because inferencer.ts needs these functions as well

// function isBaseType(type: Type) {
//   return (type && type.kind === 'primitive')
// }

// function isTypeVariable(type: Type) {
//   return (type && type.kind === 'variable')
// }

// function is_function_type(type: Type) {
//     return type.kind === 'function'
// }
