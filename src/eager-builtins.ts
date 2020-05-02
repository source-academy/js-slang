import * as list from './stdlib/eager-list'
import * as misc from './stdlib/eager-misc'
import * as parser from './stdlib/parser'
import * as stream from './stdlib/stream'
import createContext, { defineSymbol, ensureGlobalEnvironmentExist } from './createContext'
import { Context, CustomBuiltIns, Value } from './types'
import { list_to_vector } from './stdlib/eager-list'
import { stringify } from './utils/eager-stringify'

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
