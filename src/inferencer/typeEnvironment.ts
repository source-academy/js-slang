import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode, Variable } from '../types'
import * as es from 'estree'

// The Type Environment
export const primitiveMap = new Map()

// Main function that will update the type environment e.g. for declarations
export function updateTypeEnvironment(program: es.Program) {
  function updateForConstantDeclaration(constantDeclaration: TypeAnnotatedNode<es.VariableDeclaration>) {
    // e.g. Given: const x^T1 = 1^T2, Set: Γ[ x ← T1 ]
    const lhs = constantDeclaration.declarations[0].id as TypeAnnotatedNode<es.Identifier>
    const lhsName = lhs.name
    const lhsVariableId = (lhs.typeVariable as Variable).id
    if (lhsName !== undefined && lhsVariableId !== undefined) {
      primitiveMap.set(lhsName, lhsVariableId)
    }
  }

  ancestor(program as es.Node, {
    VariableDeclaration: updateForConstantDeclaration // Source 1 only has constant declaration
    // FunctionDeclaration: updateForFunctionDeclaration
  })
}

// Initiatize Type Environment
primitiveMap.set('-', {
  types: [
    { argumentTypes: ['number', 'number'], resultType: 'number' },
    { argumentTypes: ['number'], resultType: 'number' }
  ],
  isPolymorphic: false
})
primitiveMap.set('*', {
  types: [{ argumentTypes: ['number', 'number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('/', {
  types: [{ argumentTypes: ['number', 'number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('%', {
  types: [{ argumentTypes: ['number', 'number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('&&', {
  types: [{ argumentTypes: ['boolean', 'any'], resultType: 'any' }],
  isPolymorphic: false
})
primitiveMap.set('||', {
  types: [{ argumentTypes: ['boolean', 'any'], resultType: 'any' }],
  isPolymorphic: false
})
primitiveMap.set('!', {
  types: [{ argumentTypes: ['boolean'], resultType: 'boolean' }],
  isPolymorphic: false
})

primitiveMap.set('+', {
  types: [
    { argumentTypes: ['number', 'number'], resultType: 'number' },
    { argumentTypes: ['string', 'string'], resultType: 'string' }
  ],
  isPolymorphic: true
})
primitiveMap.set('===', {
  types: [
    { argumentTypes: ['number', 'number'], resultType: 'boolean' },
    { argumentTypes: ['string', 'string'], resultType: 'boolean' }
  ],
  isPolymorphic: true
})
primitiveMap.set('!==', {
  types: [
    { argumentTypes: ['number', 'number'], resultType: 'boolean' },
    { argumentTypes: ['string', 'string'], resultType: 'boolean' }
  ],
  isPolymorphic: true
})
primitiveMap.set('>', {
  types: [
    { argumentTypes: ['number', 'number'], resultType: 'boolean' },
    { argumentTypes: ['string', 'string'], resultType: 'boolean' }
  ],
  isPolymorphic: true
})
primitiveMap.set('>=', {
  types: [
    { argumentTypes: ['number', 'number'], resultType: 'boolean' },
    { argumentTypes: ['string', 'string'], resultType: 'boolean' }
  ],
  isPolymorphic: true
})
primitiveMap.set('<', {
  types: [
    { argumentTypes: ['number', 'number'], resultType: 'boolean' },
    { argumentTypes: ['string', 'string'], resultType: 'boolean' }
  ],
  isPolymorphic: true
})
primitiveMap.set('<=', {
  types: [
    { argumentTypes: ['number', 'number'], resultType: 'boolean' },
    { argumentTypes: ['string', 'string'], resultType: 'boolean' }
  ],
  isPolymorphic: true
})

primitiveMap.set('display', {
  types: [
    { argumentTypes: ['number'], resultType: '' },
    { argumentTypes: ['string'], resultType: '' }
  ],
  isPolymorphic: false
})
primitiveMap.set('error', {
  types: [
    { argumentTypes: ['number'], resultType: '' },
    { argumentTypes: ['string'], resultType: '' }
  ],
  isPolymorphic: false
})
primitiveMap.set('Infinity', {
  types: [{ argumentTypes: ['number'], resultType: '' }],
  isPolymorphic: false
})
primitiveMap.set('is_boolean', {
  types: [
    { argumentTypes: ['number'], resultType: 'boolean' },
    { argumentTypes: ['string'], resultType: 'string' }
  ],
  isPolymorphic: false
})
primitiveMap.set('is_function', {
  types: [
    { argumentTypes: ['number'], resultType: 'boolean' },
    { argumentTypes: ['string'], resultType: 'string' }
  ],
  isPolymorphic: false
})
primitiveMap.set('is_number', {
  types: [
    { argumentTypes: ['number'], resultType: 'boolean' },
    { argumentTypes: ['string'], resultType: 'string' }
  ],
  isPolymorphic: false
})
primitiveMap.set('is_string', {
  types: [
    { argumentTypes: ['number'], resultType: 'boolean' },
    { argumentTypes: ['string'], resultType: 'string' }
  ],
  isPolymorphic: false
})
primitiveMap.set('is_undefined', {
  types: [
    { argumentTypes: ['number'], resultType: 'boolean' },
    { argumentTypes: ['string'], resultType: 'string' }
  ],
  isPolymorphic: false
})
primitiveMap.set('math_abs', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_acos', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_acosh', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_asin', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_asinh', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_atan', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_atan2', {
  types: [{ argumentTypes: ['number', 'number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_atanh', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_cbrt', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_ceil', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_clz32', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_cos', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_cosh', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_exp', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_expml', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_floor', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_fround', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_hypot', {
  types: [{ argumentTypes: ['number'], resultType: '' }],
  isPolymorphic: false
})
primitiveMap.set('math_imul', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_LN2', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_LN10', {
  types: [{ argumentTypes: ['number'], resultType: '' }],
  isPolymorphic: false
})
primitiveMap.set('math_log', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_log1p', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_log2', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_LOG2E', {
  types: [{ argumentTypes: ['number'], resultType: '' }],
  isPolymorphic: false
})
primitiveMap.set('math_log10', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_LOG10E', {
  types: [{ argumentTypes: ['number'], resultType: '' }],
  isPolymorphic: false
})
primitiveMap.set('math_max', {
  types: [
    { argumentTypes: ['number'], resultType: '' },
    { argumentTypes: ['string'], resultType: '' }
  ],
  isPolymorphic: false
})
primitiveMap.set('math_min', {
  types: [
    { argumentTypes: ['number'], resultType: '' },
    { argumentTypes: ['string'], resultType: '' }
  ],
  isPolymorphic: false
})
primitiveMap.set('math_PI', {
  types: [{ argumentTypes: ['number'], resultType: '' }],
  isPolymorphic: false
})
primitiveMap.set('math_pow', {
  types: [{ argumentTypes: ['number', 'number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_random', {
  types: [{ argumentTypes: [], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_round', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_sign', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_sin', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_sinh', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_sqrt', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_SQRT1_2', {
  types: [{ argumentTypes: ['number'], resultType: '' }],
  isPolymorphic: false
})
primitiveMap.set('math_SQRT2', {
  types: [{ argumentTypes: ['number'], resultType: '' }],
  isPolymorphic: false
})
primitiveMap.set('math_tan', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_tanh', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('math_trunc', {
  types: [{ argumentTypes: ['number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('NaN', {
  types: [{ argumentTypes: ['number'], resultType: '' }],
  isPolymorphic: false
})
primitiveMap.set('parse_int', {
  types: [{ argumentTypes: ['string', 'number'], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('prompt', {
  types: [{ argumentTypes: ['string'], resultType: 'string' }],
  isPolymorphic: false
})
primitiveMap.set('runtime', {
  types: [{ argumentTypes: [], resultType: 'number' }],
  isPolymorphic: false
})
primitiveMap.set('stringify', {
  types: [
    { argumentTypes: ['number'], resultType: 'string' },
    { argumentTypes: ['string'], resultType: 'string' }
  ],
  isPolymorphic: false
})
primitiveMap.set('undefined', {
  types: [{ argumentTypes: ['undefined'], resultType: '' }],
  isPolymorphic: false
})
