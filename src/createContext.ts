// Variable determining chapter of Source is contained in this file.

import { GLOBAL, GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE } from './constants'
import { AsyncScheduler } from './schedulers'
import * as interpreterLazyList from './stdlib/interpreterLazyList'
import * as interpreterLazyTypeCheck from './stdlib/interpreterLazyTypeCheck'
import * as transpilerLazy from './transpiler/lazyTranspiler'
import * as transpilerLazyList from './stdlib/transpilerLazyList'
import * as transpilerLazyTypeCheck from './stdlib/transpilerLazyTypeCheck'
import * as lazyAuto from './stdlib/lazyAuto'
import * as list from './stdlib/list'
import { list_to_vector } from './stdlib/list'
import { listPrelude } from './stdlib/list.prelude'
import * as misc from './stdlib/misc'
import * as parser from './stdlib/parser'
import * as stream from './stdlib/stream'
import { streamPrelude } from './stdlib/stream.prelude'
import { Context, CustomBuiltIns, Value } from './types'
import * as lazyOperators from './utils/lazyOperators'
import * as operators from './utils/operators'
import { stringify } from './utils/stringify'
import lazyEvaluate, {
  lazyEvaluateInChapter,
  lazyEvaluateInTranspiler,
  lazyEvaluateInInterpreter,
  lazyEvaluateInSource1,
  lazyEvaluateAuto
} from './lazyContext'

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
    it: (function*(): any {
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

export const createEmptyContext = <T>(
  chapter: number,
  externalSymbols: string[],
  externalContext?: T
): Context<T> => {
  if (!Array.isArray(GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE])) {
    GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE] = []
  }
  const operatorsToUse = lazyEvaluateInChapter(chapter) ? lazyOperators : operators
  const length = GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE].push({
    globals: { variables: new Map(), previousScope: null },
    operators: new Map(Object.entries(operatorsToUse))
  })
  return {
    chapter,
    externalSymbols,
    errors: [],
    externalContext,
    runtime: createEmptyRuntime(),
    numberOfOuterEnvironments: 1,
    prelude: null,
    debugger: createEmptyDebugger(),
    contextId: length - 1,
    executionMethod: 'auto'
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
  GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE][context.contextId].globals.variables.set(name, {
    kind: 'const',
    getValue: () => value
  })
}

