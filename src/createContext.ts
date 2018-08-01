import Parser from 'jison'

import * as list from './stdlib/list'
import * as misc from './stdlib/misc'
import { Context, CustomBuiltIns, Value } from './types'
import { toString } from '.';

const GLOBAL = typeof window === 'undefined' ? global : window

const createEmptyCFG = () => ({
  nodes: {},
  edges: {},
  scopes: []
})

const createEmptyRuntime = () => ({
  isRunning: false,
  frames: [],
  value: undefined,
  nodes: []
})

export const createEmptyContext = <T>(chapter: number, externalSymbols: string[], externalContext?: T): Context<T> => ({
  chapter,
  externalSymbols,
  errors: [],
  externalContext,
  cfg: createEmptyCFG(),
  runtime: createEmptyRuntime(),
  metaCircularParser: new Parser()
})

export const ensureGlobalEnvironmentExist = (context: Context) => {
  if (!context.runtime) {
    context.runtime = createEmptyRuntime()
  }
  if (!context.runtime.frames) {
    context.runtime.frames = []
  }
  if (context.runtime.frames.length === 0) {
    context.runtime.frames.push({
      parent: null,
      name: 'global',
      environment: {}
    })
  }
}

const defineSymbol = (context: Context, name: string, value: Value) => {
  const globalFrame = context.runtime.frames[0]
  globalFrame.environment[name] = value
}

export const importExternalSymbols = (context: Context, externalSymbols: string[]) => {
  ensureGlobalEnvironmentExist(context)

  externalSymbols.forEach(symbol => {
    defineSymbol(context, symbol, GLOBAL[symbol])
  })
}

/**
 * Imports builtins from standard and external libraries.
 *
 * For externalBuiltIns that need to be curried, the __SOURCE__
 * property must be defined in the currying function.
 */
export const importBuiltins = (context: Context, externalBuiltIns: CustomBuiltIns) => {
  ensureGlobalEnvironmentExist(context)

  /* Defining the __SOURCE__ property in the curried functions. */
  let display = (v: Value) => externalBuiltIns.display(v, context.externalContext)
  display.__SOURCE__ = externalBuiltIns.display.__SOURCE__
  let prompt = (v: Value) => externalBuiltIns.prompt(v, context.externalContext)
  prompt.__SOURCE__ = externalBuiltIns.prompt.__SOURCE__
  let alert = (v: Value) => externalBuiltIns.alert(v, context.externalContext)
  alert.__SOURCE__ = externalBuiltIns.alert.__SOURCE__
  let visualiseList = (list: any) => externalBuiltIns.visualiseList(list, context.externalContext)
  visualiseList.__SOURCE__ = externalBuiltIns.visualiseList.__SOURCE__
 

  if (context.chapter >= 1) {
    defineSymbol(context, 'runtime', misc.runtime)
    defineSymbol(context, 'display', display)
    defineSymbol(context, 'error', misc.error_message)
    defineSymbol(context, 'prompt', prompt)
    defineSymbol(context, 'parse_int', misc.parse_int)
    defineSymbol(context, 'undefined', undefined)
    defineSymbol(context, 'NaN', NaN)
    defineSymbol(context, 'Infinity', Infinity)
    // Define all Math libraries
    const objs = Object.getOwnPropertyNames(Math)
    for (const i in objs) {
      if (objs.hasOwnProperty(i)) {
        const val = objs[i]
        if (typeof Math[val] === 'function') {
          defineSymbol(context, 'math_' + val, Math[val].bind())
        } else {
          defineSymbol(context, 'math_' + val, Math[val])
        }
      }
    }
  }

  if (context.chapter >= 2) {
    // List library
    defineSymbol(context, 'pair', list.pair)
    defineSymbol(context, 'is_pair', list.is_pair)
    defineSymbol(context, 'head', list.head)
    defineSymbol(context, 'tail', list.tail)
    defineSymbol(context, 'is_empty_list', list.is_empty_list)
    defineSymbol(context, 'is_list', list.is_list)
    defineSymbol(context, 'list', list.list)
    defineSymbol(context, 'length', list.length)
    defineSymbol(context, 'map', list.map)
    defineSymbol(context, 'build_list', list.build_list)
    defineSymbol(context, 'for_each', list.for_each)
    defineSymbol(context, 'list_to_string', list.list_to_string)
    defineSymbol(context, 'reverse', list.reverse)
    defineSymbol(context, 'append', list.append)
    defineSymbol(context, 'member', list.member)
    defineSymbol(context, 'remove', list.remove)
    defineSymbol(context, 'remove_all', list.remove_all)
    defineSymbol(context, 'filter', list.filter)
    defineSymbol(context, 'enum_list', list.enum_list)
    defineSymbol(context, 'list_ref', list.list_ref)
    defineSymbol(context, 'accumulate', list.accumulate)
    defineSymbol(context, 'equal', list.equal)
  }

  if (context.chapter >= 3) {
    defineSymbol(context, 'set_head', list.set_head)
    defineSymbol(context, 'set_tail', list.set_tail)
    defineSymbol(context, 'array_length', misc.array_length)
  }

  if (context.chapter >= 4) {
    defineSymbol(context, 'stringify', JSON.stringify)
    defineSymbol(context, 'parse', () => 
      context.metaCircularParser.parse.apply(context.metaCircularParser, arguments))
    defineSymbol(context, 'apply_in_underlying_javascript', function(
      fun: Function,
      args: Value
    ) {
      const res = []
      var i = 0
      while (!(args.length === 0)) {
        res[i] = args[0]
        i = i + 1
        args = args[1]
      }
      return fun.apply(fun, res)
    })
    defineSymbol(context, 'is_number', misc.is_number)
    defineSymbol(context, 'is_array', misc.is_array)
    defineSymbol(context, 'is_object', misc.is_object)
    defineSymbol(context, 'is_string', misc.is_string)
    defineSymbol(context, 'is_function', misc.is_function)
    defineSymbol(context, 'is_boolean', misc.is_boolean)
  }

  if (context.chapter >= Infinity) {
    // previously week 4
    defineSymbol(context, 'alert', alert)
    // tslint:disable-next-line:ban-types
    defineSymbol(context, 'timed', (f: Function) => misc.timed(context, f, context.externalContext, externalBuiltIns.display))
    // previously week 5
    defineSymbol(context, 'assoc', list.assoc)
    defineSymbol(context, 'draw', visualiseList)
    // previously week 6
  }
}

const defaultBuiltIns: CustomBuiltIns = {
  display: misc.display,
  // See issue #5
  prompt: (v: Value, e: any) => toString(v),
  // See issue #11
  alert: misc.display,
  visualiseList: (list: any) => {
    throw new Error('List visualizer is not enabled')}
}

const createContext = <T>(chapter = 1, externalSymbols: string[] = [], externalContext?: T, 
  externalBuiltIns: CustomBuiltIns = defaultBuiltIns) => {
  const context = createEmptyContext(chapter, externalSymbols, externalContext)

  importBuiltins(context, externalBuiltIns)
  importExternalSymbols(context, externalSymbols)

  return context
}

export default createContext
