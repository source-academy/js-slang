import { Value } from '../types'

export function __py_adder(x: Value, y: Value) {
  if (typeof x == typeof y) {
    return x + y
  }
  if (typeof x == 'bigint') {
    return Number(x) + y
  }
  if (typeof y == 'bigint') {
    return x + Number(y)
  }
  return x + y
}

export function __py_minuser(x: Value, y: Value) {
  if (!(typeof x == 'bigint') && !(typeof x == 'number')) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!(typeof y == 'bigint') && !(typeof y == 'number')) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x == 'bigint' && typeof y == 'bigint') {
    return x - y
  }
  if (typeof x == 'number' && typeof y == 'number') {
    return x - y
  }
  if (typeof x == 'bigint' && typeof y == 'number') {
    return Number(x) - y
  }
  if (typeof x == 'number' && typeof y == 'bigint') {
    return x - Number(y)
  }
  return NaN
}

export function __py_multiplier(x: Value, y: Value) {
  if (!(typeof x == 'bigint') && !(typeof x == 'number')) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!(typeof y == 'bigint') && !(typeof y == 'number')) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x == 'bigint' && typeof y == 'bigint') {
    return x * y
  }
  if (typeof x == 'number' && typeof y == 'number') {
    return x * y
  }
  if (typeof x == 'bigint' && typeof y == 'number') {
    return Number(x) * y
  }
  if (typeof x == 'number' && typeof y == 'bigint') {
    return x * Number(y)
  }
  return NaN
}

export function __py_divider(x: Value, y: Value) {
  if (!(typeof x == 'bigint') && !(typeof x == 'number')) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!(typeof y == 'bigint') && !(typeof y == 'number')) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x == 'bigint' && typeof y == 'bigint') {
    return Number(x) / Number(y)
  }
  if (typeof x == 'number' && typeof y == 'number') {
    return x / y
  }
  if (typeof x == 'bigint' && typeof y == 'number') {
    return Number(x) / y
  }
  if (typeof x == 'number' && typeof y == 'bigint') {
    return x / Number(y)
  }
  return NaN
}

export function __py_modder(x: Value, y: Value) {
  if (!(typeof x == 'bigint') && !(typeof x == 'number')) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!(typeof y == 'bigint') && !(typeof y == 'number')) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x == 'bigint' && typeof y == 'bigint') {
    return x % y
  }
  if (typeof x == 'number' && typeof y == 'number') {
    return x % y
  }
  if (typeof x == 'bigint' && typeof y == 'number') {
    return Number(x) % y
  }
  if (typeof x == 'number' && typeof y == 'bigint') {
    return x % Number(y)
  }
  return NaN
}

export function __py_powerer(x: Value, y: Value) {
  if (!(typeof x == 'bigint') && !(typeof x == 'number')) {
    throw new Error('Expected number on left hand side of operation, got ' + typeof x + '.')
  }
  if (!(typeof y == 'bigint') && !(typeof y == 'number')) {
    throw new Error('Expected number on right hand side of operation, got ' + typeof y + '.')
  }
  if (typeof x == 'bigint' && typeof y == 'bigint') {
    let res = BigInt(1)
    for (let i = 0; i < y; i++) {
      res = res * x
    }
    return res
  }
  if (typeof x == 'bigint' && typeof y == 'number') {
    return Math.pow(Number(x), y)
  }
  if (typeof x == 'number' && typeof y == 'bigint') {
    return Math.pow(x, Number(y))
  }
  return Math.pow(Number(x), Number(y))
}

export function __py_floorer(x: Value, y: Value) {
  return BigInt(Math.floor(__py_divider(x, y)))
}

export function __py_unary_plus(x: Value) {
  if (typeof x == 'bigint') {
    return +Number(x)
  }
  return +x
}

export function math_abs(x: Value) {
  return Math.abs(Number(x))
}

export function math_acos(x: Value) {
  return Math.acos(Number(x))
}

export function math_acosh(x: Value) {
  return Math.acosh(Number(x))
}

export function math_asin(x: Value) {
  return Math.asin(Number(x))
}

export function math_asinh(x: Value) {
  return Math.asinh(Number(x))
}

export function math_atan(x: Value) {
  return Math.atan(Number(x))
}

export function math_atan2(y: Value, x: Value) {
  return Math.atan2(Number(y), Number(x))
}

export function math_atanh(x: Value) {
  return Math.atanh(Number(x))
}

export function math_cbrt(x: Value) {
  return Math.cbrt(Number(x))
}

export function math_ceil(x: Value) {
  return Math.ceil(Number(x))
}

export function math_clz32(x: Value) {
  return Math.clz32(Number(x))
}

export function math_cos(x: Value) {
  return Math.cos(Number(x))
}

export function math_cosh(x: Value) {
  return Math.cosh(Number(x))
}

export function math_exp(x: Value) {
  return Math.exp(Number(x))
}

export function math_expm1(x: Value) {
  return Math.expm1(Number(x))
}

export function math_floor(x: Value) {
  return Math.floor(Number(x))
}

export function math_fround(x: Value) {
  return Math.fround(Number(x))
}

export function math_hypot(...elements: Value[]) {
  const coercedElements: number[] = elements.map(el => {
    return Number(el)
  })
  return Math.hypot(...coercedElements)
}

export function math_imul(x: Value, y: Value) {
  return Math.imul(Number(x), Number(y))
}

export function math_log(x: Value) {
  return Math.log(Number(x))
}

export function math_log1p(x: Value) {
  return Math.log1p(Number(x))
}

export function math_log2(x: Value) {
  return Math.log2(Number(x))
}

export function math_log10(x: Value) {
  return Math.log10(Number(x))
}

export function math_max(...elements: Value[]) {
  const coercedElements: number[] = elements.map(el => {
    return Number(el)
  })
  return Math.max(...coercedElements)
}

export function math_min(...elements: Value[]) {
  const coercedElements: number[] = elements.map(el => {
    return Number(el)
  })
  return Math.min(...coercedElements)
}

export function math_pow(x: Value, y: Value) {
  return Math.pow(Number(x), Number(y))
}

export function math_random() {
  return Math.random()
}

export function math_round(x: Value) {
  return Math.round(Number(x))
}

export function math_sign(x: Value) {
  return Math.sign(Number(x))
}

export function math_sin(x: Value) {
  return Math.sin(Number(x))
}

export function math_sinh(x: Value) {
  return Math.sinh(Number(x))
}

export function math_sqrt(x: Value) {
  return Math.sqrt(Number(x))
}

export function math_tan(x: Value) {
  return Math.tan(Number(x))
}

export function math_tanh(x: Value) {
  return Math.tanh(Number(x))
}

export function math_trunc(x: Value) {
  return Math.trunc(Number(x))
}
