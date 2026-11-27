/**
 * The members of `Math` that Source has as `math_<name>`: the functions and constants of
 * ECMAScript 2015, which is what the language is specified to have.
 *
 * They are listed, and not found by enumerating `Math`, because an engine adds members to `Math` as
 * the standard grows (V8 13, in Node 24 and the Chrome of 2025, has `Math.f16round`), and the
 * language that a program is run in would then depend on the engine that it happens to run on. The
 * order is the one that engines give `Math`, so that the builtins are defined in the order that they
 * always were.
 */
export const MATH_LIBRARY_NAMES = [
  'abs',
  'acos',
  'acosh',
  'asin',
  'asinh',
  'atan',
  'atanh',
  'atan2',
  'ceil',
  'cbrt',
  'expm1',
  'clz32',
  'cos',
  'cosh',
  'exp',
  'floor',
  'fround',
  'hypot',
  'imul',
  'log',
  'log1p',
  'log2',
  'log10',
  'max',
  'min',
  'pow',
  'random',
  'round',
  'sign',
  'sin',
  'sinh',
  'sqrt',
  'tan',
  'tanh',
  'trunc',
  'E',
  'LN10',
  'LN2',
  'LOG10E',
  'LOG2E',
  'PI',
  'SQRT1_2',
  'SQRT2',
] as const satisfies readonly (keyof Math)[];
