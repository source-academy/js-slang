import { SVMFunction, OpCodes } from '../vm/svml-compiler'

export const vmPrelude = `
// functions should be sorted by alphabetical order. Refer to SVML spec on wiki
// placeholders should be manually replaced with the correct machine code

// 0
function accumulate(f, initial, xs) {
  return is_null(xs) ? initial : f(head(xs), accumulate(f, initial, tail(xs)));
}

// 1
function append(xs, ys) {
  return is_null(xs) ? ys : pair(head(xs), append(tail(xs), ys));
}

// 2 placeholder
function array_length(arr) {
    return 0;
}

// 3
function build_list(n, fun) {
  function build(i, fun, already_built) {
    return i < 0 ? already_built : build(i - 1, fun, pair(fun(i), already_built));
  }
  return build(n - 1, fun, null);
}

// 4
function build_stream(n, fun) {
  function build(i) {
    return i >= n
      ? null
      : pair(fun(i),
        () => build(i + 1));
  }
  return build(0);
}

// 5 placeholder
function display(v) {
  return 1;
}

// 6 placeholder
function draw_data(v) {
  return 1;
}

// 7
function enum_list(start, end) {
  return start > end ? null : pair(start, enum_list(start + 1, end));
}

// 8
function enum_stream(start, end) {
  return start > end
    ? null
    : pair(start,
      () => enum_stream(start + 1, end));
}

// 9
function equal(x, y) {
  return is_pair(x) && is_pair(y) ? equal(head(x), head(y)) && equal(tail(x), tail(y)) : x === y;
}

// 10 placeholder
function error(v) {
  return 1;
}

// 11
function eval_stream(s, n) {
  return n === 0
    ? null
    : pair(head(s),
      eval_stream(stream_tail(s),
        n - 1));
}

// 12
function filter(pred, xs) {
  return is_null(xs)
    ? xs
    : pred(head(xs))
    ? pair(head(xs), filter(pred, tail(xs)))
    : filter(pred, tail(xs));
}

// 13
function for_each(fun, xs) {
  if (is_null(xs)) {
    return true;
  } else {
    fun(head(xs));
    return for_each(fun, tail(xs));
  }
}

// 14 unlike Source version, does not fail gracefully
function head(xs) {
  return xs[0];
}

// 15
function integers_from(n) {
  return pair(n,
    () => integers_from(n + 1));
}

// 16 placeholder
function is_array(x) {
  return 1;
}

// 17 placeholder
function is_boolean(x) {
  return 1;
}

// 18 placeholder
function is_function(x) {
  return 1;
}

// 19
function is_list(xs) {
  return is_null(xs) || (is_pair(xs) && is_list(tail(xs)));
}

// 20 placeholder
function is_null(x) {
  return 1;
}

// 21 placeholder
function is_number(x) {
  return 1;
}

// 22 
function is_pair(x) {
  return is_array(x) && array_length(x) === 2;
}

// 23
function is_stream(xs) {
  return is_null(xs) || (is_pair(xs) && is_stream(stream_tail(xs)));
}

// 24 placeholder
function is_string(x) {
  return 1;
}

// 25 placeholder
function is_undefined(x) {
  return 1;
}

// 26
function length(xs) {
  return is_null(xs) ? 0 : 1 + length(tail(xs));
}

// 27 placeholder
function list(xs) {
  return 1;
}

// 28
function list_ref(xs, n) {
  return n === 0 ? head(xs) : list_ref(tail(xs), n - 1);
}

// 29
function list_to_stream(xs) {
  return is_null(xs)
    ? null
    : pair(head(xs),
      () => list_to_stream(tail(xs)));
}

// 30
function list_to_string(xs) {
    return is_null(xs)
        ? "null"
        : is_pair(xs)
            ? "[" + list_to_string(head(xs)) + "," +
                list_to_string(tail(xs)) + "]"
            : stringify(xs);
}

// 31
function map(f, xs) {
  return is_null(xs) ? null : pair(f(head(xs)), map(f, tail(xs)));
}

// 32 placeholder
function math_abs(xs) {
  return 1;
}

// 33 placeholder
function math_acos(xs) {
  return 1;
}

// 34 placeholder
function math_acosh(xs) {
  return 1;
}

// 35 placeholder
function math_asin(xs) {
  return 1;
}

// 36 placeholder
function math_asinh(xs) {
  return 1;
}

// 37 placeholder
function math_atan(xs) {
  return 1;
}

// 38 placeholder
function math_atan2(xs) {
  return 1;
}

// 39 placeholder
function math_atanh(xs) {
  return 1;
}

// 40 placeholder
function math_cbrt(xs) {
  return 1;
}

// 41 placeholder
function math_ceil(xs) {
  return 1;
}

// 42 placeholder
function math_clz32(xs) {
  return 1;
}

// 43 placeholder
function math_cos(xs) {
  return 1;
}

// 44 placeholder
function math_cosh(xs) {
  return 1;
}

// 45 placeholder
function math_exp(xs) {
  return 1;
}

// 46 placeholder
function math_expm1(xs) {
  return 1;
}

// 47 placeholder
function math_floor(xs) {
  return 1;
}

// 48 placeholder
function math_fround(xs) {
  return 1;
}

// 49 placeholder
function math_hypot(xs) {
  return 1;
}

// 50 placeholder
function math_imul(xs) {
  return 1;
}

// 51 placeholder
function math_log(xs) {
  return 1;
}

// 52 placeholder
function math_log1p(xs) {
  return 1;
}

// 53 placeholder
function math_log2(xs) {
  return 1;
}

// 54 placeholder
function math_log10(xs) {
  return 1;
}

// 55 placeholder
function math_max(xs) {
  return 1;
}

// 56 placeholder
function math_min(xs) {
  return 1;
}

// 57 placeholder
function math_pow(xs) {
  return 1;
}

// 58 placeholder
function math_random(xs) {
  return 1;
}

// 59 placeholder
function math_round(xs) {
  return 1;
}

// 60 placeholder
function math_sign(xs) {
  return 1;
}

// 61 placeholder
function math_sin(xs) {
  return 1;
}

// 62 placeholder
function math_sinh(xs) {
  return 1;
}

// 63 placeholder
function math_sqrt(xs) {
  return 1;
}

// 64 placeholder
function math_tan(xs) {
  return 1;
}

// 65 placeholder
function math_tanh(xs) {
  return 1;
}

// 66 placeholder
function math_trunc(xs) {
  return 1;
}

// 67
function member(v, xs) {
  return is_null(xs) ? null : v === head(xs) ? xs : member(v, tail(xs));
}

// 68
function pair(x, y) {
  return [x, y];
}

// 69 placeholder
function parse_int(x,y) {
  return 1;
}

// 70
function remove(v, xs) {
  return is_null(xs) ? null : v === head(xs) ? tail(xs) : pair(head(xs), remove(v, tail(xs)));
}

// 71
function remove_all(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
    ? remove_all(v, tail(xs))
    : pair(head(xs), remove_all(v, tail(xs)));
}

// 72
function reverse(xs) {
  function rev(original, reversed) {
    return is_null(original) ? reversed : rev(tail(original), pair(head(original), reversed));
  }
  return rev(xs, null);
}

// 73 placeholder
function runtime(x) {
  return 1;
}

// 74 unlike Source version, does not fail gracefully
function set_head(xs,x) {
  xs[0] = x;
  return undefined;
}

// 75 unlike Source version, does not fail gracefully
function set_tail(xs, x) {
  xs[1] = x;
  return undefined;
}

// 76 placeholder
function stream(x,y) {
  return 1;
}

// 77
function stream_append(xs, ys) {
  return is_null(xs)
    ? ys
    : pair(head(xs),
      () => stream_append(stream_tail(xs), ys));
}

// 78
function stream_filter(p, s) {
  return is_null(s)
    ? null
    : p(head(s))
      ? pair(head(s),
        () => stream_filter(p, stream_tail(s)))
      : stream_filter(p, stream_tail(s));
}

// 79
function stream_for_each(fun, xs) {
    if (is_null(xs)) {
      return true;
    } else {
      fun(head(xs));
      return stream_for_each(fun, stream_tail(xs));
    }
}

// 80
function stream_length(xs) {
  return is_null(xs)
    ? 0
    : 1 + stream_length(stream_tail(xs));
}

// 81
function stream_map(f, s) {
  return is_null(s)
    ? null
    : pair(f(head(s)),
      () => stream_map(f, stream_tail(s)));
}

// 82
function stream_member(x, s) {
  return is_null(s)
    ? null
    : head(s) === x
      ? s
      : stream_member(x, stream_tail(s));
}

// 83
function stream_ref(s, n) {
  return n === 0
    ? head(s)
    : stream_ref(stream_tail(s), n - 1);
}

// 84
function stream_remove(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
      ? stream_tail(xs)
      : pair(head(xs),
        () => stream_remove(v, stream_tail(xs)));
}

// 85
function stream_remove_all(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
      ? stream_remove_all(v, stream_tail(xs))
      : pair(head(xs), () => stream_remove_all(v, stream_tail(xs)));
}

// 86
function stream_reverse(xs) {
  function rev(original, reversed) {
    return is_null(original)
      ? reversed
      : rev(stream_tail(original),
        pair(head(original), () => reversed));
  }
  return rev(xs, null);
}

// 87 unlike Source version, does not fail gracefully
function stream_tail(xs) {
    return xs();
}

// 88
function stream_to_list(xs) {
  return is_null(xs)
    ? null
    : pair(head(xs), stream_to_list(stream_tail(xs)));
}

// 89 unlike Source version, does not fail gracefully
function tail(xs) {
  return xs[1];
}

// 90 placeholder
function stringify(x) {
  return 1;
}

// hack to make the call to Program easier, just replace the index 92
(() => 0)();
`

