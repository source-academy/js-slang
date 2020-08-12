// Variable determining chapter of Source is contained in this file.

import { GLOBAL, JSSLANG_PROPERTIES } from './constants'
import { AsyncScheduler } from './schedulers'
import * as list from './stdlib/list'
import { list_to_vector } from './stdlib/list'
import { listPrelude } from './stdlib/list.prelude'
import { nonDetPrelude } from './stdlib/non-det.prelude'
import * as misc from './stdlib/misc'
import * as parser from './stdlib/parser'
import * as stream from './stdlib/stream'
import { streamPrelude } from './stdlib/stream.prelude'
import { Context, CustomBuiltIns, Value, Variant } from './types'
import * as operators from './utils/operators'
import * as gpu_lib from './gpu/lib'
import { stringify } from './utils/stringify'
import { lazyListPrelude } from './stdlib/lazyList.prelude'
import { createTypeEnvironment, tForAll, tVar } from './typeChecker/typeChecker'
export class LazyBuiltIn {
  func: (...arg0: any) => any
  evaluateArgs: boolean
  constructor(func: (...arg0: any) => any, evaluateArgs: boolean) {
    this.func = func
    this.evaluateArgs = evaluateArgs
  }
}
const createEmptyRuntime = () => ({
  break: false,
  debuggerOn: true,
  isRunning: false,
  environments: [],
  value: undefined,
  nodes: []
})

const createEmptyDebugger = () => ({
  observers: { callbacks: Array<() => void>() },
  status: false,
  state: {
    it: (function* (): any {
      return
    })(),
    scheduler: new AsyncScheduler()
  }
})

const createGlobalEnvironment = () => ({
  tail: null,
  name: 'global',
  head: {}
})

const createNativeStorage = () => ({
  globals: { variables: new Map(), previousScope: null },
  operators: new Map(Object.entries(operators)),
  gpu: new Map(Object.entries(gpu_lib)),
  maxExecTime: JSSLANG_PROPERTIES.maxExecTime
})

export const createEmptyContext = <T>(
  chapter: number,
  variant: Variant = 'default',
  externalSymbols: string[],
  externalContext?: T,
  moduleParams?: any
): Context<T> => {
  return {
    chapter,
    externalSymbols,
    errors: [],
    externalContext,
    moduleParams,
    runtime: createEmptyRuntime(),
    numberOfOuterEnvironments: 1,
    prelude: null,
    debugger: createEmptyDebugger(),
    nativeStorage: createNativeStorage(),
    executionMethod: 'auto',
    variant,
    typeEnvironment: createTypeEnvironment(chapter)
  }
}

export const ensureGlobalEnvironmentExist = (context: Context) => {
  if (!context.runtime) {
    context.runtime = createEmptyRuntime()
  }
  if (!context.runtime.environments) {
    context.runtime.environments = []
  }
  if (context.runtime.environments.length === 0) {
    context.runtime.environments.push(createGlobalEnvironment())
  }
}

const defineSymbol = (context: Context, name: string, value: Value) => {
  const globalEnvironment = context.runtime.environments[0]
  Object.defineProperty(globalEnvironment.head, name, {
    value,
    writable: false,
    enumerable: true
  })
  context.nativeStorage.globals!.variables.set(name, {
    kind: 'const',
    getValue: () => value
  })
  const typeEnv = context.typeEnvironment[0]
  // if the global type env doesn't already have the imported symbol,
  // we set it to a type var T that can typecheck with anything.
  if (!typeEnv.declKindMap.has(name)) {
    typeEnv.typeMap.set(name, tForAll(tVar('T1')))
    typeEnv.declKindMap.set(name, 'const')
  }
}

// Defines a builtin in the given context
// If the builtin is a function, wrap it such that its toString hides the implementation
export const defineBuiltin = (context: Context, name: string, value: Value) => {
  if (typeof value === 'function') {
    const funName = name.split('(')[0].trim()
    const repr = `function ${name} {\n\t[implementation hidden]\n}`
    value.toString = () => repr
    value.hasVarArgs = name.includes('...') || name.includes('=')

    defineSymbol(context, funName, value)
  } else if (value instanceof LazyBuiltIn) {
    const wrapped = (...args: any) => value.func(...args)
    const funName = name.split('(')[0].trim()
    const repr = `function ${name} {\n\t[implementation hidden]\n}`
    wrapped.toString = () => repr
    defineSymbol(context, funName, new LazyBuiltIn(wrapped, value.evaluateArgs))
  } else {
    defineSymbol(context, name, value)
  }
}

