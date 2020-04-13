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

  function updateForFunctionDeclaration(
    functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration>
  ) {
    console.log('updateForFunctionDeclaration')
    // e.g. Given: f^T3 (x^T1) { return (...) }^T2, Set: Γ[ f ← [T1] => T2 ]
    const iden = functionDeclaration.id as TypeAnnotatedNode<es.Identifier>
    const idenName = iden.name

    const params = functionDeclaration.params as TypeAnnotatedNode<es.Node>[]
    const paramTypeVariables = []
    for (const p of params) {
      if (p.typeVariable) paramTypeVariables.push(p.typeVariable as Variable)
    }

    // let returnTypeVariable
    // const bodyNodes = functionDeclaration.body.body
    // for (let i in bodyNodes) {
    //   if (bodyNodes[i].type && bodyNodes[i].type === 'ReturnStatement') {
    //     console.log(bodyNodes[i] as TypeAnnotatedNode<es.ReturnStatement>)
    //     console.log((bodyNodes[i] as TypeAnnotatedNode<es.ReturnStatement>).typeVariable)
    //     returnTypeVariable = (bodyNodes[i] as TypeAnnotatedNode<es.ReturnStatement>).typeVariable as Variable
    //   }
    // }

    const block = functionDeclaration.body as TypeAnnotatedNode<es.BlockStatement>
    const blockTypeVariable = block.typeVariable as Variable

    console.log(blockTypeVariable)

    // Todo: How to tell if the function declared is polymorphic? (w/o evaluating the body)
    // From the return statement's type variable obj?
    const isPolymorphic = true // set all to true for now and see what happens
    // ...

    if (idenName !== undefined && blockTypeVariable !== undefined) {
      primitiveMap.set(idenName, {
        types: [generateFunctionType(paramTypeVariables, blockTypeVariable, isPolymorphic)]
      })
    }
  }

  ancestor(program as es.Node, {
    VariableDeclaration: updateForConstantDeclaration, // Source 1 only has constant declaration
    FunctionDeclaration: updateForFunctionDeclaration
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
    // { argumentTypes: [numberType, numberType], resultType: numberType },
    // { argumentTypes: [numberType], resultType: numberType }
    generateFunctionType([numberType, numberType], numberType),
    generateFunctionType([numberType], numberType)
  ]
  // isPolymorphic: false
})
primitiveMap.set('*', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)]
  // isPolymorphic: false
})
primitiveMap.set('/', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)]
  // isPolymorphic: false
})
primitiveMap.set('%', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)]
  // isPolymorphic: false
})
primitiveMap.set('&&', {
  // types: [{ argumentTypes: [booleanType, 'any'], resultType: 'any' }],
  types: [generateFunctionType([booleanType, variableType], variableType, true)]
  // isPolymorphic: false
})
primitiveMap.set('||', {
  // types: [{ argumentTypes: [booleanType, 'any'], resultType: 'any' }],
  types: [generateFunctionType([booleanType, variableType], variableType, true)],
  isPolymorphic: false
})
primitiveMap.set('!', {
  // types: [{ argumentTypes: [booleanType], resultType: booleanType }],
  types: [generateFunctionType([booleanType], booleanType)]
  // isPolymorphic: false
})

