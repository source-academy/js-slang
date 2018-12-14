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
  // Used to check if there are any cyclic structures
  const ancestors = new Set()

  // Precompute useful strings
  const indentString = makeIndent(indent)
  const arrPrefix = '[' + indentString.substring(1)
  const objPrefix = '{' + indentString.substring(1)
  const arrSuffix = indentString.substring(0, indentString.length - 1) + ']'
  const objSuffix = indentString.substring(0, indentString.length - 1) + '}'

  // Util functions

  // Determines if the array/object containing these (stringified) values
  // should be multiline and indented or oneline
  const shouldMultiline = (valueStrs: string[]) =>
    indentString !== '' &&
    (valueStrs.join(', ').length > splitlineThreshold || valueStrs.some(s => s.includes('\n')))

  // Stringify functions
  // The real one is stringifyValue

  const stringifyArray = (value: Value[], indentLevel: number) => {
    if (ancestors.size > MAX_LIST_DISPLAY_LENGTH) {
      return '...<truncated>'
    }
    ancestors.add(value)
    const valueStrs = value.map(v => stringifyValue(v, 0))
    ancestors.delete(value)

    if (shouldMultiline(valueStrs)) {
      if (value.length === 2) {
        // It's (probably) a source list
        // Don't increase indent on second element
        // so long lists don't look like crap
        return `${arrPrefix}${indentify(
          indentString.repeat(indentLevel + 1),
          valueStrs[0]
        ).substring(indentString.length)},
${indentify(indentString.repeat(indentLevel), valueStrs[1])}${arrSuffix}`
      } else {
        // A regular array,
        // indent second element onwards to match with first element
        return `${arrPrefix}${indentify(
          indentString.repeat(indentLevel + 1),
          valueStrs.join(',\n')
        ).substring(indentString.length)}${arrSuffix}`
      }
    } else {
      return `[${valueStrs.join(', ')}]`
    }
  }

  const stringifyObject = (value: object, indentLevel: number) => {
    ancestors.add(value)
    const valueStrs = Object.entries(value).map(entry => {
      const keyStr = stringifyValue(entry[0], 0)
      const valStr = stringifyValue(entry[1], 0)
      if (valStr.includes('\n')) {
        return keyStr + ':\n' + indentify(indentString, valStr)
      } else {
        return keyStr + ': ' + valStr
      }
    })
    ancestors.delete(value)

    if (shouldMultiline(valueStrs)) {
      return `${objPrefix}${indentify(
        indentString.repeat(indentLevel + 1),
        valueStrs.join(',\n')
      ).substring(indentString.length)}${objSuffix}`
    } else {
      return `{${valueStrs.join(', ')}}`
    }
  }

  const stringifyValue = (value: Value, indentLevel: number = 0): string => {
    if (ancestors.has(value)) {
      return '...<circular>'
    } else if (value instanceof Closure) {
      return generate(value.originalNode)
    } else if (Array.isArray(value)) {
      return stringifyArray(value, indentLevel)
    } else if (typeof value === 'string') {
      return JSON.stringify(value)
    } else if (typeof value === 'undefined') {
      return 'undefined'
    } else if (typeof value === 'function') {
      return value.toString()
    } else if (value === null) {
      return 'null'
    } else if (typeof value === 'object') {
      return stringifyObject(value, indentLevel)
    } else {
      return value.toString()
    }
  }

  return stringifyValue(value, 0)
}
