import { parse } from 'acorn'
import { generate } from 'astring'
import * as es from 'estree'
import { SourceMapGenerator } from 'source-map'

import { IOptions, Result } from '..'
import { ExceptionError } from '../errors/errors'
import { appendModuleTabsToContext } from '../modules/moduleLoader'
import {
  getGloballyDeclaredIdentifiers,
  prefixModule,
  transformImportDeclarations
} from '../transpiler/transpiler'
import { Context } from '../types'
import { NativeStorage } from './../types'
import { toSourceError } from './errors'
import { appendModulesToContext, resolvedErrorPromise } from './utils'

export function isFullJSChapter(context: Context): boolean {
  return context.chapter === -1
}

function simpleEval(code: string, nativeStorage: NativeStorage, moduleParams: any) {
  if (nativeStorage.evaller === null) {
    return eval(code)
  } else {
    return nativeStorage.evaller(code)
  }
}

export async function fullJSRunner(
  code: string,
  context: Context,
  options: Partial<IOptions> = {}
): Promise<Result> {
  const map = new SourceMapGenerator({ file: 'source' })
  try {
    // used 'acorn' instead of 'acorn-loose' to get `SyntaxError`s reported
    const program = parse(code, {
      ecmaVersion: 2015,
      sourceType: 'module',
      locations: true,
      allowImportExportEverywhere: true
    }) as unknown as es.Program
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
    const transpiled = modulePrefix + generate(program, { sourceMap: map })
    const value = await simpleEval(transpiled, context.nativeStorage, options)
    return Promise.resolve({ status: 'finished', context, value: value })
  } catch (error) {
    context.errors.push(
      new ExceptionError(error, (await toSourceError(error, map.toJSON())).location)
    )
    return resolvedErrorPromise
  }
}
