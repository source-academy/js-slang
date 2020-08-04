import GPUTransformer from './transfomer'
import * as create from '../utils/astCreator'
import * as es from 'estree'
import { NativeIds } from '../transpiler/transpiler'

// top-level gpu functions that call our code

// transpiles if possible and returns display statements to end user
export function transpileToGPU(program: es.Program, globalIds: NativeIds) {
  const transformer = new GPUTransformer(program, globalIds.__createKernel)
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
          create.callExpression(
            create.identifier('display'),
            [create.literal(debug)],
            create.locationDummyNode(0, 0).loc!
          )
        )
      )
    }
  }

  program.body = [...gpuDisplayStatements, ...program.body]
}
