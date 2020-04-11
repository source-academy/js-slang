import { Type, Variable, Primitive } from '../types'

export const constraintStore = new Map()

export function updateTypeConstraints(newConstraintLhs: Type, newConstraintRhs: Type) {
  console.log('updateTypeConstraints')
  console.log(newConstraintLhs + ' ' + newConstraintRhs)
  solveConstraint(newConstraintLhs, newConstraintRhs)
  if (detectError(constraintStore)) console.log('Error! Rule 9')
}

function solveConstraint(constraintLhs: Type, constraintRhs: Type) {
  // check if both key and value are not base types (Rule 1)
  if (!is_base_type(constraintLhs) && !is_base_type(constraintRhs)) {
    // check if key is not a type variable and value is a type variable (Rule 2)
    if (is_base_type(constraintLhs) && is_type_variable(constraintRhs)) {
      constraintStore.set(constraintRhs, constraintLhs)
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
      constraintStore.set(constraintRhs, constraintStore.get(constraintLhs))
    }
    // Rule 7
    else if (
      is_type_variable(constraintLhs) &&
      constraintStore.get(constraintLhs) === undefined &&
      constraintStore.get(constraintRhs) !== undefined
    ) {
      constraintStore.set(constraintLhs, constraintStore.get(constraintRhs))
    } else {
      constraintStore.set(constraintLhs, constraintRhs)
    }
  }
  console.log('After solving')
  constraintStore.forEach((value, key) => console.log(key, value))
}

function is_base_type(type: Type) {
  if (type.kind === 'primitive') return true
  else return false
}

function is_type_variable(type: Type) {
  if (type.kind === 'variable') return true
  else return false
}

// function is_function_type(type: Type) {
//     if (type.kind === 'function')
//         return true
//     else
//         return false
// }

// Rule 9
// base_type !== base_type will result in an error
function detectError(typeContraints: Map<Type, Type>) {
  let errorExist = false
  typeContraints.forEach((value, key) => {
    if (is_base_type(key) && is_base_type(value) && key !== value) {
      errorExist = true
    }
  })
  return errorExist
}
