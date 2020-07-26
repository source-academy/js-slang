import GPUTransformer from './transfomer'
import { AllowedDeclarations } from '../types'
import * as create from '../utils/astCreator'
import * as es from 'estree'
import { NativeIds } from '../transpiler/transpiler'

// top-level gpu functions that call our code

// transpiles if possible and returns display statements to end user
export function transpileToGPU(
  program: es.Program,
  globalIds: NativeIds,
  kernelFunction: string
): {
  gpuDisplayStatements: es.Statement[]
  gpuInternalNames: Set<string>
  gpuInternalFunctions: es.Statement[]
} {
  const transformer = new GPUTransformer(program, create.identifier(kernelFunction))
  const res = transformer.transform()

  const gpuDisplayStatements = []
  // add some display statements to program
  if (res.length > 0) {
    for (const arr of res) {
      let debug = `Attempting to optimize ${arr[1]} levels of nested loops starting on line ${arr[0]}`
      if (arr[1] === 1) {
        debug = `Attempting to optimize the loop on line ${arr[0]}`
      }
      gpuDisplayStatements.push(
        create.expressionStatement(
          create.callExpression(create.identifier('display'), [create.literal(debug)])
        )
      )
    }
  }
  return {
    gpuDisplayStatements,
    gpuInternalNames: getInternalNamesForGPU(transformer),
    gpuInternalFunctions: getInternalFunctionsForGPU(globalIds, transformer)
  }
}

export function getInternalNamesForGPU(gpuTransformer: GPUTransformer): Set<string> {
  return new Set(Object.entries(gpuTransformer.globalIds).map(([key, { name }]) => key))
}

export function getInternalFunctionsForGPU(globalIds: NativeIds, gpuTransformer: GPUTransformer) {
  return Object.entries(gpuTransformer.globalIds).map(([key, { name }]) => {
    const kind: AllowedDeclarations = 'const'
    const value: es.Expression = create.callExpression(
      create.memberExpression(create.memberExpression(globalIds.native, 'gpu'), 'get'),
      [create.literal(key)]
    )
    return create.declaration(name, kind, value)
  })
}
