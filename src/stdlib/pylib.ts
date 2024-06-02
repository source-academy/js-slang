import { Value } from '../types'

export function is_float(v: Value) {
  return typeof v === 'number'
}

export function is_int(v: Value) {
  return typeof v === 'bigint'
}

function __is_numeric(v: Value) {
  return is_int(v) || is_float(v)
}

function __is_string(v: Value) {
  // Retrieved from https://stackoverflow.com/questions/4059147/check-if-a-variable-is-a-string-in-javascript
  return typeof v === 'string' || v instanceof String
}

export function __py_adder(x: Value, y: Value) {
  if (typeof x === typeof y) {
    return x + y
  }
  if (typeof x === 'bigint') {
    return Number(x) + y
  }
  if (typeof y === 'bigint') {
    return x + Number(y)
  }
  if (__is_numeric(x) && __is_numeric(y)) {
    return x + y
  }
  throw new Error(`Invalid types for addition operation: ${typeof x}, ${typeof y}`)
}

export function __py_minuser(x: Value, y: Value) {
  if (!__is_numeric(x)) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!__is_numeric(y)) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x === 'bigint' && typeof y === 'bigint') {
    return x - y
  }
  if (typeof x === 'number' && typeof y === 'number') {
    return x - y
  }
  if (typeof x === 'bigint' && typeof y === 'number') {
    return Number(x) - y
  }
  if (typeof x === 'number' && typeof y === 'bigint') {
    return x - Number(y)
  }
  throw new Error(`Invalid types for subtraction operation: ${typeof x}, ${typeof y}`)
}

export function __py_multiplier(x: Value, y: Value) {
  if (!__is_numeric(x)) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!__is_numeric(y)) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x === 'bigint' && typeof y === 'bigint') {
    return x * y
  }
  if (typeof x === 'number' && typeof y === 'number') {
    return x * y
  }
  if (typeof x === 'bigint' && typeof y === 'number') {
    return Number(x) * y
  }
  if (typeof x === 'number' && typeof y === 'bigint') {
    return x * Number(y)
  }
  if (typeof x == 'number' && __is_string(y)) {
    return y.repeat(x)
  }
  if (typeof y == 'number' && __is_string(x)) {
    return x.repeat(y)
  }
  throw new Error(`Invalid types for multiply operation: ${typeof x}, ${typeof y}`)
}

export function __py_divider(x: Value, y: Value) {
  if (!__is_numeric(x)) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!__is_numeric(y)) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x === 'bigint' && typeof y === 'bigint') {
    return Number(x) / Number(y)
  }
  if (typeof x === 'number' && typeof y === 'number') {
    return x / y
  }
  if (typeof x === 'bigint' && typeof y === 'number') {
    return Number(x) / y
  }
  if (typeof x === 'number' && typeof y === 'bigint') {
    return x / Number(y)
  }
  throw new Error(`Invalid types for divide operation: ${typeof x}, ${typeof y}`)
}

export function __py_modder(x: Value, y: Value) {
  if (!__is_numeric(x)) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!__is_numeric(y)) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x === 'bigint' && typeof y === 'bigint') {
    return x % y
  }
  if (typeof x === 'number' && typeof y === 'number') {
    return x % y
  }
  if (typeof x === 'bigint' && typeof y === 'number') {
    return Number(x) % y
  }
  if (typeof x === 'number' && typeof y === 'bigint') {
    return x % Number(y)
  }
  throw new Error(`Invalid types for modulo operation: ${typeof x}, ${typeof y}`)
}

export function __py_powerer(x: Value, y: Value) {
  if (!__is_numeric(x)) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!__is_numeric(y)) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x === 'bigint' && typeof y === 'bigint') {
    let res = BigInt(1)
    for (let i = 0; i < y; i++) {
      res = res * x
    }
    return res
  }
  if (typeof x === 'number' && typeof y === 'number') {
    return Math.pow(x, y)
  }
  if (typeof x === 'bigint' && typeof y === 'number') {
    return Math.pow(Number(x), y)
  }
  if (typeof x === 'number' && typeof y === 'bigint') {
    return Math.pow(x, Number(y))
  }
  throw new Error(`Invalid types for power operation: ${typeof x}, ${typeof y}`)
}

