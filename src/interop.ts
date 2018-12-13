import { generate } from 'astring'

import { MAX_LIST_DISPLAY_LENGTH } from './constants'
import { apply } from './interpreter'
import { Closure, Context, Value } from './types'

export const closureToJS = (value: Value, context: Context, klass: string) => {
  function DummyClass(this: Value) {
    const args: Value[] = Array.prototype.slice.call(arguments)
    const gen = apply(context, value, args, undefined, this)
    let it = gen.next()
    while (!it.done) {
      it = gen.next()
    }
    return it.value
  }
  Object.defineProperty(DummyClass, 'name', {
    value: klass
  })
  Object.setPrototypeOf(DummyClass, () => {})
  Object.defineProperty(DummyClass, 'Inherits', {
    value: (Parent: Value) => {
      DummyClass.prototype = Object.create(Parent.prototype)
      DummyClass.prototype.constructor = DummyClass
    }
  })
  DummyClass.toString = function() {
    return stringify(value)
  }
  DummyClass.call = (thisArg: Value, ...args: Value[]): any => {
    return DummyClass.apply(thisArg, args)
  }
  return DummyClass
}

function makeIndent(indent: number | string): string {
  if (typeof indent === 'number') {
    if (indent > 10) {
      indent = 10
    }
    return repeat(' ', indent)
  } else {
    if (indent.length > 10) {
      indent = indent.substring(0, 10)
    }
    return indent
  }
}

function indentify(indent: string, s: string): string {
  return s
    .split('\n')
    .map(v => indent + v)
    .join('\n')
}

function repeat(s: string, times: number): string {
  return new Array(times + 1).join(s)
}

export const stringify = (
  value: Value,
  indent_: number | string = 2,
  splitline_threshold = 80
): string => {
  let ancestors = new Set()
  const indent = makeIndent(indent_)
  let arr_prefix = '[' + repeat(' ', indent.length - 1)
  let obj_prefix = '{' + repeat(' ', indent.length - 1)
  let arr_suffix = repeat(' ', indent.length - 1) + ']'
  let obj_suffix = repeat(' ', indent.length - 1) + '}'

  const helper = (value: Value, indent_level: number = 0): string => {
    if (ancestors.has(value)) {
      return '...<circular>'
    } else if (value instanceof Closure) {
      return generate(value.originalNode)
    } else if (Array.isArray(value)) {
      if (ancestors.size > MAX_LIST_DISPLAY_LENGTH) {
        return '...<truncated>'
      }
      ancestors.add(value)
      let value_strs = value.map(v => helper(v, 0))
      let multiline =
        indent !== '' &&
        (value_strs.join(', ').length > splitline_threshold ||
          value_strs.some(s => s.indexOf('\n') !== -1))
      let res
      if (multiline) {
        if (value.length === 2) {
          // It's a list, don't increase indent on second element so that long lists don't look like crap
          res = `${arr_prefix}${indentify(
            repeat(indent, indent_level + 1),
            value_strs[0]
          ).substring(indent.length)},
${indentify(repeat(indent, indent_level), value_strs[1])}${arr_suffix}`
        } else {
          res = `${arr_prefix}${indentify(
            repeat(indent, indent_level + 1),
            value_strs.join(',\n')
          ).substring(indent.length)}${arr_suffix}`
        }
      } else {
        res = `[${value_strs.join(', ')}]`
      }
      ancestors.delete(value)
      return res
    } else if (typeof value === 'string') {
      return JSON.stringify(value)
    } else if (typeof value === 'undefined') {
      return 'undefined'
    } else if (typeof value === 'function') {
      return value.toString()
    } else if (value === null) {
      return 'null'
    } else if (typeof value === 'object') {
      ancestors.add(value)
      let value_strs = Object.entries(value).map(entry => {
        let key_str = helper(entry[0], 0)
        let val_str = helper(entry[1], 0)
        if (val_str.indexOf('\n') === -1) {
          // Single line
          return key_str + ': ' + val_str
        } else {
          return key_str + ':\n' + indentify(indent, val_str)
        }
      })
      let multiline =
        indent !== '' &&
        (value_strs.join(', ').length > splitline_threshold ||
          value_strs.some(s => s.indexOf('\n') !== -1))
      let res
      if (multiline) {
        res = `${obj_prefix}${indentify(
          repeat(indent, indent_level + 1),
          value_strs.join(',\n')
        ).substring(indent.length)}${obj_suffix}`
      } else {
        res = `{${value_strs.join(', ')}}`
      }
      ancestors.delete(value)
      return res
    } else {
      return value.toString()
    }
  }

  return helper(value, 0)
}
