/* eslint-disable @typescript-eslint/no-unused-vars */
import { Options, parse } from 'acorn'
import { generate } from 'astring'
import * as es from 'estree'
import { RawSourceMap } from 'source-map'

import { IOptions, Result } from '..'
import { NATIVE_STORAGE_ID } from '../constants'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { hoistAndMergeImports } from '../localImports/transformers/hoistAndMergeImports'
import { FatalSyntaxError } from '../parser/parser'
import { evallerReplacer, getBuiltins, transpile } from '../transpiler/transpiler'
import type { Context } from '../types'
import * as create from '../utils/astCreator'
import { toSourceError } from './errors'
import { appendModulesToContext, resolvedErrorPromise } from './utils'

const FULL_JS_PARSER_OPTIONS: Options = {
  sourceType: 'module',
  ecmaVersion: 'latest',
  locations: true
}

/**
 * Parse code string into AST
 * - any errors in the process of parsing will be added to the context
 *
 * @param code
 * @param context
 * @returns AST of code if there are no syntax errors, otherwise undefined
 */
function parseFullJS(code: string, context: Context): es.Program | undefined {
  let program: es.Program | undefined
  try {
    program = parse(code, FULL_JS_PARSER_OPTIONS) as unknown as es.Program
  } catch (error) {
    if (error instanceof SyntaxError) {
      const loc = (error as any).loc
      const location = {
        start: { line: loc.line, column: loc.column },
        end: { line: loc.line, column: loc.column + 1 }
      }
      context.errors.push(new FatalSyntaxError(location, error.toString()))
    }
  }

  return program
}

function fullJSEval(code: string, { nativeStorage, ...ctx }: Context): any {
  if (nativeStorage.evaller) {
    return nativeStorage.evaller(code)
  } else {
    return eval(code)
  }
}

function preparePrelude(context: Context): es.Statement[] {
  if (context.prelude === null) {
    return []
  }
  const prelude = context.prelude
  context.prelude = null
  const program: es.Program = parseFullJS(prelude, context)!

  return program.body as es.Statement[]
}

function containsPrevEval(context: Context): boolean {
  return context.nativeStorage.evaller != null
}

export async function fullJSRunner(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  // parse + check for syntax errors
  const program: es.Program | undefined = parseFullJS(code, context)
  if (!program) {
    return resolvedErrorPromise
  }

  // prelude & builtins
  // only process builtins and preludes if it is a fresh eval context
  const preludeAndBuiltins: es.Statement[] = containsPrevEval(context)
    ? []
    : [...getBuiltins(context.nativeStorage), ...preparePrelude(context)]

  // modules
  hoistAndMergeImports(program)
  appendModulesToContext(program, context)

  // evaluate and create a separate block for preludes and builtins
  const preEvalProgram: es.Program = create.program([
    ...preludeAndBuiltins,
    evallerReplacer(create.identifier(NATIVE_STORAGE_ID), new Set())
  ])
  const preEvalCode: string = generate(preEvalProgram)
  await fullJSEval(preEvalCode, context)

  let transpiled
  let sourceMapJson: RawSourceMap | undefined
  try {
    ;({ transpiled, sourceMapJson } = transpile(program, context))
    return Promise.resolve({
      status: 'finished',
      context,
      value: await fullJSEval(transpiled, context)
    })
  } catch (error) {
    context.errors.push(
      error instanceof RuntimeSourceError ? error : await toSourceError(error, sourceMapJson)
    )
    return resolvedErrorPromise
  }
}
