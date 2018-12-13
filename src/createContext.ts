import * as list from './stdlib/list'
import * as parser from './stdlib/parser'
import * as misc from './stdlib/misc'
import { stringify } from './interop'
import { Context, CustomBuiltIns, Value } from './types'
import { list_to_vector } from './stdlib/list'

import getParameterNames = require('get-parameter-names')

const GLOBAL = typeof window === 'undefined' ? global : window

const createEmptyRuntime = () => ({
  isRunning: false,
  frames: [],
  value: undefined,
  nodes: []
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
  runtime: createEmptyRuntime()
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

export const defineSymbol = (context: Context, name: string, value: Value) => {
  const globalFrame = context.runtime.frames[0]
  Object.defineProperty(globalFrame.environment, name, {
    value,
    writable: false,
    enumerable: true
  })
}

export const defineBuiltin = (context: Context, name: string, f: Function) => {
  let wrapped = (...args: any) => f(...args)
  wrapped.toString = () => {
    const params = getParameterNames(f).join(', ')
    return `function ${f.name}(${params}) {\n\t[implementation hidden]\n}`
  }
  defineSymbol(context, name, wrapped)
}

export const importExternalSymbols = (context: Context, externalSymbols: string[]) => {
  ensureGlobalEnvironmentExist(context)

  externalSymbols.forEach(symbol => {
    if (typeof GLOBAL[symbol] === 'function') {
      defineBuiltin(context, symbol, GLOBAL[symbol])
    } else {
      defineSymbol(context, symbol, GLOBAL[symbol])
    }
  })
}

/**
 * Imports builtins from standard and external libraries.
 */
export const importBuiltins = (context: Context, externalBuiltIns: CustomBuiltIns) => {
  ensureGlobalEnvironmentExist(context)

  let display = (v: Value) => externalBuiltIns.display(v, context.externalContext)
  let prompt = (v: Value) => externalBuiltIns.prompt(v, context.externalContext)
  let alert = (v: Value) => externalBuiltIns.alert(v, context.externalContext)
  let visualiseList = (list: any) => externalBuiltIns.visualiseList(list, context.externalContext)

  if (context.chapter >= 1) {
    defineBuiltin(context, 'runtime', misc.runtime)
    defineBuiltin(context, 'display', display)
    defineBuiltin(context, 'stringify', stringify)
    defineBuiltin(context, 'error', misc.error_message)
    defineBuiltin(context, 'prompt', prompt)
    defineBuiltin(context, 'is_number', misc.is_number)
    defineBuiltin(context, 'is_string', misc.is_string)
    defineBuiltin(context, 'is_function', misc.is_function)
    defineBuiltin(context, 'is_boolean', misc.is_boolean)
    defineBuiltin(context, 'is_undefined', misc.is_undefined)
    defineBuiltin(context, 'parse_int', misc.parse_int)
    defineSymbol(context, 'undefined', undefined)
    defineSymbol(context, 'NaN', NaN)
    defineSymbol(context, 'Infinity', Infinity)
    // Define all Math libraries
    const objs = Object.getOwnPropertyNames(Math)
    for (const i in objs) {
      if (objs.hasOwnProperty(i)) {
        const val = objs[i]
        if (typeof Math[val] === 'function') {
          defineBuiltin(context, 'math_' + val, Math[val].bind())
        } else {
          defineBuiltin(context, 'math_' + val, Math[val])
        }
      }
    }
  }

  if (context.chapter >= 2) {
    // List library
    defineSymbol(context, 'null', null)
    defineBuiltin(context, 'pair', list.pair)
    defineBuiltin(context, 'is_pair', list.is_pair)
    defineBuiltin(context, 'head', list.head)
    defineBuiltin(context, 'tail', list.tail)
    defineBuiltin(context, 'is_null', list.is_null)
    defineBuiltin(context, 'is_list', list.is_list)
    defineBuiltin(context, 'list', list.list)
    defineBuiltin(context, 'length', list.length)
    defineBuiltin(context, 'map', list.map)
    defineBuiltin(context, 'build_list', list.build_list)
    defineBuiltin(context, 'for_each', list.for_each)
    defineBuiltin(context, 'list_to_string', list.list_to_string)
    defineBuiltin(context, 'reverse', list.reverse)
    defineBuiltin(context, 'append', list.append)
    defineBuiltin(context, 'member', list.member)
    defineBuiltin(context, 'remove', list.remove)
    defineBuiltin(context, 'remove_all', list.remove_all)
    defineBuiltin(context, 'filter', list.filter)
    defineBuiltin(context, 'enum_list', list.enum_list)
    defineBuiltin(context, 'list_ref', list.list_ref)
    defineBuiltin(context, 'accumulate', list.accumulate)
    defineBuiltin(context, 'equal', list.equal)
    defineBuiltin(context, 'draw_list', visualiseList)
  }

  if (context.chapter >= 3) {
    defineBuiltin(context, 'set_head', list.set_head)
    defineBuiltin(context, 'set_tail', list.set_tail)
    defineBuiltin(context, 'array_length', misc.array_length)
    defineBuiltin(context, 'is_array', misc.is_array)
  }

  if (context.chapter >= 4) {
    defineBuiltin(context, 'parse', parser.parse)
    defineBuiltin(context, 'apply_in_underlying_javascript', function(fun: Function, args: Value) {
      return fun.apply(fun, list_to_vector(args))
    })
  }

  if (context.chapter >= 100) {
    defineBuiltin(context, 'is_object', misc.is_object)
  }

  if (context.chapter >= Infinity) {
    // previously week 4
    defineBuiltin(context, 'alert', alert)
    // tslint:disable-next-line:ban-types
    defineBuiltin(context, 'timed', (f: Function) =>
      misc.timed(context, f, context.externalContext, externalBuiltIns.display)
    )
    // previously week 5
    defineBuiltin(context, 'assoc', list.assoc)
    // previously week 6
  }
}

const defaultBuiltIns: CustomBuiltIns = {
  display: misc.display,
  // See issue #5
  prompt: misc.display,
  // See issue #11
  alert: misc.display,
  visualiseList: (list: any) => {
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
