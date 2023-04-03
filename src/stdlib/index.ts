import createContext from '../createContext'
import { Chapter, Value } from '../types'
import * as list from './list'
import * as misc from './misc'
import * as parser from './parser'
import * as stream from './stream'

export const chapter_1 = {
  get_time: misc.error_message,
  error_message: misc.error_message,
  is_number: misc.is_number,
  is_string: misc.is_string,
  is_function: misc.is_function,
  is_boolean: misc.is_boolean,
  is_undefined: misc.is_undefined,
  parse_int: misc.parse_int,
  char_at: misc.char_at,
  arity: misc.arity,
  undefined: undefined,
  NaN: NaN,
  Infinity: Infinity
}

export const chapter_2 = {
  ...chapter_1,
  pair: list.pair,
  is_pair: list.is_pair,
  head: list.head,
  tail: list.tail,
  is_null: list.is_null,
  list: list.list,
  // defineBuiltin(context, 'draw_data(...xs)', visualiseList, 1)
  // defineBuiltin(context, 'display_list(val, prepend = undefined)', displayList, 0)
  is_list: list.is_list
}

export const chapter_3 = {
  ...chapter_2,
  set_head: list.set_head,
  set_tail: list.set_tail,
  array_length: misc.array_length,
  is_array: misc.is_array,

  // Stream library
  stream_tail: stream.stream_tail,
  stream: stream.stream
}

export const chapter_4 = {
  ...chapter_3,
  parse: (str: string, chapter: Chapter) => parser.parse(str, createContext(chapter)),
  tokenize: (str: string, chapter: Chapter) => parser.tokenize(str, createContext(chapter)),
  // tslint:disable-next-line:ban-types
  apply_in_underlying_javascript: (fun: Function, args: Value) =>
    fun.apply(fun, list.list_to_vector(args))
}

export const chapter_library_parser = {
  ...chapter_4,
  is_object: misc.is_object,
  is_NaN: misc.is_NaN,
  has_own_property: misc.has_own_property
  // defineBuiltin(context, 'alert(val)', alert)
  // tslint:disable-next-line:ban-types
  // timed: (f: Function: context: Context) => misc.timed(context, f, context.externalContext, externalBuiltIns.rawDisplay),
}

export default {
  [Chapter.SOURCE_1]: chapter_1,
  [Chapter.SOURCE_2]: chapter_2,
  [Chapter.SOURCE_3]: chapter_3,
  [Chapter.SOURCE_4]: chapter_4,
  [Chapter.LIBRARY_PARSER]: chapter_library_parser
}

export * as list from './list'
export * as misc from './misc'
export * as stream from './stream'