// list of primitive functions in alphabetical order
export const PRIMITIVE_FUNCTION_NAMES = [
  'accumulate',
  'append',
  'array_length',
  'build_list',
  'build_stream',
  'display',
  'draw_data',
  'enum_list',
  'enum_stream',
  'equal',
  'error',
  'eval_stream',
  'filter',
  'for_each',
  'head',
  'integers_from',
  'is_array',
  'is_boolean',
  'is_function',
  'is_list',
  'is_null',
  'is_number',
  'is_pair',
  'is_stream',
  'is_string',
  'is_undefined',
  'length',
  'list',
  'list_ref',
  'list_to_stream',
  'list_to_string',
  'map',
  'math_abs',
  'math_acos',
  'math_acosh',
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
  'math_expm1',
  'math_floor',
  'math_fround',
  'math_hypot',
  'math_imul',
  'math_log',
  'math_log1p',
  'math_log2',
  'math_log10',
  'math_max',
  'math_min',
  'math_pow',
  'math_random',
  'math_round',
  'math_sign',
  'math_sin',
  'math_sinh',
  'math_sqrt',
  'math_tan',
  'math_tanh',
  'math_trunc',
  'member',
  'pair',
  'parse_int',
  'remove',
  'remove_all',
  'reverse',
  'runtime',
  'set_head',
  'set_tail',
  'stream',
  'stream_append',
  'stream_filter',
  'stream_for_each',
  'stream_length',
  'stream_map',
  'stream_member',
  'stream_ref',
  'stream_remove',
  'stream_remove_all',
  'stream_reverse',
  'stream_tail',
  'stream_to_list',
  'tail',
  'stringify'
]

