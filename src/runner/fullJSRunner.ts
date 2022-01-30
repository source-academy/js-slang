import { parse } from 'acorn-loose'
import { generate } from 'astring'
import * as es from 'estree'
import { SourceMapGenerator } from 'source-map'

import { IOptions, Result } from '..'
import { ExceptionError } from '../errors/errors'
import { appendModuleTabsToContext } from '../modules/moduleLoader'
import { createAcornParserOptions } from '../parser/parser'
// import { sandboxedEval } from '../transpiler/evalContainer'
import {
  getGloballyDeclaredIdentifiers,
  prefixModule,
  transformImportDeclarations
} from '../transpiler/transpiler'
import { Context } from '../types'
import { getEvalErrorLocation } from '../utils/evalErrorLocator'
import { NativeStorage } from './../types'
import { appendModulesToContext, resolvedErrorPromise } from './utils'

export function isFullJSChapter(context: Context): boolean {
  return context.chapter === -1
}
function simpleEval(code: string, nativeStorage: NativeStorage, moduleParams: any) {
  console.log('simple eval(((')
  console.log(code)
  console.log('))))')
  return (nativeStorage.evaller ?? eval)(code)
}

export async function fullJSRunner(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  const program: es.Program | undefined = parse(code, createAcornParserOptions(context))
  appendModulesToContext(program, context)
  appendModuleTabsToContext(program, context)
  if (context.prelude !== null) {
    const prelude = context.prelude
    context.prelude = null
    await fullJSRunner(prelude, context, { ...options, isPrelude: true })
    return fullJSRunner(code, context, options)
  }
  const modulePrefix = prefixModule(program)
  transformImportDeclarations(program)
  getGloballyDeclaredIdentifiers(program).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id)
  )
  const map = new SourceMapGenerator({ file: 'source' })
  const transpiled = modulePrefix + generate(program, { sourceMap: map })
  try {
    const value = await simpleEval(transpiled, context.nativeStorage, options)
    return Promise.resolve({ status: 'finished', context, value: value })
  } catch (error) {
    context.errors.push(new ExceptionError(error, getEvalErrorLocation(error)))
    return resolvedErrorPromise
  }
}
