import { parse } from 'acorn'
import { generate } from 'astring'
import * as es from 'estree'
import { SourceMapGenerator } from 'source-map'

import { IOptions, Result } from '..'
import { MODULE_PARAMS_ID } from '../constants'
import { ExceptionError } from '../errors/errors'
import { appendModuleTabsToContext, memoizedGetModuleFile } from '../modules/moduleLoader'
import {
  getGloballyDeclaredIdentifiers,
  transformImportDeclarations
} from '../transpiler/transpiler'
import { Context } from '../types'
import { NativeStorage } from './../types'
import { toSourceError } from './errors'
import { appendModulesToContext, resolvedErrorPromise } from './utils'

export function isFullJSChapter(context: Context): boolean {
  return context.chapter === -1
}

function getModuleObj(program: es.Program, moduleParams?: any): Object {
  let moduleCounter = 0
  const prefix = {}
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') {
      break
    }
    const moduleText = memoizedGetModuleFile(node.source.value as string, 'bundle').trim()
    // remove ; from moduleText
    prefix[`__MODULE_${moduleCounter}__`] = eval(
      `(${moduleText.substring(0, moduleText.length - 1)})(${MODULE_PARAMS_ID});`
    )
    moduleCounter++
  }
  return prefix
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
      locations: true
    }) as unknown as es.Program

    appendModulesToContext(program, context)
    appendModuleTabsToContext(program, context)

    if (context.prelude !== null) {
      const prelude = context.prelude
      context.prelude = null
      await fullJSRunner(prelude, context, { ...options, isPrelude: true })
      return fullJSRunner(code, context, options)
    }

    const prefixobj = getModuleObj(program, options)
    transformImportDeclarations(program, true)
    getGloballyDeclaredIdentifiers(program).forEach(id =>
      context.nativeStorage.previousProgramsIdentifiers.add(id)
    )

    const transpiled = generate(program, { sourceMap: map })
    const value = await simpleEval.call(prefixobj, transpiled, context.nativeStorage, options)
    return Promise.resolve({ status: 'finished', context, value })
  } catch (error) {
    context.errors.push(
      new ExceptionError(error, (await toSourceError(error, map.toJSON())).location)
    )
    return resolvedErrorPromise
  }
}
