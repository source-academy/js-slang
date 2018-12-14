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
    return ' '.repeat(indent)
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

export const stringify = (
  value: Value,
  indent: number | string = 2,
  splitlineThreshold = 80
): string => {
  const ancestors = new Set()
  const indentString = makeIndent(indent)
  const arrPrefix = '[' + indentString.substring(1)
  const objPrefix = '{' + indentString.substring(1)
  const arrSuffix = indentString.substring(0, indentString.length - 1) + ']'
  const objSuffix = indentString.substring(0, indentString.length - 1) + '}'

  const helper = (value: Value, indentLevel: number = 0): string => {
    if (ancestors.has(value)) {
      return '...<circular>'
    } else if (value instanceof Closure) {
      return generate(value.originalNode)
    } else if (Array.isArray(value)) {
      if (ancestors.size > MAX_LIST_DISPLAY_LENGTH) {
        return '...<truncated>'
      }
      ancestors.add(value)
      const valueStrs = value.map(v => helper(v, 0))
      const multiline =
        indentString !== '' &&
        (valueStrs.join(', ').length > splitlineThreshold ||
          valueStrs.some(s => s.includes('\n')))
      let res
      if (multiline) {
        if (value.length === 2) {
          // It's a list, don't increase indent on second element so that long lists don't look like crap
          res = `${arrPrefix}${indentify(
            indentString.repeat(indentLevel + 1),
            valueStrs[0]
          ).substring(indentString.length)},
${indentify(indentString.repeat(indentLevel), valueStrs[1])}${arrSuffix}`
        } else {
          res = `${arrPrefix}${indentify(
            indentString.repeat(indentLevel + 1),
            valueStrs.join(',\n')
          ).substring(indentString.length)}${arrSuffix}`
        }
      } else {
        res = `[${valueStrs.join(', ')}]`
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
      const valueStrs = Object.entries(value).map(entry => {
        const keyStr = helper(entry[0], 0)
        const valStr = helper(entry[1], 0)
        if (valStr.includes('\n')) {
          return keyStr + ':\n' + indentify(indentString, valStr)
        } else {
          return keyStr + ': ' + valStr
        }
      })
      const multiline =
        indentString !== '' &&
        (valueStrs.join(', ').length > splitlineThreshold ||
          valueStrs.some(s => s.includes('\n')))
      let res
      if (multiline) {
        res = `${objPrefix}${indentify(
          indentString.repeat(indentLevel + 1),
          valueStrs.join(',\n')
        ).substring(indentString.length)}${objSuffix}`
      } else {
        res = `{${valueStrs.join(', ')}}`
      }
      ancestors.delete(value)
      return res
    } else {
      return value.toString()
    }
  }

  return helper(value, 0)
}
