import { MAX_LIST_DISPLAY_LENGTH } from '../constants'
import Closure from '../interpreter/closure'
import { Value } from '../types'

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

  const stringifyArray = (xs: Value[], indentLevel: number) => {
    ancestors.add(xs)
    const valueStrs = xs.map(x => stringifyValue(x, 0))
    ancestors.delete(xs)

    if (shouldMultiline(valueStrs)) {
      if (xs.length === 2) {
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

  const stringifyObject = (obj: object, indentLevel: number) => {
    ancestors.add(obj)
    const valueStrs = Object.entries(obj).map(entry => {
      const keyStr = stringifyValue(entry[0], 0)
      const valStr = stringifyValue(entry[1], 0)
      if (valStr.includes('\n')) {
        return keyStr + ':\n' + indentify(indentString, valStr)
      } else {
        return keyStr + ': ' + valStr
      }
    })
    ancestors.delete(obj)

    if (shouldMultiline(valueStrs)) {
      return `${objPrefix}${indentify(
        indentString.repeat(indentLevel + 1),
        valueStrs.join(',\n')
      ).substring(indentString.length)}${objSuffix}`
    } else {
      return `{${valueStrs.join(', ')}}`
    }
  }

  const stringifyValue = (v: Value, indentLevel: number = 0): string => {
    if (v === null) {
      return 'null'
    } else if (v === undefined) {
      return 'undefined'
    } else if (ancestors.has(v)) {
      return '...<circular>'
    } else if (v instanceof Closure) {
      return v.toString()
    } else if (typeof v === 'string') {
      return JSON.stringify(v)
    } else if (typeof v !== 'object') {
      return v.toString()
    } else if (ancestors.size > MAX_LIST_DISPLAY_LENGTH) {
      return '...<truncated>'
    } else if (Array.isArray(v)) {
      return stringifyArray(v, indentLevel)
    } else {
      return stringifyObject(v, indentLevel)
    }
  }

  return stringifyValue(value, 0)
}
