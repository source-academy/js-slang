import { generate } from 'astring'

import { MAX_LIST_DISPLAY_LENGTH } from './constants'
import { apply } from './interpreter'
import { ArrowClosure, Closure, Context, Value } from './types'

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
  DummyClass.call = (thisArg: Value, ...args: Value[]) => {
    return DummyClass.apply(thisArg, args)
  }
  return DummyClass
}

export const toJS = (value: Value, context: Context, klass?: string) => {
  if (value instanceof Closure || value instanceof ArrowClosure) {
    return value.fun
  } else {
    return value
  }
}

const stripBody = (body: string) => {
  const lines = body.split(/\n/)
  if (lines.length >= 2) {
    return lines[0] + '\n\t[implementation hidden]\n' + lines[lines.length - 1]
  } else {
    return body
  }
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
  if (value instanceof ArrowClosure || value instanceof Closure) {
    return generate(value.node)
  } else if (Array.isArray(value)) {
    if (length > MAX_LIST_DISPLAY_LENGTH) {
      return '...<truncated>'
    } else {
      return arrayToString(value, length)
    }
  } else if (typeof value === 'string') {
    return `\"${value}\"`
  } else if (typeof value === 'undefined') {
    return 'undefined'
  } else if (typeof value === 'function') {
    if (value.__SOURCE__) {
      return `function ${value.__SOURCE__} {\n\t[implementation hidden]\n}`
    } else {
      return stripBody(value.toString())
    }
  } else if (value === null) {
    return 'null'
  } else {
    return value.toString()
  }
}
