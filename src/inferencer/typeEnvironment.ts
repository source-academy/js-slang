import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode, Variable, Type } from '../types'
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
        types: [{ argumentTypes: [valueTypeVariable], resultType: undefined }]
      })
    }
  }

  ancestor(program as es.Node, {
    VariableDeclaration: updateForConstantDeclaration // Source 1 only has constant declaration
    // FunctionDeclaration: updateForFunctionDeclaration
  })
}

// Create Type objects for use later
const numberType: Type = {
  kind: 'primitive',
  name: 'number'
}
const booleanType: Type = {
  kind: 'primitive',
  name: 'boolean'
}
const stringType: Type = {
  kind: 'primitive',
  name: 'string'
}
const undefinedType: Type = {
  kind: 'primitive',
  name: 'undefined'
}

const variableType: Type = {
  kind: 'variable',
  // id?: number
  // isAddable?: boolean
  isPolymorphic: true
}

const addableType: Type = {
  kind: 'variable',
  // id?: number
  isAddable: true,
  isPolymorphic: true
}

function generateFunctionType(parameterTypes: Type[], returnType: Type) {
  const functionType: Type = {
    kind: 'function',
    parameterTypes: parameterTypes,
    returnType: returnType
  }
  return functionType
}

// Initiatize Type Environment
primitiveMap.set('-', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: numberType },
    // { argumentTypes: [numberType], resultType: numberType }
    generateFunctionType([numberType, numberType], numberType),
    generateFunctionType([numberType], numberType),
  ],
  isPolymorphic: false
})
primitiveMap.set('*', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('/', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('%', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('&&', {
  // types: [{ argumentTypes: [booleanType, 'any'], resultType: 'any' }],
  types: [generateFunctionType([booleanType, variableType], variableType)],
  isPolymorphic: false
})
primitiveMap.set('||', {
  // types: [{ argumentTypes: [booleanType, 'any'], resultType: 'any' }],
  types: [generateFunctionType([booleanType, variableType], variableType)],
  isPolymorphic: false
})
primitiveMap.set('!', {
  // types: [{ argumentTypes: [booleanType], resultType: booleanType }],
  types: [generateFunctionType([booleanType], booleanType)],
  isPolymorphic: false
})

primitiveMap.set('+', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: numberType },
    // { argumentTypes: [stringType, stringType], resultType: stringType }
    // generateFunctionType([numberType, numberType], numberType),
    // generateFunctionType([stringType, stringType], stringType)
    generateFunctionType([addableType, addableType], addableType)
  ],
  isPolymorphic: true
})
primitiveMap.set('===', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([numberType, numberType], booleanType),
    // generateFunctionType([stringType, stringType], booleanType)
    generateFunctionType([addableType, addableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('!==', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([numberType, numberType], booleanType),
    // generateFunctionType([stringType, stringType], booleanType)
    generateFunctionType([addableType, addableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('>', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([numberType, numberType], booleanType),
    // generateFunctionType([stringType, stringType], booleanType)
    generateFunctionType([addableType, addableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('>=', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([numberType, numberType], booleanType),
    // generateFunctionType([stringType, stringType], booleanType)
    generateFunctionType([addableType, addableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('<', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([numberType, numberType], booleanType),
    // generateFunctionType([stringType, stringType], booleanType)
    generateFunctionType([addableType, addableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('<=', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([numberType, numberType], booleanType),
    // generateFunctionType([stringType, stringType], booleanType)
    generateFunctionType([addableType, addableType], booleanType)
  ],
  isPolymorphic: true
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
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  // types: [generateFunctionType([], numberType)],
  types: [numberType],
  isPolymorphic: false
})
primitiveMap.set('is_boolean', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('is_function', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('is_number', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('is_string', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('is_undefined', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType)
  ],
  isPolymorphic: true
})
primitiveMap.set('math_abs', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_acos', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_acosh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_asin', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_asinh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_atan', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_atan2', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_atanh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_cbrt', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_ceil', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_clz32', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_cos', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_cosh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_exp', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_expml', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_floor', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_fround', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
// primitiveMap.set('math_hypot', {
//   // types: [{ argumentTypes: [numberType], resultType: undefined }],
//   types: [generateFunctionType([variableType], numberType)],  // Todo: Multiple params accepted?
//   isPolymorphic: true
// })
primitiveMap.set('math_imul', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_LN2', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  // types: [generateFunctionType([], numberType)],
  types: [numberType],
  isPolymorphic: false
})
primitiveMap.set('math_LN10', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  // types: [generateFunctionType([], numberType)],
  types: [numberType],
  isPolymorphic: false
})
primitiveMap.set('math_log', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_log1p', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_log2', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_LOG2E', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  // types: [generateFunctionType([], numberType)],
  types: [numberType],
  isPolymorphic: false
})
primitiveMap.set('math_log10', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_LOG10E', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  // types: [generateFunctionType([], numberType)],
  types: [numberType],
  isPolymorphic: false
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
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  types: [generateFunctionType([], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_pow', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_random', {
  // types: [{ argumentTypes: [], resultType: numberType }],
  types: [generateFunctionType([], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_round', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_sign', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_sin', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_sinh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_sqrt', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_SQRT1_2', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  types: [numberType],
  isPolymorphic: false
})
primitiveMap.set('math_SQRT2', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  types: [numberType],
  isPolymorphic: false
})
primitiveMap.set('math_tan', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_tanh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('math_trunc', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('NaN', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  types: [numberType],
  isPolymorphic: false
})
primitiveMap.set('parse_int', {
  // types: [{ argumentTypes: [stringType, numberType], resultType: numberType }],
  types: [generateFunctionType([stringType, numberType], numberType)],
  isPolymorphic: false
})
primitiveMap.set('prompt', {
  // types: [{ argumentTypes: [stringType], resultType: stringType }],
  types: [generateFunctionType([stringType], stringType)],
  isPolymorphic: false
})
primitiveMap.set('runtime', {
  // types: [{ argumentTypes: [], resultType: numberType }],
  types: [generateFunctionType([], numberType)],
  isPolymorphic: false
})
// primitiveMap.set('stringify', {
//   // types: [
//   //   { argumentTypes: [numberType], resultType: stringType },
//   //   { argumentTypes: [stringType], resultType: stringType }
//   // ],
//   types: [generateFunctionType([variableType], stringType)],  // Todo: Multiple params accepted?
//   isPolymorphic: true
// })
primitiveMap.set('undefined', {
  // types: [{ argumentTypes: [undefinedType], resultType: undefined }],
  types: [undefinedType],
  isPolymorphic: false
})