export function __py_floorer(x: Value, y: Value) {
  return BigInt(Math.floor(__py_divider(x, y)))
}

export function __py_unary_plus(x: Value) {
  if (__is_numeric(x)) {
    return +Number(x)
  }
  throw new Error(`Invalid type for unary plus operation: ${typeof x}`)
}

export function math_abs(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.abs(Number(x))
}

export function math_acos(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.acos(Number(x))
}

export function math_acosh(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.acosh(Number(x))
}

export function math_asin(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.asin(Number(x))
}

export function math_asinh(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.asinh(Number(x))
}

export function math_atan(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.atan(Number(x))
}

export function math_atan2(y: Value, x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.atan2(Number(y), Number(x))
}

export function math_atanh(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.atanh(Number(x))
}

export function math_cbrt(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.cbrt(Number(x))
}

export function math_ceil(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.ceil(Number(x))
}

export function math_clz32(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.clz32(Number(x))
}

export function math_cos(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.cos(Number(x))
}

export function math_cosh(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.cosh(Number(x))
}

export function math_exp(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.exp(Number(x))
}

export function math_expm1(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.expm1(Number(x))
}

export function math_floor(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.floor(Number(x))
}

export function math_fround(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.fround(Number(x))
}

export function math_hypot(...elements: Value[]) {
  const coercedElements: number[] = elements.map(el => {
    if (!__is_numeric(el)) {
      throw new Error(`Invalid type for operation: ${typeof el}`)
    }
    return Number(el)
  })
  return Math.hypot(...coercedElements)
}

export function math_imul(x: Value, y: Value) {
  if (!__is_numeric(x) || !__is_numeric(y)) {
    throw new Error(`Invalid types for power operation: ${typeof x}, ${typeof y}`)
  }
  return Math.imul(Number(x), Number(y))
}

export function math_log(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.log(Number(x))
}

export function math_log1p(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.log1p(Number(x))
}

export function math_log2(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.log2(Number(x))
}

export function math_log10(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.log10(Number(x))
}

export function math_max(...elements: Value[]) {
  // TODO: Python max also supports strings!
  const coercedElements: number[] = elements.map(el => {
    if (!__is_numeric(el)) {
      throw new Error(`Invalid type for operation: ${typeof el}`)
    }
    return Number(el)
  })
  return Math.max(...coercedElements)
}

export function math_min(...elements: Value[]) {
  // TODO: Python min also supports strings!
  const coercedElements: number[] = elements.map(el => {
    if (!__is_numeric(el)) {
      throw new Error(`Invalid type for operation: ${typeof el}`)
    }
    return Number(el)
  })
  return Math.min(...coercedElements)
}

export function math_pow(x: Value, y: Value) {
  if (!__is_numeric(x) || !__is_numeric(y)) {
    throw new Error(`Invalid types for power operation: ${typeof x}, ${typeof y}`)
  }
  return Math.pow(Number(x), Number(y))
}

export function math_random() {
  return Math.random()
}

export function math_round(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.round(Number(x))
}

export function math_sign(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.sign(Number(x))
}

export function math_sin(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.sin(Number(x))
}

export function math_sinh(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.sinh(Number(x))
}

export function math_sqrt(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.sqrt(Number(x))
}

export function math_tan(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.tan(Number(x))
}

export function math_tanh(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.tanh(Number(x))
}

export function math_trunc(x: Value) {
  if (!__is_numeric(x)) {
    throw new Error(`Invalid type for operation: ${typeof x}`)
  }
  return Math.trunc(Number(x))
}
