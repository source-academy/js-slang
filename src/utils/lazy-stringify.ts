import { MAX_LIST_DISPLAY_LENGTH } from '../constants'
import Closure from '../interpreter/closure'
import { Value } from '../types'
import Thunk from '../interpreter/thunk'

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

export const stringify = function*(
  value: Thunk,
  indent: number | string = 2,
  splitlineThreshold = 80
): IterableIterator<Value> {
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

  const stringifyArray = function*(xs: Value[], indentLevel: number) {
    ancestors.add(xs)
    const valueStrs = yield* concatGenerators(xs.map(x => () => stringifyValue(x, 0)))
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

  const stringifyObject = function*(obj: object, indentLevel: number) {
    ancestors.add(obj)
    const keys: [string] = yield* concatGenerators(
      Object.entries(obj).map(entry => () => stringifyValue(Thunk.from(entry[0])), 0)
    )
    const vals: [string] = yield* concatGenerators(
      Object.entries(obj).map(entry => () => stringifyValue(Thunk.from(entry[1])), 0)
    )
    const valueStrs = zip(keys, vals).map(([key, val]) => {
      if (val.includes('\n')) {
        return key + ':\n' + indentify(indentString, val)
      } else {
        return key + ': ' + val
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

  const stringifyValue = function*(thunk: Thunk, indentLevel: number = 0): IterableIterator<Value> {
    const v = yield* thunk.evaluate()
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
      return yield* stringifyArray(v, indentLevel)
    } else {
      return yield* stringifyObject(v, indentLevel)
    }
  }

  return yield* stringifyValue(value, 0)
}

function* concatGenerators(suppliers: (() => IterableIterator<Value>)[]): IterableIterator<Value> {
  return yield* suppliers.reduce(
    (acc, cur) => {
      return function*() {
        const rest = yield* acc()
        const v = yield* cur()
        return [...rest, v]
      }
    },
    function*() {
      return []
    }
  )()
}

function zip<T, U>(xs: T[], ys: U[]): [T, U][] {
  return xs.map((x, i) => [x, ys[i]])
}