// array of [index, SVMFunction] to manually map over
export const CUSTOM_PRIMITIVES: [string, SVMFunction][] = [
  // display
  ['display', [0, 0, -1, []]],

  // draw_data TODO
  ['draw_data', [0, 0, 0, []]],

  // error TODO
  ['error', [0, 0, 0, []]],
  // list
  /* code:
    function f(args) {
      let i = array_length(args) - 1;
      let p = null;
      while (i >= 0) {
        p = pair(args[i], p);
        i = i - 1;
      }
      return p;
    }
  */
  [
    'list',
    [
      3,
      3,
      -1, // use -1 to indicate varargs
      [
        [42, 0],
        [66, 2, 1],
        [2, 1],
        [19],
        [45, 1],
        [11],
        [14],
        [12],
        [45, 2],
        [11],
        [14],
        [42, 1],
        [2, 0],
        [35],
        [61, 18],
        [76, 0],
        [48, 0, 1],
        [48, 1, 1],
        [54],
        [48, 2, 1],
        [66, 68, 2],
        [51, 2, 1],
        [11],
        [14],
        [48, 1, 1],
        [2, 1],
        [19],
        [51, 1, 1],
        [11],
        [14],
        [77],
        [62, -20],
        [11],
        [14],
        [42, 2],
        [70]
      ]
    ]
  ],
  // math_hypot varargs TODO
  ['math_hypot', [0, 0, -1, []]],

  // math_max varargs TODO
  ['math_max', [0, 0, -1, []]],

  // math_min varargs TODO
  ['math_min', [0, 0, -1, []]],

  // stream TODO
  ['stream', [0, 0, -1, []]]
]

