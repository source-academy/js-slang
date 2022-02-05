import OpCodes from '../vm/opcodes'
import { Program, SVMFunction } from '../vm/svml-compiler'
import { char_at, get_time, parse_int } from './misc'

// functions should be sorted in alphabetical order. Refer to SVML spec on wiki
// placeholders should be manually replaced with the correct machine code.
// customs require slight modification to the generated code, which is automated
// in the function calls below.
// added _ in front of every function name so that function calls
// use CALLP instead of CALL when compiled.
export const vmPrelude = `
// 0
function _accumulate(f, initial, xs) {
  return is_null(xs) ? initial : f(head(xs), accumulate(f, initial, tail(xs)));
}

// 1
function _append(xs, ys) {
  return is_null(xs) ? ys : pair(head(xs), append(tail(xs), ys));
}

// 2 placeholder
function _array_length(arr) {}

// 3
function _build_list(fun, n) {
  function build(i, fun, already_built) {
    return i < 0 ? already_built : build(i - 1, fun, pair(fun(i), already_built));
  }
  return build(n - 1, fun, null);
}

// 4
function _build_stream(n, fun) {
  function build(i) {
    return i >= n
      ? null
      : pair(fun(i),
        () => build(i + 1));
  }
  return build(0);
}

// 5 custom
// replace MODG opcode (25) with display opcode
// change number of arguments to varargs (-1)
function _display(args) {
  // display(args[0], args[1]);
  // compile this instead for easier replacing
  if (array_length(args) === 0) {
    error('Expected 1 or more arguments, but got ' + stringify(array_length(args)) + '.');
  } else {
    return args[0] % args[1];
  }
}

// 6 custom
// following math_hypot's implementation style
// using the ... operator on the machine
// change number of arguments to varargs (-1)
// replace NOTG opcode with DRAW_DATA opcode
function _draw_data(args) {
  if (array_length(args) === 0) {
    error('Expected 1 or more arguments, but got ' + stringify(array_length(args)) + '.');
  } else {
    !args;
    return args[0];
  }
}

// 7
function _enum_list(start, end) {
  return start > end ? null : pair(start, enum_list(start + 1, end));
}

// 8
function _enum_stream(start, end) {
  return start > end
    ? null
    : pair(start,
      () => enum_stream(start + 1, end));
}

// 9
function _equal(x, y) {
  return is_pair(x) && is_pair(y) ? equal(head(x), head(y)) && equal(tail(x), tail(y)) : x === y;
}

// 10 custom
// replace MODG opcode (25) with error opcode
// change number of arguments to varargs (-1)
function _error(args) {
  // error(args[0], args[1]);
  // compile this instead for easier replacing
  return args[0] % args[1];
}

// 11
function _eval_stream(s, n) {
  return n === 0
    ? null
    : pair(head(s),
      eval_stream(stream_tail(s),
        n - 1));
}

// 12
function _filter(pred, xs) {
  return is_null(xs)
    ? xs
    : pred(head(xs))
    ? pair(head(xs), filter(pred, tail(xs)))
    : filter(pred, tail(xs));
}

// 13
function _for_each(fun, xs) {
  if (is_null(xs)) {
    return true;
  } else {
    fun(head(xs));
    return for_each(fun, tail(xs));
  }
}

// 14
function _head(xs) {
  if (!is_pair(xs)) {
    error('head(xs) expects a pair as argument xs, but encountered ' + stringify(xs));
  } else {
    return xs[0];
  }
}

// 15
function _integers_from(n) {
  return pair(n,
    () => integers_from(n + 1));
}

// 16 placeholder
function _is_array(x) {}

// 17 placeholder
function _is_boolean(x) {}

// 18 placeholder
function _is_function(x) {}

// 19
function _is_list(xs) {
  return is_null(xs) || (is_pair(xs) && is_list(tail(xs)));
}

// 20 placeholder
function _is_null(x) {}

// 21 placeholder
function _is_number(x) {}

// 22
function _is_pair(x) {
  return is_array(x) && array_length(x) === 2;
}

// 23
function _is_stream(xs) {
  return is_null(xs) ||
    (is_pair(xs) &&
    is_function(tail(xs)) &&
    arity(tail(xs)) === 0 &&
    is_stream(stream_tail(xs)));
}

// 24 placeholder
function _is_string(x) {}

// 25 placeholder
function _is_undefined(x) {}

// 26
function _length(xs) {
  return is_null(xs) ? 0 : 1 + length(tail(xs));
}

// 27 custom
// change number of arguments to varargs (-1)
function _list(args) {
  let i = array_length(args) - 1;
  let p = null;
  while (i >= 0) {
    p = pair(args[i], p);
    i = i - 1;
  }
  return p;
}

// 28
function _list_ref(xs, n) {
  return n === 0 ? head(xs) : list_ref(tail(xs), n - 1);
}

// 29
function _list_to_stream(xs) {
  return is_null(xs)
    ? null
    : pair(head(xs),
      () => list_to_stream(tail(xs)));
}

// 30
function _list_to_string(xs) {
    return is_null(xs)
        ? "null"
        : is_pair(xs)
            ? "[" + list_to_string(head(xs)) + "," +
                list_to_string(tail(xs)) + "]"
            : stringify(xs);
}

// 31
function _map(f, xs) {
  return is_null(xs) ? null : pair(f(head(xs)), map(f, tail(xs)));
}

// 32 placeholder
function _math_abs(xs) {}

// 33 placeholder
function _math_acos(xs) {}

// 34 placeholder
function _math_acosh(xs) {}

// 35 placeholder
function _math_asin(xs) {}

// 36 placeholder
function _math_asinh(xs) {}

// 37 placeholder
function _math_atan(xs) {}

// 38 placeholder
function _math_atan2(xs) {}

// 39 placeholder
function _math_atanh(xs) {}

// 40 placeholder
function _math_cbrt(xs) {}

// 41 placeholder
function _math_ceil(xs) {}

// 42 placeholder
function _math_clz32(xs) {}

// 43 placeholder
function _math_cos(xs) {}

// 44 placeholder
function _math_cosh(xs) {}

// 45 placeholder
function _math_exp(xs) {}

// 46 placeholder
function _math_expm1(xs) {}

// 47 placeholder
function _math_floor(xs) {}

// 48 placeholder
function _math_fround(xs) {}

// 49 custom
// can't think of a way to deal with math_hypot
// without incurring a lot of redundant function calls
// so just using the ... operator instead on the machine
// change number of arguments to varargs (-1)
// replace NOTG opcode with MATH_HYPOT opcode
function _math_hypot(args) {
  // compile this instead for easier replacing
  return !args;
}

// 50 placeholder
function _math_imul(xs) {}

// 51 placeholder
function _math_log(xs) {}

// 52 placeholder
function _math_log1p(xs) {}

// 53 placeholder
function _math_log2(xs) {}

// 54 placeholder
function _math_log10(xs) {}

// 55 custom
// replace MODG opcode (25) with math_max opcode
// change number of arguments to varargs (-1)
function _math_max(args) {
  let i = array_length(args) - 1;
  let x = -Infinity;
  while (i >= 0) {
    // x = math_max(args[i],x)
    // compile this instead for easier replacing
    x = args[i] % x;
    i = i - 1;
  }
  return x;
}

// 56 custom
// replace MODG opcode (25) with math_max opcode
// change number of arguments to varargs (-1)
function _math_min(args) {
  let i = array_length(args) - 1;
  let x = Infinity;
  while (i >= 0) {
    // x = math_min(args[i],x)
    // compile this instead for easier replacing
    x = args[i] % x;
    i = i - 1;
  }
  return x;
}

// 57 placeholder
function _math_pow(xs) {}

// 58 placeholder
function _math_random(xs) {}

// 59 placeholder
function _math_round(xs) {}

// 60 placeholder
function _math_sign(xs) {}

// 61 placeholder
function _math_sin(xs) {}

// 62 placeholder
function _math_sinh(xs) {}

// 63 placeholder
function _math_sqrt(xs) {}

// 64 placeholder
function _math_tan(xs) {}

// 65 placeholder
function _math_tanh(xs) {}

// 66 placeholder
function _math_trunc(xs) {}

// 67
function _member(v, xs) {
  return is_null(xs) ? null : v === head(xs) ? xs : member(v, tail(xs));
}

// 68
function _pair(x, y) {
  return [x, y];
}

// 69 placeholder
function _parse_int(x,y) {}

// 70
function _remove(v, xs) {
  return is_null(xs) ? null : v === head(xs) ? tail(xs) : pair(head(xs), remove(v, tail(xs)));
}

// 71
function _remove_all(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
    ? remove_all(v, tail(xs))
    : pair(head(xs), remove_all(v, tail(xs)));
}

// 72
function _reverse(xs) {
  function rev(original, reversed) {
    return is_null(original) ? reversed : rev(tail(original), pair(head(original), reversed));
  }
  return rev(xs, null);
}

// 73 placeholder
function _get_time(x) {}

// 74
function _set_head(xs,x) {
  if (!is_pair(xs)) {
    error('set_head(xs) expects a pair as argument xs, but encountered ' + stringify(xs));
  } else {
    xs[0] = x;
  }
}

// 75
function _set_tail(xs, x) {
  if (!is_pair(xs)) {
    error('set_tail(xs) expects a pair as argument xs, but encountered ' + stringify(xs));
  } else {
    xs[1] = x;
  }
}

// 76 custom
// change number of arguments to varargs (-1)
function _stream(args) {
  let i = array_length(args) - 1;
  let p = null;
  while (i >= 0) {
    p = pair(args[i], p);
    i = i - 1;
  }
  return list_to_stream(p);
}

// 77
function _stream_append(xs, ys) {
  return is_null(xs)
    ? ys
    : pair(head(xs),
      () => stream_append(stream_tail(xs), ys));
}

// 78
function _stream_filter(p, s) {
  return is_null(s)
    ? null
    : p(head(s))
      ? pair(head(s),
        () => stream_filter(p, stream_tail(s)))
      : stream_filter(p, stream_tail(s));
}

// 79
function _stream_for_each(fun, xs) {
    if (is_null(xs)) {
      return true;
    } else {
      fun(head(xs));
      return stream_for_each(fun, stream_tail(xs));
    }
}

// 80
function _stream_length(xs) {
  return is_null(xs)
    ? 0
    : 1 + stream_length(stream_tail(xs));
}

// 81
function _stream_map(f, s) {
  return is_null(s)
    ? null
    : pair(f(head(s)),
      () => stream_map(f, stream_tail(s)));
}

// 82
function _stream_member(x, s) {
  return is_null(s)
    ? null
    : head(s) === x
      ? s
      : stream_member(x, stream_tail(s));
}

// 83
function _stream_ref(s, n) {
  return n === 0
    ? head(s)
    : stream_ref(stream_tail(s), n - 1);
}

// 84
function _stream_remove(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
      ? stream_tail(xs)
      : pair(head(xs),
        () => stream_remove(v, stream_tail(xs)));
}

// 85
function _stream_remove_all(v, xs) {
  return is_null(xs)
    ? null
    : v === head(xs)
      ? stream_remove_all(v, stream_tail(xs))
      : pair(head(xs), () => stream_remove_all(v, stream_tail(xs)));
}

// 86
function _stream_reverse(xs) {
  function rev(original, reversed) {
    return is_null(original)
      ? reversed
      : rev(stream_tail(original),
        pair(head(original), () => reversed));
  }
  return rev(xs, null);
}

// 87
function _stream_tail(xs) {
  if (!is_pair(xs)) {
    error('stream_tail(xs) expects a pair as argument xs, but encountered ' + stringify(xs));
  } else if (!is_function(xs[1])) {
    error('stream_tail(xs) expects a function as the tail of the argument pair xs, ' +
      'but encountered ' + stringify(xs[1]));
  } else {
    return xs[1]();
  }
}

// 88
function _stream_to_list(xs) {
  return is_null(xs)
    ? null
    : pair(head(xs), stream_to_list(stream_tail(xs)));
}

// 89
function _tail(xs) {
  if (!is_pair(xs)) {
    error('tail(xs) expects a pair as argument xs, but encountered ' + stringify(xs));
  } else {
    return xs[1];
  }
}

// 90 placeholder
function _stringify(x) {}

// 91 custom
// change number of args to varargs
// replace NOTG opcode with PROMPT opcode
function _prompt(args) {
  if (array_length(args) === 0) {
    const p = '';
    return !p;
  } else {
    return !args[0];
  }
}

// 92 custom
// replace MODG opcode (25) with display_list opcode
// change number of arguments to varargs (-1)
function _display_list(args) {
  // display_list(args[0], args[1]);
  // compile this instead for easier replacing
  return args[0] % args[1];
}

// 93 placeholder
function _char_at(str,index) {}

// 94 placeholder
function _arity(f) {}

// hack to make the call to Program easier, just replace the index 95 (number of primitive functions + 2)
(() => 0)();
`

