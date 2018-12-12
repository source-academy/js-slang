import { generate } from 'astring'
import getParameterNames = require('get-parameter-names')

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
    return toString(value)
  }
  DummyClass.call = (thisArg: Value, ...args: Value[]): any => {
    return DummyClass.apply(thisArg, args)
  }
  return DummyClass
}

const arrayToString = (value: Value[], length: number) => {
  // Normal Array
  if (value.length > 2 || value.length === 1) {
    return `[${value.map(v => toString(v, length + 1)).join(', ')}]`
  } else if (value.length === 0) {
    return '[]'
  } else {
    return `[${toString(value[0], length + 1)}, ${toString(value[1], length + 1)}]`
  }
}

export const toString = (value: Value, length = 0): string => {
  if (value instanceof Closure) {
    return generate(value.originalNode)
  } else if (Array.isArray(value)) {
    if (length > MAX_LIST_DISPLAY_LENGTH) {
      return '...<truncated>'
    } else {
      return arrayToString(value, length)
    }
  } else if (typeof value === 'string') {
    return `"${value}"`
  } else if (typeof value === 'undefined') {
    return 'undefined'
  } else if (typeof value === 'function') {
    if (value.__SOURCE__) {
      return `function ${value.__SOURCE__} {\n\t[implementation hidden]\n}`
    } else {
      const params = getParameterNames(value).join(', ')
      return `function ${value.name}(${params}) {\n\t[implementation hidden]\n}`
    }
  } else if (value === null) {
    return 'null'
  } else {
    return value.toString()
  }
}
