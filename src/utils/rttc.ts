import type es from 'estree';
import {
  InvalidCallbackError,
  InvalidNumberParameterError,
  InvalidParameterTypeError,
  type InvalidNumberParameterErrorOptions,
} from '../errors/runtimeErrors';
import { RuntimeSourceError } from '../errors/base';
import { Chapter } from '../langs';
import type { Node, Value } from '../types';

const LHS = ' on left hand side of operation';
const RHS = ' on right hand side of operation';

/**
 * Error type to be thrown by runtime type checking functions. This is usually caused by a user
 * trying to do something that would work in Javascript (like `'1' - 1`) but is forbidden
 * in Source.
 */
export class RuntimeTypeError extends RuntimeSourceError<Node> {
  constructor(
    node: Node,
    public readonly side: string,
    public readonly expected: string,
    public readonly got: string,
    public readonly chapter: Chapter = Chapter.SOURCE_4,
  ) {
    super(node);
  }

  public override explain() {
    const displayGot =
      this.got === 'array' ? (this.chapter <= 2 ? 'pair' : 'compound data') : this.got;
    return `Expected ${this.expected}${this.side}, got ${displayGot}.`;
  }

  public override elaborate() {
    return this.explain();
  }
}

// We need to define our own typeof in order for null/array to display properly in error messages
const typeOf = (v: Value) => {
  if (v === null) {
    return 'null';
  } else if (Array.isArray(v)) {
    return 'array';
  } else {
    return typeof v;
  }
};

const isNumber = (v: Value) => typeof v === 'number';
// See section 4 of https://2ality.com/2012/12/arrays.html
// v >>> 0 === v checks that v is a valid unsigned 32-bit int
const isArrayIndex = (v: Value): v is number => isNumber(v) && v >>> 0 === v && v < 2 ** 32 - 1;
const isString = (v: Value) => typeof v === 'string';
const isBool = (v: Value) => typeof v === 'boolean';
const isObject = (v: Value): v is object => typeOf(v) === 'object';
const isArray = (v: Value): v is unknown[] => typeOf(v) === 'array';

export function checkUnaryExpression(
  node: Node,
  operator: '!',
  value: unknown,
  chapter?: Chapter,
): asserts value is boolean;
export function checkUnaryExpression(
  node: Node,
  operator: '-' | '+',
  value: unknown,
  chapter?: Chapter,
): asserts value is number;
export function checkUnaryExpression(
  node: Node,
  operator: es.UnaryOperator,
  value: unknown,
  chapter?: Chapter,
): asserts value is number | boolean;
export function checkUnaryExpression(
  node: Node,
  operator: es.UnaryOperator,
  value: unknown,
  chapter: Chapter = Chapter.SOURCE_4,
) {
  if ((operator === '+' || operator === '-') && !isNumber(value)) {
    throw new RuntimeTypeError(node, '', 'number', typeOf(value), chapter);
  } else if (operator === '!' && !isBool(value)) {
    throw new RuntimeTypeError(node, '', 'boolean', typeOf(value), chapter);
  }
}

