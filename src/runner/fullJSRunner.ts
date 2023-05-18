/* eslint-disable @typescript-eslint/no-unused-vars */
import { generate } from 'astring'
import * as es from 'estree'
import { RawSourceMap } from 'source-map'

import { IOptions, Result } from '..'
import { NATIVE_STORAGE_ID } from '../constants'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { hoistAndMergeImports } from '../localImports/transformers/hoistAndMergeImports'
import { getRequireProvider, RequireProvider } from '../modules/requireProvider'
import { parse } from '../parser/parser'
import { evallerReplacer, getBuiltins, transpile } from '../transpiler/transpiler'
import type { Context, NativeStorage } from '../types'
import * as create from '../utils/astCreator'
import { toSourceError } from './errors'
import { appendModulesToContext, resolvedErrorPromise } from './utils'

function fullJSEval(
  code: string,
  requireProvider: RequireProvider,
  nativeStorage: NativeStorage
): any {
  if (nativeStorage.evaller) {
    return nativeStorage.evaller(code)
  } else {
    return eval(code)
  }
}

function preparePrelude(context: Context): es.Statement[] | undefined {
  if (context.prelude === null) {
    return []
  }
  const prelude = context.prelude
  context.prelude = null
  const program = parse(prelude, context)
  if (program === null) {
    return undefined
  }

  return program.body as es.Statement[]
}

function containsPrevEval(context: Context): boolean {
  return context.nativeStorage.evaller != null
}

export async function fullJSRunner(
  program: es.Program,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  // prelude & builtins
  // only process builtins and preludes if it is a fresh eval context
  const prelude = preparePrelude(context)
  if (prelude === undefined) {
    return resolvedErrorPromise
  }
  const preludeAndBuiltins: es.Statement[] = containsPrevEval(context)
    ? []
    : [...getBuiltins(context.nativeStorage), ...prelude]

  // modules
  hoistAndMergeImports(program)
  appendModulesToContext(program, context)

  // evaluate and create a separate block for preludes and builtins
  const preEvalProgram: es.Program = create.program([
    ...preludeAndBuiltins,
    evallerReplacer(create.identifier(NATIVE_STORAGE_ID), new Set())
  ])
  const preEvalCode: string = generate(preEvalProgram)
  const requireProvider = getRequireProvider(context)
  await fullJSEval(preEvalCode, requireProvider, context.nativeStorage)

  let transpiled
  let sourceMapJson: RawSourceMap | undefined
  try {
    ;({ transpiled, sourceMapJson } = transpile(program, context))
    return Promise.resolve({
      status: 'finished',
      context,
      value: await fullJSEval(transpiled, requireProvider, context.nativeStorage)
    })
  } catch (error) {
    context.errors.push(
      error instanceof RuntimeSourceError ? error : await toSourceError(error, sourceMapJson)
    )
    return resolvedErrorPromise
  }
}
