const predefined = new Set([
  '-',
  '*',
  '/',
  '%',
  '&&',
  '||',
  '!',
  '+',
  '===',
  '!==',
  '>',
  '>=',
  '<',
  '<=',
  'display',
  'error',
  'Infinity',
  'is_boolean',
  'is_function',
  'is_number',
  'is_string',
  'is_undefined',
  'math_abs',
  'math_acosh',
  'math_acos',
  'math_asin',
  'math_asinh',
  'math_atan',
  'math_atan2',
  'math_atanh',
  'math_cbrt',
  'math_ceil',
  'math_clz32',
  'math_cos',
  'math_cosh',
  'math_exp',
  'math_expml',
  'math_floor',
  'math_fround',
  'math_hypot',
  'math_imul',
  'math_LN2',
  'math_LN10',
  'math_log',
  'math_log1p',
  'math_log2',
  'math_LOG2E',
  'math_log10',
  'math_LOG10E',
  'math_max',
  'math_min',
  'math_PI',
  'math_pow',
  'math_random',
  'math_round',
  'math_sign',
  'math_sin',
  'math_sinh',
  'math_sqrt',
  'math_SQRT1_2',
  'math_SQRT2',
  'math_tan',
  'math_tanh',
  'math_trunc',
  'NaN',
  'parse_int',
  'prompt',
  'runtime',
  'stringify',
  'undefined'
])

export function printTypeConstraints(typeContraints: Map<number, number | string>) {
  console.log('Printing Type Constraints')
  for (const [key, value] of typeContraints) {
    console.log(`T${key} = T${value}`)
  }
}

export function printTypeEnvironment(typeEnvironment: Map<any, any>) {
  console.log('Printing Type Environment')
  for (let [key, value] of typeEnvironment) {
    if (predefined.has(key)) {
      continue
    }
    if (typeof value === 'object') {
      value = JSON.stringify(value)
    }
    console.log(`${key} = T${value}`)
  }
}