export function checkBinaryExpression(
  node: Node,
  operator: '+',
  chapter: Chapter,
  values: [unknown, unknown],
): asserts values is [string, string] | [number, number];
export function checkBinaryExpression(
  node: Node,
  operator: '-' | '*' | '/' | '<' | '<=' | '>' | '>=' | '%',
  chapter: Chapter,
  values: [unknown, unknown],
): asserts values is [number, number];
export function checkBinaryExpression(
  node: Node,
  operator: '===' | '!==',
  chapter: Chapter.SOURCE_1 | Chapter.SOURCE_2,
  values: [unknown, unknown],
): asserts values is [string, string] | [number, number];
export function checkBinaryExpression<T>(
  node: Node,
  operator: '===' | '!==',
  chapter: Exclude<Chapter, Chapter.SOURCE_1 | Chapter.SOURCE_2>,
  values: [unknown, unknown],
): asserts values is [T, T];
export function checkBinaryExpression(
  node: Node,
  operator: es.BinaryOperator,
  chapter: Chapter,
  values: [unknown, unknown],
): asserts values is [any, any];
export function checkBinaryExpression(
  node: Node,
  operator: es.BinaryOperator,
  chapter: Chapter,
  [left, right]: [unknown, unknown],
) {
  switch (operator) {
    case '-':
    case '*':
    case '/':
    case '%': {
      if (!isNumber(left)) {
        throw new RuntimeTypeError(node, LHS, 'number', typeOf(left), chapter);
      } else if (!isNumber(right)) {
        throw new RuntimeTypeError(node, RHS, 'number', typeOf(right), chapter);
      } else {
        return;
      }
    }
    case '+':
    case '<':
    case '<=':
    case '>':
    case '>=':
    case '!==':
    case '===': {
      if (chapter > 2 && (operator === '===' || operator === '!==')) {
        return;
      }
      if (isNumber(left)) {
        if (!isNumber(right))
          throw new RuntimeTypeError(node, RHS, 'number', typeOf(right), chapter);
      } else if (isString(left)) {
        if (!isString(right))
          throw new RuntimeTypeError(node, RHS, 'string', typeOf(right), chapter);
      } else {
        throw new RuntimeTypeError(node, LHS, 'string or number', typeOf(left), chapter);
      }
      return;
    }
    default:
      return;
  }
}

export function checkIfStatement(
  node: Node,
  test: unknown,
  chapter: Chapter = Chapter.SOURCE_4,
): asserts test is boolean {
  if (!isBool(test)) {
    throw new RuntimeTypeError(node, ' as condition', 'boolean', typeOf(test), chapter);
  }
}

const MAX_SOURCE_ARRAY_INDEX = 4294967295;
export function checkoutofRange(node: Node, index: Value, chapter: Chapter = Chapter.SOURCE_4) {
  if (index < 0 || index > MAX_SOURCE_ARRAY_INDEX ) { // as per Source 3 spec
    throw new RuntimeTypeError(node, ' in reasonable range', 'index', 'out of range', chapter);
  }
}

export function checkMemberAccess(
  node: Node,
  args: [Value, Value],
): asserts args is [object, string | number] | [unknown[], number] {
  const [obj, prop] = args;

  if (isObject(obj)) {
    if (!isString(prop)) {
      throw new RuntimeTypeError(node, ' as prop', 'string', typeOf(prop));
    }
  } else if (isArray(obj)) {
    if (!isArrayIndex(prop)) {
      if (isNumber(prop)) {
        throw new RuntimeTypeError(node, ' as prop', 'array index', 'other number');
      } else {
        throw new RuntimeTypeError(node, ' as prop', 'array index', typeOf(prop));
      }
    }
  }

  throw new RuntimeTypeError(node, '', 'object or array', typeOf(obj));
}

export function checkArray(
  node: Node,
  maybeArray: Value,
  chapter: Chapter = Chapter.SOURCE_4,
): asserts maybeArray is unknown[] {
  if (!isArray(maybeArray)) {
    throw new RuntimeTypeError(node, '', 'array', typeOf(maybeArray), chapter);
  }
}

type TupleOfLengthHelper<T extends number, U, V extends U[] = []> = V['length'] extends T
  ? V
  : TupleOfLengthHelper<T, U, [...V, U]>;

/**
 * Utility type that represents a tuple of a specific length
 */
export type TupleOfLength<T extends number, U = unknown> = TupleOfLengthHelper<T, U>;

/**
 * Type guard for checking that the provided value is a function and that it has the specified number of parameters.
 * Of course at runtime parameter types are not checked, so this is only useful when combined with TypeScript types.
 */
export function isFunctionOfLength<T extends (...args: any[]) => any>(
  f: (...args: any) => any,
  l: Parameters<T>['length'],
): f is T;
export function isFunctionOfLength<T extends number>(
  f: unknown,
  l: T,
): f is (...args: TupleOfLength<T>) => unknown;
export function isFunctionOfLength(f: unknown, l: number) {
  // TODO: Need a variation for rest parameters
  return typeof f === 'function' && f.length === l;
}

/**
 * Assertion version of {@link isFunctionOfLength}
 *
 * @param f Value to validate
 * @param l Number of parameters that `f` is expected to have
 * @param func_name Function within which the validation is occurring
 * @param type_name Optional alias for the function type
 * @param param_name Name of the parameter that's being validated
 */
