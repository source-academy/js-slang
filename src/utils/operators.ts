import type { BinaryOperator, UnaryOperator } from 'estree';

import {
  CallingNonFunctionValueError,
  ExceptionError,
  GetInheritedPropertyError,
  TooFewArgumentsError,
  TooManyArgumentsError,
} from '../errors/errors';
import { RuntimeSourceError } from '../errors/base';
import {
  PotentialInfiniteLoopError,
  PotentialInfiniteRecursionError,
} from '../errors/timeoutErrors';
import type { Chapter } from '../langs';
import type { NativeStorage } from '../types';
import * as create from './ast/astCreator';
import { callExpression, locationDummyNode } from './ast/astCreator';
import * as rttc from './rttc';
import { HasCorrectParameters } from './typeUtils';

export function throwIfTimeout(
  nativeStorage: NativeStorage,
  start: number,
  current: number,
  line: number,
  column: number,
  source: string | null,
) {
  if (current - start > nativeStorage.maxExecTime) {
    throw new PotentialInfiniteLoopError(
      create.locationDummyNode(line, column, source),
      nativeStorage.maxExecTime,
    );
  }
}

export function boolOrErr(candidate: any, line: number, column: number, source: string | null) {
  rttc.checkIfStatement(create.locationDummyNode(line, column, source), candidate);
  return candidate;
}

export function unaryOp(
  operator: UnaryOperator,
  argument: any,
  line: number,
  column: number,
  source: string | null,
) {
  rttc.checkUnaryExpression(create.locationDummyNode(line, column, source), operator, argument);

  return evaluateUnaryExpression(operator, argument);
}

export function evaluateUnaryExpression(operator: UnaryOperator, value: any) {
  if (operator === '!') {
    return !value;
  } else if (operator === '-') {
    return -value;
  } else if (operator === 'typeof') {
    return typeof value;
  } else {
    return +value;
  }
}

export function binaryOp(
  operator: BinaryOperator,
  chapter: Chapter,
  left: any,
  right: any,
  line: number,
  column: number,
  source: string | null,
) {
  rttc.checkBinaryExpression(create.locationDummyNode(line, column, source), operator, chapter, [
    left,
    right,
  ]);

  return evaluateBinaryExpression(operator, left, right);
}

export function evaluateBinaryExpression(operator: BinaryOperator, left: any, right: any) {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
    case '%':
      return left % right;
    case '===':
      return left === right;
    case '!==':
      return left !== right;
    case '<=':
      return left <= right;
    case '<':
      return left < right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    default:
      return undefined;
  }
}

interface FunctionDetails {
  /**
   * Name of the file/module that the function
   * was originally defined in
   */
  source: string | null;
  maxArgsAllowed: number | true;
}

const funcDetSymbol = Symbol();

function getFunctionDetails(f: Function): FunctionDetails {
  if (funcDetSymbol in f) {
    return f[funcDetSymbol] as FunctionDetails;
  }

  return {
    maxArgsAllowed: f.length, // no way to check if the function hasVarArgs
    source: null,
  };
}

/**
 * Calls the provided value as if it were a function being called from the `line` and `column`
 * within the provided `source` file, checking for argument count.
 *
 * - If `nativeStorage` is provided, then infinite recursion protection is also added.
 */
export function callIfFuncAndRightArgs(
  f: unknown,
  line: number,
  column: number,
  source: string | null,
  nativeStorage: NativeStorage | undefined,
  ...args: any[]
) {
  const startTime = Date.now();
  const pastCalls: [string, any[]][] = [];
  let isPrelude = source === 'prelude';

  while (true) {
    const dummy = locationDummyNode(line, column, source);
    if (typeof f !== 'function') {
      throw new CallingNonFunctionValueError(
        f,
        callExpression(dummy, args, {
          start: { line, column },
          end: { line, column },
          source,
        }),
      );
    }

    const receivedLength = args.length;
    const { maxArgsAllowed, source: funcSource } = getFunctionDetails(f);
    // console.log(f.name, f.length, maxArgsAllowed, receivedLength);

    if (funcSource === 'prelude') {
      // Once we call into a prelude function, everything that follows
      // is in prelude code
      isPrelude = true;
    }

    const hasVarArgs = maxArgsAllowed === true || maxArgsAllowed !== f.length;

    if (receivedLength < f.length) {
      throw new TooFewArgumentsError(
        callExpression(dummy, args, {
          start: { line, column },
          end: { line, column },
          source,
        }),
        receivedLength,
        f.length,
        hasVarArgs,
        f.name,
      );
    }

    if (typeof maxArgsAllowed === 'number' && receivedLength > maxArgsAllowed) {
      throw new TooManyArgumentsError(
        callExpression(dummy, args, {
          start: { line, column },
          end: { line, column },
          source,
        }),
        receivedLength,
        maxArgsAllowed,
        hasVarArgs,
        f.name,
      );
    }

    let res;
    try {
      res = f(...args);

      if (nativeStorage && Date.now() - startTime > nativeStorage.maxExecTime) {
        throw new PotentialInfiniteRecursionError(dummy, pastCalls, nativeStorage.maxExecTime);
      }
    } catch (error) {
      // if we already handled the error, simply pass it on
      if (error instanceof ExceptionError) throw error;

      if (error instanceof RuntimeSourceError) {
        if (!error.node) {
          error.node = locationDummyNode(line, column, isPrelude ? 'prelude' : funcSource);
        } else if (funcSource) {
          if (!error.node.loc) {
            error.node.loc = {
              start: { line, column },
              end: { line, column },
              source: isPrelude ? 'prelude' : funcSource,
            };
          } else {
            error.node.loc.source = isPrelude ? 'prelude' : funcSource;
          }
        }
        throw error;
      }

      throw new ExceptionError(error);
    }

    // Limitations for current properTailCalls implementation:
    // Obviously, if objects ({}) are reintroduced,
    // we have to change this for a more stringent check,
    // as isTail and transformedFunctions are properties
    // and may be added by Source code.
    if (res === null || res === undefined) {
      return res;
    } else if (res.isTail === true) {
      f = res.function;
      args = res.arguments;
      source = res.source;
      line = res.line;
      column = res.column;
      pastCalls.push([res.functionName, args]);
      // Then go back to the top of the while loop
    } else if (res.isTail === false) {
      return res.value;
    } else {
      return res;
    }
  }
}