export const importExternalSymbols = (context: Context, externalSymbols: string[]) => {
  ensureGlobalEnvironmentExist(context)

  externalSymbols.forEach(symbol => {
    defineSymbol(context, symbol, GLOBAL[symbol])
  })
}

/**
 * Imports builtins from standard and external libraries.
 */
export const importBuiltins = (context: Context, externalBuiltIns: CustomBuiltIns) => {
  ensureGlobalEnvironmentExist(context)
  const rawDisplay = (v: Value, s: string) =>
    externalBuiltIns.rawDisplay(v, s, context.externalContext)  
  const display = (v: Value, ...args: any) => {
    const s = args[0]
    if (args.length >= 1) {
      if (typeof s !== "string")
        throw new TypeError('display expects the second argument to be a string')
    }
    return rawDisplay(stringify(v), s), v
  }
  const prompt = (v: Value) => {
    const start = Date.now()
    const promptResult = externalBuiltIns.prompt(v, '', context.externalContext)
    context.nativeStorage.maxExecTime += Date.now() - start
    return promptResult
  }
  const alert = (v: Value) => {
    const start = Date.now()
    externalBuiltIns.alert(v, '', context.externalContext)
    context.nativeStorage.maxExecTime += Date.now() - start
  }
  const visualiseList = (v: Value) => externalBuiltIns.visualiseList(v, context.externalContext)

  if (context.chapter >= 1) {
    defineBuiltin(context, 'get_time()', misc.get_time)
    defineBuiltin(context, 'display(val, prepend = undefined)', display)
    defineBuiltin(context, 'raw_display(str, prepend = undefined)', rawDisplay)
    defineBuiltin(context, 'stringify(val, indent = 2, maxLineLength = 80)', stringify)
    defineBuiltin(context, 'error(str, prepend = undefined)', misc.error_message)
    defineBuiltin(context, 'prompt(str)', prompt)
    defineBuiltin(context, 'is_number(val)', misc.is_number)
    defineBuiltin(context, 'is_string(val)', misc.is_string)
    defineBuiltin(context, 'is_function(val)', misc.is_function)
    defineBuiltin(context, 'is_boolean(val)', misc.is_boolean)
    defineBuiltin(context, 'is_undefined(val)', misc.is_undefined)
    defineBuiltin(context, 'parse_int(str, radix)', misc.parse_int)
    defineBuiltin(context, 'undefined', undefined)
    defineBuiltin(context, 'NaN', NaN)
    defineBuiltin(context, 'Infinity', Infinity)
    // Define all Math libraries
    const mathLibraryNames = Object.getOwnPropertyNames(Math)
    // Short param names for stringified version of math functions
    const parameterNames = [...'abcdefghijklmnopqrstuvwxyz']
    for (const name of mathLibraryNames) {
      const value = Math[name]
      if (typeof value === 'function') {
        let paramString: string
        if (name === 'max' || 'min') {
          paramString = '...values'
        } else {
          paramString = parameterNames.slice(0, value.length).join(', ')
        }
        defineBuiltin(context, `math_${name}(${paramString})`, value)
      } else {
        defineBuiltin(context, `math_${name}`, value)
      }
    }
  }

  if (context.chapter >= 2) {
    // List library

    if (context.variant === 'lazy') {
      defineBuiltin(context, 'pair(left, right)', new LazyBuiltIn(list.pair, false))
      defineBuiltin(context, 'list(...values)', new LazyBuiltIn(list.list, false))
      defineBuiltin(context, 'is_pair(val)', new LazyBuiltIn(list.is_pair, true))
      defineBuiltin(context, 'head(xs)', new LazyBuiltIn(list.head, true))
      defineBuiltin(context, 'tail(xs)', new LazyBuiltIn(list.tail, true))
      defineBuiltin(context, 'is_null(val)', new LazyBuiltIn(list.is_null, true))
      defineBuiltin(context, 'draw_data(xs)', new LazyBuiltIn(visualiseList, true))
    } else {
      defineBuiltin(context, 'pair(left, right)', list.pair)
      defineBuiltin(context, 'is_pair(val)', list.is_pair)
      defineBuiltin(context, 'head(xs)', list.head)
      defineBuiltin(context, 'tail(xs)', list.tail)
      defineBuiltin(context, 'is_null(val)', list.is_null)
      defineBuiltin(context, 'list(...values)', list.list)
      defineBuiltin(context, 'draw_data(xs)', visualiseList)
    }
  }

  if (context.chapter >= 3) {
    defineBuiltin(context, 'set_head(xs, val)', list.set_head)
    defineBuiltin(context, 'set_tail(xs, val)', list.set_tail)
    defineBuiltin(context, 'array_length(arr)', misc.array_length)
    defineBuiltin(context, 'is_array(val)', misc.is_array)

    // Stream library
    defineBuiltin(context, 'stream_tail(stream)', stream.stream_tail)
    defineBuiltin(context, 'stream(...values)', stream.stream)
    defineBuiltin(context, 'list_to_stream(xs)', stream.list_to_stream)
  }

  if (context.chapter >= 4) {
    defineBuiltin(context, 'parse(program_string)', (str: string) =>
      parser.parse(str, createContext(context.chapter))
    )
    defineBuiltin(
      context,
      'apply_in_underlying_javascript(fun, args)',
      // tslint:disable-next-line:ban-types
      (fun: Function, args: Value) => fun.apply(fun, list_to_vector(args))
    )

    if (context.variant === 'gpu') {
      defineBuiltin(context, '__clearKernelCache()', gpu_lib.__clearKernelCache)
      defineBuiltin(
        context,
        '__createKernelSource(shape, extern, localNames, output, fun, kernelId)',
        gpu_lib.__createKernelSource
      )
    }
  }

  if (context.chapter >= 100) {
    defineBuiltin(context, 'is_object(val)', misc.is_object)
    defineBuiltin(context, 'is_NaN(val)', misc.is_NaN)
    defineBuiltin(context, 'has_own_property(obj, prop)', misc.has_own_property)
    defineBuiltin(context, 'alert(val)', alert)
    // tslint:disable-next-line:ban-types
    defineBuiltin(context, 'timed(fun)', (f: Function) =>
      misc.timed(context, f, context.externalContext, externalBuiltIns.rawDisplay)
    )
  }

  if (context.variant === 'lazy') {
    defineBuiltin(context, 'wrapLazyCallee(f)', new LazyBuiltIn(operators.wrapLazyCallee, true))
    defineBuiltin(context, 'makeLazyFunction(f)', new LazyBuiltIn(operators.makeLazyFunction, true))
    defineBuiltin(context, 'forceIt(val)', new LazyBuiltIn(operators.forceIt, true))
    defineBuiltin(context, 'delayIt(xs)', new LazyBuiltIn(operators.delayIt, true))
  }
}

function importPrelude(context: Context) {
  let prelude = ''
  if (context.chapter >= 2) {
    prelude += context.variant === 'lazy' ? lazyListPrelude : listPrelude
  }
  if (context.chapter >= 3) {
    prelude += streamPrelude
  }

  if (context.variant === 'non-det') {
    prelude += nonDetPrelude
  }

  if (prelude !== '') {
    context.prelude = prelude
  }
}

const defaultBuiltIns: CustomBuiltIns = {
  rawDisplay: misc.rawDisplay,
  // See issue #5
  prompt: misc.rawDisplay,
  // See issue #11
  alert: misc.rawDisplay,
  visualiseList: (v: Value) => {
    throw new Error('List visualizer is not enabled')
  }
}

const createContext = <T>(
  chapter = 1,
  variant: Variant = 'default',
  externalSymbols: string[] = [],
  externalContext?: T,
  externalBuiltIns: CustomBuiltIns = defaultBuiltIns,
  moduleParams?: any
) => {
  const context = createEmptyContext(
    chapter,
    variant,
    externalSymbols,
    externalContext,
    moduleParams
  )

  importBuiltins(context, externalBuiltIns)
  importPrelude(context)
  importExternalSymbols(context, externalSymbols)

  return context
}

export default createContext