// list of all primitive functions in alphabetical order. This determines the index
// of the function in the program array.
// If adding support for primitive functions, need to modify this array and the prelude
// above.
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
  'get_time',
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
  'stringify',
  'prompt',
  'display_list',
  'char_at',
  'arity'
]

export const VARARGS_NUM_ARGS = -1

// name, opcode, number of arguments, has return value
export const INTERNAL_FUNCTIONS: [string, OpCodes, number, boolean][] = [
  ['test_and_set', OpCodes.TEST_AND_SET, 1, true],
  ['clear', OpCodes.CLEAR, 1, false],
  ['concurrent_execute', OpCodes.EXECUTE, VARARGS_NUM_ARGS, false]
]

// for each function, replace a specified opcode with another opcode
const VARARG_PRIMITIVES: [string, number?, number?][] = [
  ['display', OpCodes.MODG, OpCodes.DISPLAY],
  ['error', OpCodes.MODG, OpCodes.ERROR],
  ['math_max', OpCodes.MODG, OpCodes.MATH_MAX],
  ['math_min', OpCodes.MODG, OpCodes.MATH_MIN],
  ['math_hypot', OpCodes.NOTG, OpCodes.MATH_HYPOT],
  ['list'],
  ['draw_data', OpCodes.NOTG, OpCodes.DRAW_DATA],
  ['stream'],
  ['prompt', OpCodes.NOTG, OpCodes.PROMPT],
  ['display_list', OpCodes.MODG, OpCodes.DISPLAY_LIST]
]

