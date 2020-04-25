import GPUTransformer from './transfomer'
import { AllowedDeclarations } from '../types'
import * as create from '../utils/astCreator'
import * as es from 'estree'

// top-level gpu functions that call our code

export function transpileToGPU(program: es.Program): number[][] {
  const transformer = new GPUTransformer(program)
  return transformer.transform()
}

export function getInternalNamesForGPU(): Set<string> {
  return new Set(Object.entries(GPUTransformer.globalIds).map(([key, { name }]) => key))
}

export function getInternalFunctionsForGPU(info: any, cid: any) {
  return Object.entries(GPUTransformer.globalIds).map(([key, { name }]) => {
    const kind: AllowedDeclarations = 'const'
    const value: es.Expression = create.callExpression(
      create.memberExpression(
        create.memberExpression(
          {
            type: 'MemberExpression',
            object: info.native,
            property: create.literal(cid),
            computed: true
          },
          'gpu'
        ),
        'get'
      ),
      [create.literal(key)]
    )
    return create.declaration(name, kind, value)
  })
}