let newAddableType = generateAddableType()
primitiveMap.set('+', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: numberType },
    // { argumentTypes: [stringType, stringType], resultType: stringType }
    // generateFunctionType([addableType, addableType], addableType, true)
    generateFunctionType([newAddableType, newAddableType], newAddableType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('===', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([addableType, addableType], booleanType, true)
    generateFunctionType([variableType, variableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('!==', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([addableType, addableType], booleanType, true)
    generateFunctionType([variableType, variableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('>', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([addableType, addableType], booleanType, true)
    generateFunctionType([newAddableType, newAddableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('>=', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([addableType, addableType], booleanType, true)
    generateFunctionType([newAddableType, newAddableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('<', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([addableType, addableType], booleanType, true)
    generateFunctionType([newAddableType, newAddableType], booleanType, true)
  ]
})

newAddableType = generateAddableType()
primitiveMap.set('<=', {
  types: [
    // { argumentTypes: [numberType, numberType], resultType: booleanType },
    // { argumentTypes: [stringType, stringType], resultType: booleanType }
    // generateFunctionType([addableType, addableType], booleanType, true)
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
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  types: [numberType]
})
primitiveMap.set('is_boolean', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType, true)
  ]
})
primitiveMap.set('is_function', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType, true)
  ]
})
primitiveMap.set('is_number', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType, true)
  ]
})
primitiveMap.set('is_string', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType, true)
  ]
})
primitiveMap.set('is_undefined', {
  types: [
    // { argumentTypes: [numberType], resultType: booleanType },
    // { argumentTypes: [stringType], resultType: stringType }
    generateFunctionType([variableType], booleanType, true)
  ]
})

primitiveMap.set('math_abs', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_acos', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_acosh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_asin', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_asinh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_atan', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_atan2', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)]
})
primitiveMap.set('math_atanh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_cbrt', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_ceil', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_clz32', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_cos', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_cosh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_exp', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_expml', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_floor', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_fround', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
// primitiveMap.set('math_hypot', {
//   // types: [{ argumentTypes: [numberType], resultType: undefined }],
//   types: [generateFunctionType([variableType], numberType)],  // Todo: Multiple params accepted?
//   isPolymorphic: true
// })
primitiveMap.set('math_imul', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)]
})
primitiveMap.set('math_LN2', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  // types: [generateFunctionType([], numberType)],
  types: [numberType]
})
primitiveMap.set('math_LN10', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  // types: [generateFunctionType([], numberType)],
  types: [numberType]
})
primitiveMap.set('math_log', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_log1p', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_log2', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_LOG2E', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  // types: [generateFunctionType([], numberType)],
  types: [numberType]
})
primitiveMap.set('math_log10', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_LOG10E', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  // types: [generateFunctionType([], numberType)],
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
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  // types: [generateFunctionType([], numberType)],
  types: [numberType]
})
primitiveMap.set('math_pow', {
  // types: [{ argumentTypes: [numberType, numberType], resultType: numberType }],
  types: [generateFunctionType([numberType, numberType], numberType)]
})
primitiveMap.set('math_random', {
  // types: [{ argumentTypes: [], resultType: numberType }],
  types: [generateFunctionType([], numberType)]
})
primitiveMap.set('math_round', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_sign', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_sin', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_sinh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_sqrt', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_SQRT1_2', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  types: [numberType]
})
primitiveMap.set('math_SQRT2', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  types: [numberType]
})
primitiveMap.set('math_tan', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_tanh', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('math_trunc', {
  // types: [{ argumentTypes: [numberType], resultType: numberType }],
  types: [generateFunctionType([numberType], numberType)]
})
primitiveMap.set('NaN', {
  // types: [{ argumentTypes: [numberType], resultType: undefined }],
  types: [numberType]
})
primitiveMap.set('parse_int', {
  // types: [{ argumentTypes: [stringType, numberType], resultType: numberType }],
  types: [generateFunctionType([stringType, numberType], numberType)]
})
primitiveMap.set('prompt', {
  // types: [{ argumentTypes: [stringType], resultType: stringType }],
  types: [generateFunctionType([stringType], stringType)]
})
primitiveMap.set('runtime', {
  // types: [{ argumentTypes: [], resultType: numberType }],
  types: [generateFunctionType([], numberType)]
})
primitiveMap.set('stringify', {
  // types: [
  //   { argumentTypes: [numberType], resultType: stringType },
  //   { argumentTypes: [stringType], resultType: stringType }
  // ],
  types: [generateFunctionType([variableType], stringType, true)]
})
primitiveMap.set('undefined', {
  // types: [{ argumentTypes: [undefinedType], resultType: undefined }],
  types: [undefinedType]
})

export function isOverLoaded(operator: string): boolean {
  return operator === '-'
}