// primitives without a function should be manually implemented
export const NULLARY_PRIMITIVES: [string, number, any?][] = [
  ['math_random', OpCodes.MATH_RANDOM, Math.random],
  ['get_time', OpCodes.RUNTIME, get_time]
]

export const UNARY_PRIMITIVES: [string, number, any?][] = [
  ['array_length', OpCodes.ARRAY_LEN],
  ['is_array', OpCodes.IS_ARRAY],
  ['is_boolean', OpCodes.IS_BOOL],
  ['is_function', OpCodes.IS_FUNC],
  ['is_null', OpCodes.IS_NULL],
  ['is_number', OpCodes.IS_NUMBER],
  ['is_string', OpCodes.IS_STRING],
  ['is_undefined', OpCodes.IS_UNDEFINED],
  ['math_abs', OpCodes.MATH_ABS, Math.abs],
  ['math_acos', OpCodes.MATH_ACOS, Math.acos],
  ['math_acosh', OpCodes.MATH_ACOSH, Math.acosh],
  ['math_asin', OpCodes.MATH_ASIN, Math.asin],
  ['math_asinh', OpCodes.MATH_ASINH, Math.asinh],
  ['math_atan', OpCodes.MATH_ATAN, Math.atan],
  ['math_atanh', OpCodes.MATH_ATANH, Math.atanh],
  ['math_cbrt', OpCodes.MATH_CBRT, Math.cbrt],
  ['math_ceil', OpCodes.MATH_CEIL, Math.ceil],
  ['math_clz32', OpCodes.MATH_CLZ32, Math.clz32],
  ['math_cos', OpCodes.MATH_COS, Math.cos],
  ['math_cosh', OpCodes.MATH_COSH, Math.cosh],
  ['math_exp', OpCodes.MATH_EXP, Math.exp],
  ['math_expm1', OpCodes.MATH_EXPM1, Math.expm1],
  ['math_floor', OpCodes.MATH_FLOOR, Math.floor],
  ['math_fround', OpCodes.MATH_FROUND, Math.fround],
  ['math_log', OpCodes.MATH_LOG, Math.log],
  ['math_log1p', OpCodes.MATH_LOG1P, Math.log1p],
  ['math_log2', OpCodes.MATH_LOG2, Math.log2],
  ['math_log10', OpCodes.MATH_LOG10, Math.log10],
  ['math_round', OpCodes.MATH_ROUND, Math.round],
  ['math_sign', OpCodes.MATH_SIGN, Math.sign],
  ['math_sin', OpCodes.MATH_SIN, Math.sin],
  ['math_sinh', OpCodes.MATH_SINH, Math.sinh],
  ['math_sqrt', OpCodes.MATH_SQRT, Math.sqrt],
  ['math_tan', OpCodes.MATH_TAN, Math.tan],
  ['math_tanh', OpCodes.MATH_TANH, Math.tanh],
  ['math_trunc', OpCodes.MATH_TRUNC, Math.trunc],
  ['stringify', OpCodes.STRINGIFY],
  ['arity', OpCodes.ARITY]
]

