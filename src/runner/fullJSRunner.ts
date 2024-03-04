/* eslint-disable @typescript-eslint/no-unused-vars */
import { generate } from 'astring'
import type * as es from 'estree'
import { RawSourceMap } from 'source-map'

import type { Result } from '..'
import { NATIVE_STORAGE_ID } from '../constants'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { hoistAndMergeImports } from '../localImports/transformers/hoistAndMergeImports'
import { ImportTransformOptions } from '../modules/moduleTypes'
import { getRequireProvider, RequireProvider } from '../modules/requireProvider'
import { parse } from '../parser/parser'
import {
  evallerReplacer,
  getBuiltins,
  getGloballyDeclaredIdentifiers,
  transpile
} from '../transpiler/transpiler'
import type { Context, NativeStorage } from '../types'
import * as create from '../utils/astCreator'
import { getFunctionDeclarationNamesInProgram } from '../utils/uniqueIds'
import { toSourceError } from './errors'
import { resolvedErrorPromise } from './utils'

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
  importOptions: ImportTransformOptions
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

  // evaluate and create a separate block for preludes and builtins
  const preEvalProgram: es.Program = create.program([
    ...preludeAndBuiltins,
    evallerReplacer(create.identifier(NATIVE_STORAGE_ID), new Set())
  ])
  getFunctionDeclarationNamesInProgram(preEvalProgram).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id)
  )
  getGloballyDeclaredIdentifiers(preEvalProgram).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id)
  )
  const preEvalCode: string = generate(preEvalProgram)
  const requireProvider = getRequireProvider(context)
  await fullJSEval(preEvalCode, requireProvider, context.nativeStorage)

  let transpiled
  let sourceMapJson: RawSourceMap | undefined
  try {
    ;({ transpiled, sourceMapJson } = await transpile(program, context, importOptions))
    return {
      status: 'finished',
      context,
      value: await fullJSEval(transpiled, requireProvider, context.nativeStorage)
    }
  } catch (error) {
    context.errors.push(
      error instanceof RuntimeSourceError ? error : await toSourceError(error, sourceMapJson)
    )
    return resolvedErrorPromise
  }
}
