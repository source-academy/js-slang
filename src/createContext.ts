import { stringify } from './interop'
import { AsyncScheduler } from './schedulers'
import * as list from './stdlib/list'
import { list_to_vector } from './stdlib/list'
import * as misc from './stdlib/misc'
import * as parser from './stdlib/parser'
import { Context, CustomBuiltIns, Value } from './types'

const GLOBAL = typeof window === 'undefined' ? global : window

const createEmptyRuntime = () => ({
  break: false,
  isRunning: false,
  frames: [],
  value: undefined,
  nodes: []
})

const createEmptyDebugger = () => ({
  observers: { callbacks: Array<() => void>() },
  status: false,
  state: {
    it: (function*(): any { return })(),
    scheduler: new AsyncScheduler()
  }
})

const createGlobalFrame = () => ({
  parent: null,
  name: 'global',
  environment: {}
})

export const createEmptyContext = <T>(
  chapter: number,
  externalSymbols: string[],
  externalContext?: T
): Context<T> => ({
  chapter,
  externalSymbols,
  errors: [],
  externalContext,
  runtime: createEmptyRuntime(),
  debugger: createEmptyDebugger()
})

export const ensureGlobalEnvironmentExist = (context: Context) => {
  if (!context.runtime) {
    context.runtime = createEmptyRuntime()
  }
  if (!context.runtime.frames) {
    context.runtime.frames = []
  }
  if (context.runtime.frames.length === 0) {
    context.runtime.frames.push(createGlobalFrame())
  }
}

const defineSymbol = (context: Context, name: string, value: Value) => {
  const globalFrame = context.runtime.frames[0]
  Object.defineProperty(globalFrame.environment, name, {
    value,
    writable: false,
    enumerable: true
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

  const rawDisplay = (v: Value) => externalBuiltIns.rawDisplay(v, context.externalContext)
  const display = (v: Value) => (rawDisplay(stringify(v)), v)
  const prompt = (v: Value) => externalBuiltIns.prompt(v, context.externalContext)
  const alert = (v: Value) => externalBuiltIns.alert(v, context.externalContext)
  const visualiseList = (v: Value) => externalBuiltIns.visualiseList(v, context.externalContext)

  if (context.chapter >= 1) {
    defineBuiltin(context, 'runtime()', misc.runtime)
    defineBuiltin(context, 'display(val)', display)
    defineBuiltin(context, 'raw_display(str)', rawDisplay)
    defineBuiltin(context, 'stringify(val)', stringify)
    defineBuiltin(context, 'error(str)', misc.error_message)
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
    const props = Object.getOwnPropertyNames(Math)
    for (const prop of props) {
      defineBuiltin(context, 'math_' + prop, Math[prop])
    }
  }

  if (context.chapter >= 2) {
    // List library
    defineBuiltin(context, 'null', null)
    defineBuiltin(context, 'pair(left, right)', list.pair)
    defineBuiltin(context, 'is_pair(val)', list.is_pair)
    defineBuiltin(context, 'head(xs)', list.head)
    defineBuiltin(context, 'tail(xs)', list.tail)
    defineBuiltin(context, 'is_null(val)', list.is_null)
    defineBuiltin(context, 'is_list(val)', list.is_list)
    defineBuiltin(context, 'list(...values)', list.list)
    defineBuiltin(context, 'length(xs)', list.length)
    defineBuiltin(context, 'map(fun, xs)', list.map)
    defineBuiltin(context, 'build_list(n, fun)', list.build_list)
    defineBuiltin(context, 'for_each(fun, xs)', list.for_each)
    defineBuiltin(context, 'list_to_string(xs)', list.list_to_string)
    defineBuiltin(context, 'reverse(xs)', list.reverse)
    defineBuiltin(context, 'append(xs, ys)', list.append)
    defineBuiltin(context, 'member(val, xs)', list.member)
    defineBuiltin(context, 'remove(val, xs)', list.remove)
    defineBuiltin(context, 'remove_all(val, xs)', list.remove_all)
    defineBuiltin(context, 'filter(pred, xs)', list.filter)
    defineBuiltin(context, 'enum_list(start, end)', list.enum_list)
    defineBuiltin(context, 'list_ref(xs, n)', list.list_ref)
    defineBuiltin(context, 'accumulate(fun, initial, xs)', list.accumulate)
    defineBuiltin(context, 'equal(value1, value2)', list.equal)
    defineBuiltin(context, 'draw_list(xs)', visualiseList)
  }

  if (context.chapter >= 3) {
    defineBuiltin(context, 'set_head(xs, val)', list.set_head)
    defineBuiltin(context, 'set_tail(xs, val)', list.set_tail)
    defineBuiltin(context, 'array_length(arr)', misc.array_length)
    defineBuiltin(context, 'is_array(val)', misc.is_array)
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
    defineBuiltin(context, 'assoc(val, xs)', list.assoc)
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
  importExternalSymbols(context, externalSymbols)

  return context
}

export default createContext