export const BINARY_PRIMITIVES: [string, number, any?][] = [
  ['math_atan2', OpCodes.MATH_ATAN2, Math.atan2],
  ['math_imul', OpCodes.MATH_IMUL, Math.imul],
  ['math_pow', OpCodes.MATH_POW, Math.pow],
  ['parse_int', OpCodes.PARSE_INT, parse_int],
  ['char_at', OpCodes.CHAR_AT, char_at]
]

export const EXTERNAL_PRIMITIVES: [string, number][] = [
  ['display', OpCodes.DISPLAY],
  ['draw_data', OpCodes.DRAW_DATA],
  ['error', OpCodes.ERROR],
  ['prompt', OpCodes.PROMPT],
  ['display_list', OpCodes.DISPLAY_LIST]
]

export const CONSTANT_PRIMITIVES: [string, any][] = [
  ['undefined', undefined],
  ['Infinity', Infinity],
  ['NaN', NaN],
  ['math_E', Math.E],
  ['math_LN2', Math.LN2],
  ['math_LN10', Math.LN10],
  ['math_LOG2E', Math.LOG2E],
  ['math_LOG10E', Math.LOG10E],
  ['math_PI', Math.PI],
  ['math_SQRT1_2', Math.SQRT1_2],
  ['math_SQRT2', Math.SQRT2]
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

// replaces prelude SVMFunction array with generated instructions
export function generatePrimitiveFunctionCode(prelude: Program) {
  const preludeFunctions = prelude[1]
  const functions: [number, SVMFunction][] = []
  const nameToIndexMap = new Map<string, number>()
  function convertPrimitiveVarArgs() {
    VARARG_PRIMITIVES.forEach(f => {
      const index = nameToIndexMap.get(f[0])!
      const opcodeToReplace = f[1]
      const opcodeToUse = f[2]
      // replace function's numargs to VARARGS_NUM_ARGS as indicator
      preludeFunctions[index + 1][2] = VARARGS_NUM_ARGS
      // replace opcode with corresponding opcode
      if (opcodeToReplace !== undefined && opcodeToUse !== undefined) {
        const instructions = preludeFunctions[index + 1][3]
        instructions.forEach(ins => {
          if (ins[0] === opcodeToReplace) ins[0] = opcodeToUse
        })
      }
    })
  }

  PRIMITIVE_FUNCTION_NAMES.forEach((name, index) => {
    nameToIndexMap.set(name, index)
  })
  NULLARY_PRIMITIVES.forEach(f =>
    functions.push(generateNullaryPrimitive(nameToIndexMap.get(f[0])!, f[1]))
  )
  UNARY_PRIMITIVES.forEach(f =>
    functions.push(generateUnaryPrimitive(nameToIndexMap.get(f[0])!, f[1]))
  )
  BINARY_PRIMITIVES.forEach(f =>
    functions.push(generateBinaryPrimitive(nameToIndexMap.get(f[0])!, f[1]))
  )

  functions.forEach(func => {
    const newFunc = func[1]
    const indexToReplace = func[0] + 1 // + 1 due to global env
    preludeFunctions[indexToReplace] = newFunc
  })
  convertPrimitiveVarArgs()
}
