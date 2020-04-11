import { Type, Variable, Primitive } from '../types'

export const constraintStore = new Map()

export function updateTypeConstraints(newConstraintLhs: Type, newConstraintRhs: Type) {
  console.log('updateTypeConstraints')
  console.log(newConstraintLhs + ' ' + newConstraintRhs)
  solveConstraint(newConstraintLhs, newConstraintRhs)
}

function solveConstraint(constraintLhs: Type, constraintRhs: Type) {
  // check if both key and value are base types and of the same kind (Rule 1)
  if (
    is_base_type(constraintLhs) &&
    is_base_type(constraintRhs) &&
    (constraintLhs as Primitive).name === (constraintRhs as Primitive).name
  ) {
    // do nothing
  }
  // check if key is not a type variable and value is a type variable (Rule 2)
  else if (!is_type_variable(constraintLhs) && is_type_variable(constraintRhs)) {
    solveConstraint(constraintRhs, constraintLhs)
    // constraintStore.set(constraintRhs, constraintLhs)
  }
  // Rule 3
  else if (
    is_type_variable(constraintLhs) &&
    constraintStore.get(constraintRhs) !== undefined &&
    is_type_variable(constraintStore.get(constraintRhs)) &&
    constraintStore.get(constraintRhs) === constraintLhs
  ) {
    // do nothing
  }
  // Rule 4
  // else if (is_type_variable(constraintLhs) && is_function_type(constraintStore.get(constraintRhs))
  //   && ) {
  //   // error
  //   console.log('Error! Rule 4')
  // }
  // Rule 5
  else if (
    (constraintLhs as Variable).isAddable &&
    constraintStore.get(constraintRhs) !== undefined &&
    !is_type_variable(constraintStore.get(constraintRhs)) &&
    ((constraintRhs as Primitive).name !== 'number' ||
      (constraintRhs as Primitive).name !== 'string')
  ) {
    console.log('Error! Rule 5')
  }
  // Rule 6
  else if (is_type_variable(constraintLhs) && constraintStore.get(constraintLhs) !== undefined) {
    solveConstraint(constraintRhs, constraintStore.get(constraintLhs))
    // constraintStore.set(constraintRhs, constraintStore.get(constraintLhs))
  }
  // Rule 7
  else if (
    is_type_variable(constraintLhs) &&
    constraintStore.get(constraintLhs) === undefined &&
    constraintStore.get(constraintRhs) !== undefined
  ) {
    solveConstraint(constraintLhs, constraintStore.get(constraintRhs))
    // constraintStore.set(constraintLhs, constraintStore.get(constraintRhs))
  }
  // Rule 9
  else if (
    is_base_type(constraintLhs) &&
    is_base_type(constraintRhs) &&
    (constraintLhs as Primitive).name !== (constraintRhs as Primitive).name
  ) {
    console.log('Error! Rule 9')
  } else {
    constraintStore.set(constraintLhs, constraintRhs)
  }
  // console.log('After solving')
  // constraintStore.forEach((value, key) => console.log(key, value))
}

function is_base_type(type: Type) {
  return type.kind === 'primitive'
}

function is_type_variable(type: Type) {
  return type.kind === 'variable'
}

// function is_function_type(type: Type) {
//     return type.kind === 'function'
// }
