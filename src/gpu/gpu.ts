import * as es from 'estree'

import * as create from '../utils/astCreator'
import { getIdentifiersInProgram } from '../utils/uniqueIds'
import GPUTransformer from './transfomer'

// top-level gpu functions that call our code

// transpiles if possible and modifies program to a Source program that makes use of the GPU primitives
export function transpileToGPU(program: es.Program) {
  const identifiers = getIdentifiersInProgram(program)
  if (identifiers.has('__createKernelSource') || identifiers.has('__clearKernelCache')) {
    program.body.unshift(
      create.expressionStatement(
        create.callExpression(
          create.identifier('display'),
          [
            create.literal(
              'Manual use of GPU library symbols detected, turning off automatic GPU optimizations.'
            )
          ],
          {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 }
          }
        )
      )
    )
    return
  }

  const transformer = new GPUTransformer(program, create.identifier('__createKernelSource'))
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
          create.callExpression(create.identifier('display'), [create.literal(debug)], {
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 }
          })
        )
      )
    }
  }

  const clearKernelCacheStatement = create.expressionStatement(
    create.callExpression(create.identifier('__clearKernelCache'), [], {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 }
    })
  )

  program.body = [...gpuDisplayStatements, clearKernelCacheStatement, ...program.body]
}