export const NULLARY_PRIMITIVES: [string, number][] = [
  ['math_random', OpCodes.MATH_RANDOM],
  ['runtime', OpCodes.RUNTIME]
]

export const UNARY_PRIMITIVES: [string, number][] = [
  ['array_length', OpCodes.ARRAY_LEN],
  ['is_array', OpCodes.IS_ARRAY],
  ['is_boolean', OpCodes.IS_BOOL],
  ['is_function', OpCodes.IS_FUNC],
  ['is_null', OpCodes.IS_NULL],
  ['is_number', OpCodes.IS_NUMBER],
  ['is_string', OpCodes.IS_STRING],
  ['is_undefined', OpCodes.IS_UNDEFINED],
  ['math_abs', OpCodes.MATH_ABS],
  ['math_acos', OpCodes.MATH_ACOS],
  ['math_acosh', OpCodes.MATH_ACOSH],
  ['math_asin', OpCodes.MATH_ASIN],
  ['math_asinh', OpCodes.MATH_ASINH],
  ['math_atan', OpCodes.MATH_ATAN],
  ['math_atan2', OpCodes.MATH_ATAN2],
  ['math_atanh', OpCodes.MATH_ATANH],
  ['math_cbrt', OpCodes.MATH_CBRT],
  ['math_ceil', OpCodes.MATH_CEIL],
  ['math_clz32', OpCodes.MATH_CLZ32],
  ['math_cos', OpCodes.MATH_COS],
  ['math_cosh', OpCodes.MATH_COSH],
  ['math_exp', OpCodes.MATH_EXP],
  ['math_expm1', OpCodes.MATH_EXPM1],
  ['math_floor', OpCodes.MATH_FLOOR],
  ['math_fround', OpCodes.MATH_FROUND],
  ['math_log', OpCodes.MATH_LOG],
  ['math_log1p', OpCodes.MATH_LOG1P],
  ['math_log2', OpCodes.MATH_LOG2],
  ['math_log10', OpCodes.MATH_LOG10],
  ['math_round', OpCodes.MATH_ROUND],
  ['math_sign', OpCodes.MATH_SIGN],
  ['math_sin', OpCodes.MATH_SIN],
  ['math_sinh', OpCodes.MATH_SINH],
  ['math_sqrt', OpCodes.MATH_SQRT],
  ['math_tan', OpCodes.MATH_TAN],
  ['math_tanh', OpCodes.MATH_TANH],
  ['math_trunc', OpCodes.MATH_TRUNC],
  ['stringify', OpCodes.STRINGIFY]
]

export const BINARY_PRIMITIVES: [string, number][] = [
  ['math_imul', OpCodes.MATH_IMUL],
  ['math_pow', OpCodes.MATH_POW],
  ['parse_int', OpCodes.PARSE_INT]
]

// helper functions to generate machine code
function generateNullaryPrimitive(index: number, opcode: number): [number, SVMFunction] {
  return [index, [1, 0, 0, [[opcode], [OpCodes.RETG]]]]
}

function generateUnaryPrimitive(index: number, opcode: number): [number, SVMFunction] {
  return [index, [1, 1, 1, [[OpCodes.LDLG, 0], [opcode], [OpCodes.RETG]]]]
}

function generateBinaryPrimitive(index: number, opcode: number): [number, SVMFunction] {
  return [index, [2, 2, 2, [[OpCodes.LDLG, 0], [OpCodes.LDLG, 1], [opcode], [OpCodes.RETG]]]]
}

export function generatePrimitiveFunctionCode() {
  const functions: [number, SVMFunction][] = []
  const nameToIndexMap = new Map<string, number>()
  PRIMITIVE_FUNCTION_NAMES.forEach((name, index) => {
    nameToIndexMap.set(name, index)
  })
  CUSTOM_PRIMITIVES.forEach(f => functions.push([nameToIndexMap.get(f[0])!, f[1]]))
  NULLARY_PRIMITIVES.forEach(f =>
    functions.push(generateNullaryPrimitive(nameToIndexMap.get(f[0])!, f[1]))
  )
  UNARY_PRIMITIVES.forEach(f =>
    functions.push(generateUnaryPrimitive(nameToIndexMap.get(f[0])!, f[1]))
  )
  BINARY_PRIMITIVES.forEach(f =>
    functions.push(generateBinaryPrimitive(nameToIndexMap.get(f[0])!, f[1]))
  )
  return functions
}
