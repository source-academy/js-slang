/* eslint-disable @typescript-eslint/no-unused-vars */
import { generate } from 'astring'
import type es from 'estree'
import { RawSourceMap } from 'source-map'

import type { Result } from '..'
import { NATIVE_STORAGE_ID } from '../constants'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { parse } from '../parser/parser'
import { evallerReplacer, getBuiltins, transpile } from '../transpiler/transpiler'
import type { Context, NativeStorage } from '../types'
import * as create from '../utils/ast/astCreator'
import { getDeclaredIdentifiers } from '../utils/ast/helpers'
import { toSourceError } from './errors'
import { resolvedErrorPromise } from './utils'

function fullJSEval(code: string, nativeStorage: NativeStorage): any {
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

export async function fullJSRunner(program: es.Program, context: Context): Promise<Result> {
  // prelude & builtins
  // only process builtins and preludes if it is a fresh eval context
  const prelude = preparePrelude(context)
  if (prelude === undefined) {
    return resolvedErrorPromise
  }
  const preludeAndBuiltins: es.Statement[] = containsPrevEval(context)
    ? []
    : [...getBuiltins(context.nativeStorage), ...prelude]

  // evaluate and create a separate block for preludes and builtins
  const preEvalProgram: es.Program = create.program([
    ...preludeAndBuiltins,
    evallerReplacer(create.identifier(NATIVE_STORAGE_ID), new Set())
  ])
  getDeclaredIdentifiers(preEvalProgram).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id.name)
  )

  const preEvalCode: string = generate(preEvalProgram)
  await fullJSEval(preEvalCode, context.nativeStorage)

  let transpiled
  let sourceMapJson: RawSourceMap | undefined
  try {
    ;({ transpiled, sourceMapJson } = transpile(program, context))
    return {
      status: 'finished',
      context,
      value: await fullJSEval(transpiled, context.nativeStorage)
    }
  } catch (error) {
    context.errors.push(
      error instanceof RuntimeSourceError ? error : await toSourceError(error, sourceMapJson)
    )
    return resolvedErrorPromise
  }
}
