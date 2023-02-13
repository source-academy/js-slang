import { parse } from 'acorn'
// import { generate } from 'astring'
import * as es from 'estree'

import { ACORN_PARSE_OPTIONS } from '../constants'
// import { TypeError } from '../utils/rttc'
// import { gpuRuntimeTranspile } from './transfomer'

export function test(
  end: number[],
  externSource: [string, any][],
  localNames: string[],
  arr: any,
  f: any
  // kernelId: number
) {
  console.log('end:', end)
  console.log('externSource:', externSource)
  console.log('localNames:', localNames)
  console.log('arr:', arr)
  console.log('f:', f)
  const code = f.toString()
  console.log(code)
  // const extern = entriesToObject(externSource)

  // const memoizedf = kernels.get(kernelId)
  // if (memoizedf !== undefined) {
  //   return __createKernel(end, extern, memoizedf, arr, f)
  // }

  // const code = f.toString()
  // // We don't need the full source parser here because it's already validated at transpile time.
  const ast = parse(code, ACORN_PARSE_OPTIONS) as unknown as es.Program
  console.log(ast)
  // const body = (ast.body[0] as es.ExpressionStatement).expression as es.ArrowFunctionExpression
  // const newBody = gpuRuntimeTranspile(body, new Set(localNames))
  // const kernel = new Function(generate(newBody))

  // kernels.set(kernelId, kernel)

  // return __createKernel(end, extern, kernel, arr, f)
}
