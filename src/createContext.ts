import { toString } from './interop'
import * as list from './stdlib/list'
import { list_to_vector } from './stdlib/list'
import * as misc from './stdlib/misc'
import * as parser from './stdlib/parser'
import { Context, CustomBuiltIns, Value } from './types'

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
  const display = (v: Value) => externalBuiltIns.display(v, context.externalContext)
  display.__SOURCE__ = externalBuiltIns.display.__SOURCE__
  const prompt = (v: Value) => externalBuiltIns.prompt(v, context.externalContext)
  prompt.__SOURCE__ = externalBuiltIns.prompt.__SOURCE__
  const alert = (v: Value) => externalBuiltIns.alert(v, context.externalContext)
  alert.__SOURCE__ = externalBuiltIns.alert.__SOURCE__
  const visualiseList = (v: Value) => externalBuiltIns.visualiseList(v, context.externalContext)
  visualiseList.__SOURCE__ = externalBuiltIns.visualiseList.__SOURCE__

  if (context.chapter >= 1) {
    defineSymbol(context, 'runtime', misc.runtime)
    defineSymbol(context, 'display', display)
    defineSymbol(context, 'error', misc.error_message)
    defineSymbol(context, 'prompt', prompt)
    defineSymbol(context, 'is_number', misc.is_number)
    defineSymbol(context, 'is_string', misc.is_string)
    defineSymbol(context, 'is_function', misc.is_function)
    defineSymbol(context, 'is_boolean', misc.is_boolean)
    defineSymbol(context, 'is_undefined', misc.is_undefined)
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
    defineSymbol(context, 'null', null)
    defineSymbol(context, 'pair', list.pair)
    defineSymbol(context, 'is_pair', list.is_pair)
    defineSymbol(context, 'head', list.head)
    defineSymbol(context, 'tail', list.tail)
    defineSymbol(context, 'is_null', list.is_null)
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
    defineSymbol(context, 'draw_list', visualiseList)
  }

  if (context.chapter >= 3) {
    defineSymbol(context, 'set_head', list.set_head)
    defineSymbol(context, 'set_tail', list.set_tail)
    defineSymbol(context, 'array_length', misc.array_length)
    defineSymbol(context, 'is_array', misc.is_array)
  }

  if (context.chapter >= 4) {
    defineSymbol(context, 'stringify', JSON.stringify)
    defineSymbol(context, 'parse', parser.parse)
    defineSymbol(
      context,
      'apply_in_underlying_javascript',
      // tslint:disable-next-line:ban-types
      (fun: Function, args: Value): Value => fun.apply(fun, list_to_vector(args))
    )
  }

  if (context.chapter >= 100) {
    defineSymbol(context, 'is_object', misc.is_object)
  }

  if (context.chapter >= Infinity) {
    // previously week 4
    defineSymbol(context, 'alert', alert)
    // tslint:disable-next-line:ban-types
    defineSymbol(context, 'timed', (f: Function) =>
      misc.timed(context, f, context.externalContext, externalBuiltIns.display)
    )
    // previously week 5
    defineSymbol(context, 'assoc', list.assoc)
    // previously week 6
  }
}

const defaultBuiltIns: CustomBuiltIns = {
  display: misc.display,
  // See issue #5
  prompt: (v: Value, e: any) => toString(v),
  // See issue #11
  alert: misc.display,
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