// Defines a builtin in the given context
// If the builtin is a function, wrap it such that its toString hides the implementation
export const defineBuiltin = (context: Context, name: string, value: Value) => {
  if (typeof value === 'function') {
    const wrapped = (...args: any) => value(...args)
    const funName = name.split('(')[0].trim()
    const repr = `function ${name} {\n\t[implementation hidden]\n}`
    wrapped.toString = () => repr

    defineSymbol(context, funName, wrapped)
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
  const display = (v: Value, s: string) => (rawDisplay(stringify(v), s), v)
  const prompt = (v: Value) => externalBuiltIns.prompt(v, '', context.externalContext)
  const alert = (v: Value) => externalBuiltIns.alert(v, '', context.externalContext)
  const visualiseList = (v: Value) => externalBuiltIns.visualiseList(v, context.externalContext)

  if (context.chapter >= 1) {
    defineBuiltin(context, 'runtime()', misc.runtime)
    defineBuiltin(context, 'display(val)', display)
    defineBuiltin(context, 'raw_display(str)', rawDisplay)
    defineBuiltin(context, 'stringify(val)', stringify)
    defineBuiltin(context, 'error(str)', misc.error_message)
    defineBuiltin(context, 'prompt(str)', prompt)
    if (!lazyEvaluate(context)) {
      defineBuiltin(context, 'is_number(val)', misc.is_number)
      defineBuiltin(context, 'is_string(val)', misc.is_string)
      defineBuiltin(context, 'is_function(val)', misc.is_function)
      defineBuiltin(context, 'is_boolean(val)', misc.is_boolean)
      defineBuiltin(context, 'is_undefined(val)', misc.is_undefined)
      defineBuiltin(context, 'parse_int(str, radix)', misc.parse_int)
    } else if (lazyEvaluateInTranspiler(context)) {
      // Uses Transpiler (Lazy)
      defineBuiltin(
        context,
        transpilerLazy.nameOfForceFunction + '(expression)',
        transpilerLazy.force
      )
      defineBuiltin(
        context,
        transpilerLazy.nameOfForceOnceFunction + '(expression)',
        transpilerLazy.force_once
      )
      defineBuiltin(
        context,
        transpilerLazy.nameOfForcePairFunction + '(expression)',
        transpilerLazy.force_pair
      )
      // source 1 primitive functions
      defineBuiltin(context, 'is_thunk(val)', transpilerLazy.is_thunk)
      defineBuiltin(context, 'is_number(val)', transpilerLazyTypeCheck.is_number)
      defineBuiltin(context, 'is_string(val)', transpilerLazyTypeCheck.is_string)
      defineBuiltin(context, 'is_function(val)', transpilerLazyTypeCheck.is_function)
      defineBuiltin(context, 'is_boolean(val)', transpilerLazyTypeCheck.is_boolean)
      defineBuiltin(context, 'is_undefined(val)', transpilerLazyTypeCheck.is_undefined)
      defineBuiltin(context, 'parse_int(str, radix)', (str: Value, radix: Value) =>
        misc.parse_int(transpilerLazy.force(str), transpilerLazy.force(radix))
      )
    } else if (lazyEvaluateInInterpreter(context)) {
      // Uses Interpreter (Lazy)
      defineBuiltin(context, 'force(expression)', interpreterLazyTypeCheck.force)
      defineBuiltin(context, 'force_once(expression)', interpreterLazyTypeCheck.force_once)
      defineBuiltin(context, 'force_pair(expression)', interpreterLazyTypeCheck.force_pair)
      defineBuiltin(context, 'is_thunk(val)', interpreterLazyTypeCheck.is_thunk)
      defineBuiltin(context, 'is_number(val)', interpreterLazyTypeCheck.is_number)
      defineBuiltin(context, 'is_string(val)', interpreterLazyTypeCheck.is_string)
      defineBuiltin(context, 'is_function(val)', interpreterLazyTypeCheck.is_function)
      defineBuiltin(context, 'is_boolean(val)', interpreterLazyTypeCheck.is_boolean)
      defineBuiltin(context, 'is_undefined(val)', interpreterLazyTypeCheck.is_undefined)
      defineBuiltin(context, 'parse_int(str, radix)', interpreterLazyTypeCheck.parse_int)
    } else if (lazyEvaluateAuto(context)) {
      // have not determined which execution method will be used yet
      defineBuiltin(context, 'force(expression)', lazyAuto.force)
      defineBuiltin(context, 'force_once(expression)', lazyAuto.force_once)
      defineBuiltin(context, 'force_pair(expression)', lazyAuto.force_pair)
      defineBuiltin(context, 'is_thunk(val)', lazyAuto.is_thunk)
      defineBuiltin(context, 'is_number(val)', lazyAuto.is_number)
      defineBuiltin(context, 'is_string(val)', lazyAuto.is_string)
      defineBuiltin(context, 'is_function(val)', lazyAuto.is_function)
      defineBuiltin(context, 'is_boolean(val)', lazyAuto.is_boolean)
      defineBuiltin(context, 'is_undefined(val)', lazyAuto.is_undefined)
      defineBuiltin(context, 'parse_int(str, radix)', lazyAuto.parse_int)
    } else {
      // unknown execution method for lazy
      throw new Error('Unknown lazy evaluation method ' + context.executionMethod)
    }
    defineBuiltin(context, 'undefined', undefined)
    defineBuiltin(context, 'NaN', NaN)
    defineBuiltin(context, 'Infinity', Infinity)
    // Define all Math libraries
    const props = Object.getOwnPropertyNames(Math)
    for (const prop of props) {
      defineBuiltin(context, 'math_' + prop, Math[prop])
    }
  }

  if (context.chapter >= 2 && !lazyEvaluateInSource1(context.chapter)) {
    if (!lazyEvaluate(context)) {
      // List library
      defineBuiltin(context, 'pair(left, right)', list.pair)
      defineBuiltin(context, 'is_pair(val)', list.is_pair)
      defineBuiltin(context, 'head(xs)', list.head)
      defineBuiltin(context, 'tail(xs)', list.tail)
      defineBuiltin(context, 'is_null(val)', list.is_null)
      defineBuiltin(context, 'list(...values)', list.list)
      defineBuiltin(context, 'draw_data(xs)', visualiseList)
    } else if (lazyEvaluateInTranspiler(context)) {
      // lazy list library for transpiler
      defineBuiltin(context, 'pair(left, right)', transpilerLazyList.pair)
      defineBuiltin(context, 'is_pair(val)', transpilerLazyList.is_pair)
      defineBuiltin(context, 'head(xs)', transpilerLazyList.head)
      defineBuiltin(context, 'tail(xs)', transpilerLazyList.tail)
      defineBuiltin(context, 'is_null(val)', transpilerLazyTypeCheck.is_null)
      defineBuiltin(context, 'list(...values)', transpilerLazyList.list)
      defineBuiltin(context, 'draw_data(xs)', (v: Value) =>
        externalBuiltIns.visualiseList(transpilerLazy.force(v), context.externalContext)
      )
    } else if (lazyEvaluateInInterpreter(context)) {
      // lazy list library for interpreter
      defineBuiltin(context, 'pair(left, right)', interpreterLazyList.pair)
      defineBuiltin(context, 'is_pair(val)', interpreterLazyList.is_pair)
      defineBuiltin(context, 'head(xs)', interpreterLazyList.head)
      defineBuiltin(context, 'tail(xs)', interpreterLazyList.tail)
      defineBuiltin(context, 'is_null(val)', interpreterLazyList.is_null)
      defineBuiltin(context, 'list(...values)', interpreterLazyList.list)
      defineBuiltin(context, 'draw_data(xs)', visualiseList)
    } else if (lazyEvaluateAuto(context)) {
      // have not determined which execution method will be used yet
      defineBuiltin(context, 'pair(left, right)', lazyAuto.pair)
      defineBuiltin(context, 'is_pair(val)', lazyAuto.is_pair)
      defineBuiltin(context, 'head(xs)', lazyAuto.head)
      defineBuiltin(context, 'tail(xs)', lazyAuto.tail)
      defineBuiltin(context, 'is_null(val)', lazyAuto.is_null)
      defineBuiltin(context, 'list(...values)', lazyAuto.list)
      defineBuiltin(context, 'draw_data(xs)', (v: Value) =>
        lazyAuto.switchBetween(
          [v],
          (xs: Value) =>
            externalBuiltIns.visualiseList(transpilerLazy.force(xs), context.externalContext),
          visualiseList
        )
      )
    } else {
      // unknown execution method for lazy
      throw new Error('Unknown lazy evaluation method ' + context.executionMethod)
    }
  }

  // ensure Source 3 and above are eagerly evaluated
  if (!lazyEvaluate(context)) {
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
  }
}

function importPrelude(context: Context) {
  let prelude = ''
  if (context.chapter >= 2) {
    prelude += listPrelude
  }
  if (context.chapter >= 3) {
    prelude += streamPrelude
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
  externalSymbols: string[] = [],
  externalContext?: T,
  externalBuiltIns: CustomBuiltIns = defaultBuiltIns
) => {
  const context = createEmptyContext(chapter, externalSymbols, externalContext)

  importBuiltins(context, externalBuiltIns)
  importPrelude(context)
  importExternalSymbols(context, externalSymbols)

  return context
}

export default createContext