export function assertFunctionOfLength<T extends (...args: any[]) => any>(
  f: (...args: any) => any,
  l: Parameters<T>['length'],
  func_name: string,
  type_name?: string,
  param_name?: string,
): asserts f is T;
export function assertFunctionOfLength<T extends number>(
  f: unknown,
  l: T,
  func_name: string,
  type_name?: string,
  param_name?: string,
): asserts f is (...args: TupleOfLength<T>) => unknown;
export function assertFunctionOfLength(
  f: unknown,
  l: number,
  func_name: string,
  type_name?: string,
  param_name?: string,
) {
  if (!isFunctionOfLength(f, l)) {
    throw new InvalidCallbackError(type_name ?? l, f, func_name, param_name);
  }
}

/**
 * Function for checking if the given `obj` is a tuple of the given length.
 */
export function isTupleOfLength<T extends number, U>(obj: U[], l: T): obj is TupleOfLength<T, U>;
export function isTupleOfLength<T extends number>(obj: unknown, l: T): obj is TupleOfLength<T>;
export function isTupleOfLength<T extends number>(obj: unknown, l: T): obj is TupleOfLength<T> {
  if (!Array.isArray(obj)) return false;
  return obj.length === l;
}

/**
 * Assertion version of {@link isTupleOfLength}
 */
export function assertTupleOfLength<T extends number, U>(obj: U[], l: T, func_name: string, param_name?: string): asserts obj is TupleOfLength<T, U>;
export function assertTupleOfLength<T extends number>(obj: unknown, l: T, func_name: string, param_name?: string): asserts obj is TupleOfLength<T>;
export function assertTupleOfLength<T extends number>(obj: unknown, l: T, func_name: string, param_name?: string): asserts obj is TupleOfLength<T> {
  if (!isTupleOfLength(obj, l)) {
    throw new InvalidParameterTypeError(`tuple of length ${length}`, obj, func_name, param_name);
  }
}

/**
 * Function for checking if a given value is a number and that it also potentially satisfies a bunch of other criteria:
 * - Within a given range of [min, max]
 * - Is an integer
 * - Is not NaN
 */
export function isNumberWithinRange(
  value: unknown,
  min?: number,
  max?: number,
  integer?: boolean,
): value is number;
export function isNumberWithinRange(
  value: unknown,
  options: InvalidNumberParameterErrorOptions,
): value is number;
export function isNumberWithinRange(
  value: unknown,
  arg0?: InvalidNumberParameterErrorOptions | number,
  max?: number,
  integer: boolean = true,
): value is number {
  let options: InvalidNumberParameterErrorOptions;

  if (typeof arg0 === 'number' || typeof arg0 === 'undefined') {
    options = {
      min: arg0,
      max,
      integer,
    };
  } else {
    options = arg0;
    options.integer = arg0.integer ?? true;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) return false;

  if (options.max !== undefined && value > options.max) return false;
  if (options.min !== undefined && value < options.min) return false;

  return !options.integer || Number.isInteger(value);
}

export interface AssertNumberWithinRangeOptions extends InvalidNumberParameterErrorOptions {
  func_name: string;
  param_name?: string;
}

/**
 * Assertion version of {@link isNumberWithinRange}
 */
export function assertNumberWithinRange(
  value: unknown,
  func_name: string,
  min?: number,
  max?: number,
  integer?: boolean,
  param_name?: string,
): asserts value is number;
export function assertNumberWithinRange(
  value: unknown,
  options: AssertNumberWithinRangeOptions,
): asserts value is number;
export function assertNumberWithinRange(
  value: unknown,
  arg0: AssertNumberWithinRangeOptions | string,
  min?: number,
  max?: number,
  integer?: boolean,
  param_name?: string,
): asserts value is number {
  let options: AssertNumberWithinRangeOptions;

  if (typeof arg0 === 'string') {
    options = {
      func_name: arg0,
      min,
      max,
      integer: integer ?? true,
      param_name,
    };
  } else {
    options = arg0;
  }

  if (!isNumberWithinRange(value, options)) {
    throw new InvalidNumberParameterError(value, options, options.func_name, options.param_name);
  }
}
