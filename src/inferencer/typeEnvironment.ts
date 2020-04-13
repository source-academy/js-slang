import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode, Variable, Type } from '../types'
import { generateTypeVariable } from './annotator'
import * as es from 'estree'

// The Type Environment
export const primitiveMap = new Map()

// Main function that will update the type environment e.g. for declarations
export function updateTypeEnvironment(program: es.Program) {
  function updateForConstantDeclaration(
    constantDeclaration: TypeAnnotatedNode<es.VariableDeclaration>
  ) {
    // e.g. Given: const x^T1 = 1^T2, Set: Γ[ x ← T2 ]
    const iden = constantDeclaration.declarations[0].id as TypeAnnotatedNode<es.Identifier>
    const idenName = iden.name

    const value = constantDeclaration.declarations[0].init as TypeAnnotatedNode<es.Node> // use es.Node because rhs could be any value/expression
    const valueTypeVariable = value.typeVariable as Variable

    if (idenName !== undefined && valueTypeVariable !== undefined) {
      primitiveMap.set(idenName, {
        types: [valueTypeVariable]
      })
    }
  }

  ancestor(program as es.Node, {
    VariableDeclaration: updateForConstantDeclaration // Source 1 only has constant declaration
    // FunctionDeclaration: updateForFunctionDeclaration
  })
}

// Create Type objects for use later
export const numberType: Type = {
  kind: 'primitive',
  name: 'number'
}
export const booleanType: Type = {
  kind: 'primitive',
  name: 'boolean'
}
export const stringType: Type = {
  kind: 'primitive',
  name: 'string'
}
export const undefinedType: Type = {
  kind: 'primitive',
  name: 'undefined'
}

export const variableType: Type = {
  kind: 'variable',
  // id?: number
  // isAddable?: boolean
  isPolymorphic: true
}

// const addableType: Type = {
//   kind: 'variable',
//   // id?: number
//   isAddable: true,
//   isPolymorphic: true
// }

function generateFunctionType(
  parameterTypes: Type[],
  returnType: Type,
  isPolymorphic: boolean = false
) {
  const functionType: Type = {
    kind: 'function',
    parameterTypes,
    returnType,
    isPolymorphic
  }
  return functionType
}

function generateAddableType() {
  return generateTypeVariable(false, true) // (isPolymorphic, isAddable)
}

// Initiatize Type Environment
primitiveMap.set('-', {
  types: [
    generateFunctionType([numberType, numberType], numberType),
    generateFunctionType([numberType], numberType)
  ]
})
primitiveMap.set('*', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
primitiveMap.set('/', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
primitiveMap.set('%', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
primitiveMap.set('&&', {
  types: [generateFunctionType([booleanType, variableType], variableType, true)]
})
primitiveMap.set('||', {
  types: [generateFunctionType([booleanType, variableType], variableType, true)],
  isPolymorphic: false
})
primitiveMap.set('!', {
  types: [generateFunctionType([booleanType], booleanType)]
})

let newAddableType = generateAddableType()
primitiveMap.set('+', {
  types: [
    generateFunctionType([newAddableType, newAddableType], newAddableType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('===', {
  types: [
    generateFunctionType([variableType, variableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('!==', {
  types: [
    generateFunctionType([variableType, variableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('>', {
  types: [
    generateFunctionType([newAddableType, newAddableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('>=', {
  types: [
    generateFunctionType([newAddableType, newAddableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('<', {
  types: [
    generateFunctionType([newAddableType, newAddableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('<=', {
  types: [
    generateFunctionType([newAddableType, newAddableType], booleanType, true)
  ]
})

// primitiveMap.set('display', {
//   types: [
//     // { argumentTypes: [numberType], resultType: undefined },
//     // { argumentTypes: [stringType], resultType: undefined }
//     generateFunctionType([variableType], null)  // Todo: Multiple params accepted?
//   ],
//   isPolymorphic: true
// })
// primitiveMap.set('error', {
//   types: [
//     // { argumentTypes: [numberType], resultType: undefined },
//     // { argumentTypes: [stringType], resultType: undefined }
//     generateFunctionType([variableType], null)  // Todo: Multiple params accepted?
//   ],
//   isPolymorphic: true
// })

primitiveMap.set('Infinity', {
  types: [numberType]
})
primitiveMap.set('is_boolean', {
  types: [
    generateFunctionType([variableType], booleanType, true)
  ]
})
primitiveMap.set('is_function', {
  types: [
    generateFunctionType([variableType], booleanType, true)
  ]
})
primitiveMap.set('is_number', {
  types: [
    generateFunctionType([variableType], booleanType, true)
  ]
})
primitiveMap.set('is_string', {
  types: [
    generateFunctionType([variableType], booleanType, true)
  ]
})
primitiveMap.set('is_undefined', {
  types: [
    generateFunctionType([variableType], booleanType, true)
  ]
})

primitiveMap.set('math_abs', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_acos', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_acosh', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_asin', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_asinh', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_atan', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_atan2', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
primitiveMap.set('math_atanh', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_cbrt', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_ceil', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_clz32', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_cos', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_cosh', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_exp', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_expml', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_floor', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_fround', {
  types: [generateFunctionType([numberType], numberType)]
})
// primitiveMap.set('math_hypot', {
//   types: [generateFunctionType([variableType], numberType)],  // Todo: Multiple params accepted?
//   isPolymorphic: true
// })
primitiveMap.set('math_imul', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
primitiveMap.set('math_LN2', {
  types: [numberType]
})
primitiveMap.set('math_LN10', {
  types: [numberType]
})
primitiveMap.set('math_log', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_log1p', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_log2', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_LOG2E', {
  types: [numberType]
})
primitiveMap.set('math_log10', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_LOG10E', {
  types: [numberType]
})
// primitiveMap.set('math_max', {
//   // types: [
//   //   { argumentTypes: [numberType], resultType: undefined },
//   //   { argumentTypes: [stringType], resultType: undefined }
//   // ],
//   types: [generateFunctionType([variableType], numberType)],  // Todo: Multiple params accepted?
//   isPolymorphic: true
// })
// primitiveMap.set('math_min', {
//   // types: [
//   //   { argumentTypes: [numberType], resultType: undefined },
//   //   { argumentTypes: [stringType], resultType: undefined }
//   // ],
//   types: [generateFunctionType([variableType], numberType)],  // Todo: Multiple params accepted?
//   isPolymorphic: true
// })
primitiveMap.set('math_PI', {
  types: [numberType]
})
primitiveMap.set('math_pow', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
primitiveMap.set('math_random', {
  types: [generateFunctionType([], numberType)]
})
primitiveMap.set('math_round', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_sign', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_sin', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_sinh', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_sqrt', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_SQRT1_2', {
  types: [numberType]
})
primitiveMap.set('math_SQRT2', {
  types: [numberType]
})
primitiveMap.set('math_tan', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_tanh', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_trunc', {
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('NaN', {
  types: [numberType]
})
primitiveMap.set('parse_int', {
  types: [generateFunctionType([stringType, numberType], numberType)]
})
primitiveMap.set('prompt', {
  types: [generateFunctionType([stringType], stringType)]
})
primitiveMap.set('runtime', {
  types: [generateFunctionType([], numberType)]
})
primitiveMap.set('stringify', {
  types: [generateFunctionType([variableType], stringType, true)]
})
primitiveMap.set('undefined', {
  types: [undefinedType]
})

export function isOverLoaded(operator: string): boolean {
  return operator === '-'
}