/**
 * Convenience wrapper for {@link callIfFuncAndRightArgs} that doesn't require any
 * extra metadata to be passed into the function.
 */
export function callWithoutMetadata<T extends (...args: any[]) => any>(
  f: T,
  ...args: Parameters<T>
): ReturnType<T> {
  return callIfFuncAndRightArgs(f, -1, -1, null, undefined, ...args);
}

/**
 * Augment the given function with the necessary information for it to be called
 * properly by {@link callIfFuncAndRightArgs}. It won't redefine any existing details
 * that the function has already been wrapped with.
 *
 * - `hasVarArgs`
 *   - If `hasVarArgs` is `false` or `undefined`, then `f` is assumed not to have variadic args.
 *   - If `hasVarArgs` is `true`, `minArgsNeeded` is inferred from `f.length`.
 *   - If `hasVarArgs` is a number, it is used for `minArgsNeeded`.
 *
 * - If `stringified` is `undefined`, the function won't try to define `toReplString`.
 * - `funcName`
 *   - If `funcName` is `undefined`, the function won't try to define the `name` property.
 *   - If `funcName` is provided, the `name` property will get overriden.
 */
export function wrap<
  T extends (...args: any[]) => any,
  OptArgs extends number
>(
  f: HasCorrectParameters<T, number, OptArgs>,
  funcName: string,
  optArgCount: OptArgs,
  stringified?: string,
  source?: string | null,
): T;
export function wrap<T extends (...args: any[]) => any>(
  f: HasCorrectParameters<T, number, true>,
  funcName: string,
  optArgCount: true,
  stringified?: string,
  source?: string | null,
): T;
export function wrap<T extends (...args: any[]) => any>(
  f: (...args: any[]) => any,
  funcName: string,
  optArgCount?: undefined,
  stringified?: string,
  source?: string | null,
): T;
// export function wrap(
//   f: unknown,
//   funcName?: string,
//   optArgCount?: number | true,
//   stringified?: string,
//   source?: string | null,
// ): (...args: any[]) => any 
export function wrap(
  f: (...args: any[]) => any,
  funcName?: string,
  optArgCount?: number | true,
  stringified?: string,
  source: string | null = null,
) {
  if (funcName !== undefined) {
    Object.defineProperty(f, 'name', { value: funcName });
  }

  const maxArgsAllowed = optArgCount === true
    ? true
    : optArgCount === undefined
      ? f.length
      : f.length + optArgCount

  if (!(funcDetSymbol in f)) {
    const details: FunctionDetails = {
      maxArgsAllowed,
      source,
    };

    (f as any)[funcDetSymbol] = details;
  } else {
    const funcDets = getFunctionDetails(f);

    if (typeof funcDets.maxArgsAllowed !== 'number' && funcDets.maxArgsAllowed !== true) {
      funcDets.maxArgsAllowed = maxArgsAllowed;
    }

    if (typeof funcDets.source !== 'string') {
      funcDets.source = source;
    }
  }

  if (stringified !== undefined && !('toReplString' in f)) {
    // Don't override toReplString if it was already defined
    // @ts-expect-error toReplString is not a known property of functions
    f.toReplString = () => stringified;
  }
  return f;
}

export function setProp(
  obj: any,
  prop: any,
  value: any,
  line: number,
  column: number,
  source: string | null,
) {
  const dummy = locationDummyNode(line, column, source);
  rttc.checkMemberAccess(dummy, [obj, prop]);
  return (obj[prop] = value);
}

export function getProp(obj: any, prop: any, line: number, column: number, source: string | null) {
  const dummy = locationDummyNode(line, column, source);
  rttc.checkMemberAccess(dummy, [obj, prop]);

  if (obj[prop] !== undefined && !obj.hasOwnProperty(prop)) {
    throw new GetInheritedPropertyError(dummy, obj, prop);
  } else {
    return obj[prop];
  }
}
