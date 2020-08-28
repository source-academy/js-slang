import { MAX_LIST_DISPLAY_LENGTH } from '../constants'
import Closure from '../interpreter/closure'
import { forceIt } from './operators'
import { Value, Type } from '../types'

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

export interface ArrayLike {
  replPrefix: string
  replSuffix: string
  replArrayContents: () => Value[]
}

function isArrayLike(v: Value) {
  return (
    typeof v.replPrefix === 'string' &&
    typeof v.replSuffix === 'string' &&
    typeof v.replArrayContents === 'function'
  )
}

export const stringify = (
  value: Value,
  indent: number | string = 2,
  splitlineThreshold = 80
): string => {
  // Used to check if there are any cyclic structures
  const ancestors = new Set()
  value = forceIt(value)

  // Precompute useful strings
  const indentString = makeIndent(indent)
  const arrPrefix = '[' + indentString.substring(1)
  const objPrefix = '{' + indentString.substring(1)
  const arrSuffix = ']'
  const objSuffix = '}'

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

  const stringifyArrayLike = (arrayLike: ArrayLike, indentLevel: number) => {
    const prefix = arrayLike.replPrefix
    const suffix = arrayLike.replSuffix
    const prefixIndented = prefix + indentString.substring(prefix.length)
    const suffixIndented = suffix
    const xs = arrayLike.replArrayContents()

    ancestors.add(arrayLike)
    const valueStrs = xs.map(x => stringifyValue(x, 0))
    ancestors.delete(arrayLike)

    if (shouldMultiline(valueStrs)) {
      // indent second element onwards to match with first element
      return `${prefixIndented}${indentify(
        indentString.repeat(indentLevel) + ' '.repeat(prefixIndented.length),
        valueStrs.join(',\n')
      ).substring(prefixIndented.length)}${suffixIndented}`
    } else {
      return `${prefix}${valueStrs.join(', ')}${suffix}`
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
    } else if (typeof v.toReplString === 'function') {
      return v.toReplString()
    } else if (Array.isArray(v)) {
      return stringifyArray(v, indentLevel)
    } else if (isArrayLike(v)) {
      return stringifyArrayLike(v, indentLevel)
    } else {
      return stringifyObject(v, indentLevel)
    }
  }

  return stringifyValue(value, 0)
}

export function typeToString(type: Type): string {
  return niceTypeToString(type)
}

function niceTypeToString(type: Type, nameMap = { _next: 0 }): string {
  function curriedTypeToString(t: Type) {
    return niceTypeToString(t, nameMap)
  }

  switch (type.kind) {
    case 'primitive':
      return type.name
    case 'variable':
      if (type.constraint && type.constraint !== 'none') {
        return type.constraint
      }
      if (!(type.name in nameMap)) {
        // type name is not in map, so add it
        nameMap[type.name] = 'T' + nameMap._next++
      }
      return nameMap[type.name]
    case 'list':
      return `List<${curriedTypeToString(type.elementType)}>`
    case 'array':
      return `Array<${curriedTypeToString(type.elementType)}>`
    case 'pair':
      const headType = curriedTypeToString(type.headType)
      // convert [T1 , List<T1>] back to List<T1>
      if (
        type.tailType.kind === 'list' &&
        headType === curriedTypeToString(type.tailType.elementType)
      )
        return `List<${headType}>`
      return `[${curriedTypeToString(type.headType)}, ${curriedTypeToString(type.tailType)}]`
    case 'function':
      let parametersString = type.parameterTypes.map(curriedTypeToString).join(', ')
      if (type.parameterTypes.length !== 1 || type.parameterTypes[0].kind === 'function') {
        parametersString = `(${parametersString})`
      }
      return `${parametersString} -> ${curriedTypeToString(type.returnType)}`
    default:
      return 'Unable to infer type'
  }
}
