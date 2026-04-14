import type { BinaryOperator, UnaryOperator } from 'estree';

import {
  CallingNonFunctionValueError,
  ExceptionError,
  GetInheritedPropertyError,
  InvalidNumberOfArgumentsError,
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
  isPrelude: boolean;
  minArgsNeeded?: number;
}

const funcDetSymbol = Symbol();

function getFunctionDetails(f: Function): FunctionDetails {
  if (funcDetSymbol in f) {
    return f[funcDetSymbol] as FunctionDetails;
  }

  return {
    minArgsNeeded: f.length, // no way to check if the function hasVarArgs
    isPrelude: false,
  };
}

/**
 * Limitations for current properTailCalls implementation:
 * Obviously, if objects ({}) are reintroduced,
 * we have to change this for a more stringent check,
 * as isTail and transformedFunctions are properties
 * and may be added by Source code.
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
  let isPrelude = false;

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

    const expectedLength = f.length;
    const receivedLength = args.length;
    const { minArgsNeeded, isPrelude: isPreludeFunc } = getFunctionDetails(f);

    if (isPreludeFunc) {
      // Once we call into a prelude function, everything that follows
      // is in prelude code
      isPrelude = true;
    }

    const hasVarArgs = minArgsNeeded !== undefined;
    if (hasVarArgs ? minArgsNeeded > receivedLength : expectedLength !== receivedLength) {
      throw new InvalidNumberOfArgumentsError(
        callExpression(dummy, args, {
          start: { line, column },
          end: { line, column },
          source,
        }),
        hasVarArgs ? minArgsNeeded : expectedLength,
        receivedLength,
        hasVarArgs,
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
          error.node = locationDummyNode(line, column, isPrelude ? 'prelude' : source);
        } else if (isPrelude) {
          if (!error.node.loc) {
            error.node.loc = {
              start: { line, column },
              end: { line, column },
              source: 'prelude',
            };
          } else {
            error.node.loc.source = 'prelude';
          }
        }
        throw error;
      }

      throw new ExceptionError(error);
    }

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
 * Augment the given function with the necessary information for it to be called
 * properly by {@link callIfFuncAndRightArgs}.
 *
 * If `hasVarArgs` is `false` or `undefined`, then `f` is assumed not to have variadic args.
 * If `hasVarArgs` is `true`, `minArgsNeeded` is inferred from `f.length`.
 * If `hasVarArgs` is a number, it is used for `minArgsNeeded`.
 */
export function wrap<T extends (...args: any[]) => any>(
  f: T,
  stringified: string,
  hasVarArgs: boolean | undefined | number,
  isPrelude: boolean,
): T {
  let minArgsNeeded: number | undefined;
  if (hasVarArgs === true) {
    minArgsNeeded = f.length;
  } else if (typeof hasVarArgs === 'number') {
    minArgsNeeded = hasVarArgs;
  }

  (f as any)[funcDetSymbol] = {
    minArgsNeeded,
    isPrelude,
  };

  // @ts-expect-error toReplString is not a known property of functions
  f.toReplString = () => stringified;
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
