import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode, Variable, Type } from '../types'
import { generateTypeVariable } from './annotator'
import * as es from 'estree'

// The Type Environment
export const globalTypeEnvironment = new Map()
export const emptyMap = new Map()
export const environments: Map<string, Type>[] = [globalTypeEnvironment]
export const extendEnvironment = (map: Map<any, any> = emptyMap) => {
  const newTypeEnvironment =  new Map([...environments[0], ...map])
  environments.push(newTypeEnvironment)
  return environments[environments.length - 1]
}

export const popEnvironment = () => {
  environments.pop()
  return environments[environments.length - 1]
}

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
      globalTypeEnvironment.set(idenName, {
        types: [valueTypeVariable]
      })
    }
  }

  function updateForFunctionDeclaration(
    functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration>
  ) {
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

    // TODO: How to tell if the function declared is polymorphic? (w/o evaluating the body)
    // From the return statement's type variable obj?
    const isPolymorphic = true // set all to true for now and see what happens
    // ...

    if (idenName !== undefined && blockTypeVariable !== undefined) {
      globalTypeEnvironment.set(idenName, {
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

function generateVariableType() {
  return generateTypeVariable(true, false) // (isPolymorphic, isAddable)
}

let newVariableType1
let newVariableType2
let newAddableType

// Initiatize Type Environment
globalTypeEnvironment.set('-', {
  types: [
    generateFunctionType([numberType, numberType], numberType),
    generateFunctionType([numberType], numberType)
  ]
})
globalTypeEnvironment.set('*', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
globalTypeEnvironment.set('/', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
globalTypeEnvironment.set('%', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})

// LogicalExpression
newVariableType1 = generateVariableType()
newVariableType2 = generateVariableType()
globalTypeEnvironment.set('&&', {
  // types: [generateFunctionType([booleanType, variableType], variableType, true)],
  types: [generateFunctionType([booleanType, newVariableType1], newVariableType2, true)]
})

// LogicalExpression
newVariableType1 = generateVariableType()
newVariableType2 = generateVariableType()
globalTypeEnvironment.set('||', {
  // types: [generateFunctionType([booleanType, variableType], variableType, true)],
  types: [generateFunctionType([booleanType, newVariableType1], newVariableType2, true)]
})
globalTypeEnvironment.set('!', {
  types: [generateFunctionType([booleanType], booleanType)]
})

newAddableType = generateAddableType()
globalTypeEnvironment.set('+', {
  types: [generateFunctionType([newAddableType, newAddableType], newAddableType, true)]
})

newAddableType = generateAddableType()
globalTypeEnvironment.set('===', {
  types: [generateFunctionType([newAddableType, newAddableType], booleanType, true)]
})

newAddableType = generateAddableType()
globalTypeEnvironment.set('!==', {
  types: [generateFunctionType([variableType, variableType], booleanType, true)]
})

newAddableType = generateAddableType()
globalTypeEnvironment.set('>', {
  types: [generateFunctionType([newAddableType, newAddableType], booleanType, true)]
})

newAddableType = generateAddableType()
globalTypeEnvironment.set('>=', {
  types: [generateFunctionType([newAddableType, newAddableType], booleanType, true)]
})

newAddableType = generateAddableType()
globalTypeEnvironment.set('<', {
  types: [generateFunctionType([newAddableType, newAddableType], booleanType, true)]
})

newAddableType = generateAddableType()
globalTypeEnvironment.set('<=', {
  types: [generateFunctionType([newAddableType, newAddableType], booleanType, true)]
})

// globalTypeEnvironment.set('display', {
//   types: [
//     // { argumentTypes: [numberType], resultType: undefined },
//     // { argumentTypes: [stringType], resultType: undefined }
//     generateFunctionType([variableType], null)  // Todo: Multiple params accepted?
//   ],
//   isPolymorphic: true
// })
// globalTypeEnvironment.set('error', {
//   types: [
//     // { argumentTypes: [numberType], resultType: undefined },
//     // { argumentTypes: [stringType], resultType: undefined }
//     generateFunctionType([variableType], null)  // Todo: Multiple params accepted?
//   ],
//   isPolymorphic: true
// })

globalTypeEnvironment.set('Infinity', {
  types: [numberType]
})

newVariableType1 = generateVariableType()
globalTypeEnvironment.set('is_boolean', {
  // types: [generateFunctionType([variableType], booleanType, true)]
  types: [generateFunctionType([newVariableType1], booleanType, true)]
})

newVariableType1 = generateVariableType()
globalTypeEnvironment.set('is_function', {
  types: [generateFunctionType([newVariableType1], booleanType, true)]
})

newVariableType1 = generateVariableType()
globalTypeEnvironment.set('is_number', {
  types: [generateFunctionType([newVariableType1], booleanType, true)]
})

newVariableType1 = generateVariableType()
globalTypeEnvironment.set('is_string', {
  types: [generateFunctionType([newVariableType1], booleanType, true)]
})

newVariableType1 = generateVariableType()
globalTypeEnvironment.set('is_undefined', {
  types: [generateFunctionType([newVariableType1], booleanType, true)]
})

globalTypeEnvironment.set('math_abs', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_acos', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_acosh', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_asin', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_asinh', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_atan', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_atan2', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
globalTypeEnvironment.set('math_atanh', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_cbrt', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_ceil', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_clz32', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_cos', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_cosh', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_exp', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_expml', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_floor', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_fround', {
  types: [generateFunctionType([numberType], numberType)]
})
// globalTypeEnvironment.set('math_hypot', {
// types: [{ argumentTypes: [numberType], resultType: undefined }],
//   types: [generateFunctionType([variableType], numberType)],  // Todo: Multiple params accepted?
//   isPolymorphic: true
// })
globalTypeEnvironment.set('math_imul', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
globalTypeEnvironment.set('math_LN2', {
  types: [numberType]
})
globalTypeEnvironment.set('math_LN10', {
  types: [numberType]
})
globalTypeEnvironment.set('math_log', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_log1p', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_log2', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_LOG2E', {
  types: [numberType]
})
globalTypeEnvironment.set('math_log10', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_LOG10E', {
  types: [numberType]
})
// globalTypeEnvironment.set('math_max', {
//   // types: [
//   //   { argumentTypes: [numberType], resultType: undefined },
//   //   { argumentTypes: [stringType], resultType: undefined }
//   // ],
//   types: [generateFunctionType([variableType], numberType)],  // Todo: Multiple params accepted?
//   isPolymorphic: true
// })
// globalTypeEnvironment.set('math_min', {
//   // types: [
//   //   { argumentTypes: [numberType], resultType: undefined },
//   //   { argumentTypes: [stringType], resultType: undefined }
//   // ],
//   types: [generateFunctionType([variableType], numberType)],  // Todo: Multiple params accepted?
//   isPolymorphic: true
// })
globalTypeEnvironment.set('math_PI', {
  types: [numberType]
})
globalTypeEnvironment.set('math_pow', {
  types: [generateFunctionType([numberType, numberType], numberType)]
})
globalTypeEnvironment.set('math_random', {
  types: [generateFunctionType([], numberType)]
})
globalTypeEnvironment.set('math_round', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_sign', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_sin', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_sinh', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_sqrt', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_SQRT1_2', {
  types: [numberType]
})
globalTypeEnvironment.set('math_SQRT2', {
  types: [numberType]
})
globalTypeEnvironment.set('math_tan', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_tanh', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('math_trunc', {
  types: [generateFunctionType([numberType], numberType)]
})
globalTypeEnvironment.set('NaN', {
  types: [numberType]
})
globalTypeEnvironment.set('parse_int', {
  types: [generateFunctionType([stringType, numberType], numberType)]
})
globalTypeEnvironment.set('prompt', {
  types: [generateFunctionType([stringType], stringType)]
})
globalTypeEnvironment.set('runtime', {
  types: [generateFunctionType([], numberType)]
})

newVariableType1 = generateVariableType()
globalTypeEnvironment.set('stringify', {
  types: [generateFunctionType([newVariableType1], stringType, true)]
})

globalTypeEnvironment.set('undefined', {
  types: [undefinedType]
})

export function isOverLoaded(operator: string): boolean {
  return operator === '-'
}
