import * as list from './stdlib/lazy-list'
import * as misc from './stdlib/lazy-misc'
import Thunk from './interpreter/thunk'
import { Context, CustomBuiltIns, Value } from './types'
import { stringify } from './utils/lazy-stringify'
import { defineSymbol, ensureGlobalEnvironmentExist } from './createContext'

// Defines a builtin in the given context
// If the builtin is a function, wrap it such that its toString hides the implementation
const defineBuiltin = (context: Context, name: string, value: Value) => {
  if (typeof value === 'function') {
    const wrapped = (...args: any) => value(...args)
    const funName = name.split('(')[0].trim()
    const repr = `function ${name} {\n\t[implementation hidden]\n}`
    wrapped.toString = () => repr

    defineSymbol(context, funName, Thunk.from(wrapped))
  } else {
    defineSymbol(context, name, Thunk.from(value))
  }
}

/**
 * Imports builtins from standard and external libraries.
 */
export const importBuiltins = (context: Context, externalBuiltIns: CustomBuiltIns) => {
  ensureGlobalEnvironmentExist(context)

  const rawDisplay = function*(v: Thunk, s: string) {
    return externalBuiltIns.rawDisplay(yield* v.evaluate(), s, context.externalContext)
  }

  const display = function*(v: Thunk, s: string) {
    yield* rawDisplay(Thunk.from(yield* stringify(v)), s)
    return yield* v.evaluate()
  }

  const prompt = function*(v: Thunk) {
    externalBuiltIns.prompt(yield* v.evaluate(), '', context.externalContext)
  }

  const visualiseList = function*(v: Thunk) {
    externalBuiltIns.visualiseList(yield* v.evaluate(), context.externalContext)
  }

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
    defineBuiltin(context, 'pair(left, right)', list.pair)
    defineBuiltin(context, 'is_pair(val)', list.is_pair)
    defineBuiltin(context, 'head(xs)', list.head)
    defineBuiltin(context, 'tail(xs)', list.tail)
    defineBuiltin(context, 'is_null(val)', list.is_null)
    defineBuiltin(context, 'list(...values)', list.list)
    defineBuiltin(context, 'draw_data(xs)', visualiseList)
  }
}
