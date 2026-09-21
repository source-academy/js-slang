import type { BinaryOperator, CallExpression, UnaryOperator } from 'estree';

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
import assert from './assert';

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
 * Check that the number of arguments provided falls within the range specified.
 *
 * You can call it with just a {@link CallExpression}, in which case its `callee` should be either a
 * {@link FunctionExpression} or {@link ArrowFunctionExpression}.
 *
 * Otherwise, the node is just used for location information and you have to manually specify
 * everything else.
 *
 * - If `maxArgs` is true, then there is no maximum number of arguments. Useful for functions
 * with a rest parameter.
 * - If `maxArgs` is a number, then that value is the maximum number of arguments.
 * - If `maxArgs` is `undefined` or not provided, then the maximum number of arguments is assumed
 * to be `minArgs`.
 */
export function validateFunctionArgCount(exp: CallExpression): void;
export function validateFunctionArgCount(
  exp: CallExpression,
  received: number,
  minArgs: number,
  maxArgs?: number | true,
  funcName?: string,
): void;
export function validateFunctionArgCount(
  exp: CallExpression,
  received?: number,
  rawMinArgs?: number,
  rawMaxArgs?: number | true,
  funcName?: string,
) {
  let minArgs: number;
  let maxArgs: number | true;

  if (received === undefined) {
    assert(
      exp.callee.type === 'ArrowFunctionExpression' || exp.callee.type === 'FunctionExpression',
      `${validateFunctionArgCount.name}: When called with CallExpression only, callee must be a function node`,
    );

    const func = exp.callee;
    received = exp.arguments.length;
    minArgs = func.params.filter(
      x => x.type !== 'AssignmentPattern' && x.type !== 'RestElement',
    ).length;
    maxArgs =
      (func.params.length > 0 && func.params[func.params.length - 1].type === 'RestElement') ||
      func.params.length;
  } else {
    minArgs = rawMinArgs!;
    maxArgs = rawMaxArgs ?? rawMinArgs!;
  }

  assert(
    typeof maxArgs !== 'number' || maxArgs >= minArgs,
    `MaxArgs was a number (${maxArgs}) but less than MinArgs = ${minArgs}`,
  );

  if (received < minArgs) {
    throw new TooFewArgumentsError(
      exp,
      received,
      minArgs,
      maxArgs === true || maxArgs !== minArgs,
      funcName,
    );
  }

  if (maxArgs !== true && received > maxArgs) {
    throw new TooManyArgumentsError(exp, received, maxArgs, maxArgs !== minArgs, funcName);
  }
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

    if (funcSource === 'prelude') {
      // Once we call into a prelude function, everything that follows
      // is in prelude code
      isPrelude = true;
    }

    validateFunctionArgCount(
      callExpression(dummy, args, {
        start: { line, column },
        end: { line, column },
        source,
      }),
      receivedLength,
      f.length,
      maxArgsAllowed,
      f.name,
    );

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
 * The async twin of {@link callIfFuncAndRightArgs}, used only in a program that imports a module
 * (see `transpiler.ts`'s dual-mode compilation, gated by `hasImports`). A module function crosses
 * the Conductor boundary as an `ExternCallable` — by protocol, always a Promise-returning call,
 * whether or not that particular invocation actually needs to suspend — so once a program can reach
 * one, every call in it must be prepared to await, including the proper-tail-call trampoline itself.
 *
 * Everything here mirrors {@link callIfFuncAndRightArgs} line for line — argument validation, the
 * trampoline, the same error-wrapping — with exactly one addition: a call whose result is *actually*
 * a thenable is awaited, and the wall-clock time spent suspended is excluded from the infinite-
 * recursion budget below.
 *
 * That exclusion is deliberately narrow. It only ever fires when `f(...args)` itself returned a
 * thenable — a genuine host round-trip — never for an ordinary synchronous Source call, which
 * matches the pre-existing budget exactly (no `await`, no extra tick, nothing excluded). A call
 * that busy-loops synchronously inside `f` still counts fully against the budget; only real
 * suspension time, which the student's code did not spend "recursing", is forgiven. The *iteration*
 * budget a `for`/`while` loop carries (`throwIfTimeout`, inserted by `addInfiniteLoopProtection`) is
 * untouched by this — a loop that keeps making module calls forever should still time out, and
 * unlike this function's own per-call-chain budget, that one is meant to bound wall-clock time
 * regardless of what the loop body did with it.
 */
/**
 * A stand-in for the native call-stack limit a synchronous non-tail recursion is bounded by for
 * free (V8 throws a clean, catchable `RangeError` well before anything worse happens). An async
 * non-tail recursion has no such limit — nothing here grows a stack frame, it grows a chain of
 * heap-allocated promise reaction records, and letting that run unbounded does not fail cleanly;
 * it can take the whole worker down. This threshold is deliberately conservative rather than tuned
 * to match V8's own (variable, frame-size-dependent) stack depth exactly: it exists to guarantee a
 * catchable `PotentialInfiniteRecursionError` fires before that happens, not to permit the same
 * depth a sync program could reach.
 */
const MAX_ASYNC_CALL_DEPTH = 2000;

export async function callIfFuncAndRightArgsAsync(
  f: unknown,
  line: number,
  column: number,
  source: string | null,
  nativeStorage: NativeStorage | undefined,
  ...args: any[]
) {
  let startTime = Date.now();
  const pastCalls: [string, any[]][] = [];
  let isPrelude = source === 'prelude';

  // Tracks *nested* invocations only — the trampoline loop below reuses this same call for a tail
  // call, so it never re-enters this function and never re-increments. A non-tail call, by
  // contrast, is a fresh, nested invocation made from inside `f`'s own body while this one is still
  // suspended at `await rawResult` below, exactly the shape that needs bounding (see
  // MAX_ASYNC_CALL_DEPTH's doc comment).
  //
  // `?? 0` matters, not just style: `NativeStorage.asyncCallDepth` is a real, always-initialized
  // field on every context `createNativeStorage()` builds, but this function only requires
  // `NativeStorage | undefined` and a caller — a test mock, or any future one — can construct an
  // object missing the field. `undefined++` is `NaN`, and every comparison against `NaN` is
  // `false`, so an uninitialized counter would silently defeat this guard forever rather than
  // fail loudly. This is not hypothetical: an earlier version of this function's own test suite
  // did exactly that, and the resulting unbounded recursion crashed the test worker outright.
  if (nativeStorage) {
    nativeStorage.asyncCallDepth = (nativeStorage.asyncCallDepth ?? 0) + 1;
    if (nativeStorage.asyncCallDepth > MAX_ASYNC_CALL_DEPTH) {
      nativeStorage.asyncCallDepth--;
      throw new PotentialInfiniteRecursionError(
        locationDummyNode(line, column, source),
        pastCalls,
        nativeStorage.maxExecTime,
      );
    }
  }

  try {
    return await runTrampoline();
  } finally {
    if (nativeStorage) {
      nativeStorage.asyncCallDepth--;
    }
  }

  async function runTrampoline(): Promise<any> {
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

      if (funcSource === 'prelude') {
        isPrelude = true;
      }

      validateFunctionArgCount(
        callExpression(dummy, args, {
          start: { line, column },
          end: { line, column },
          source,
        }),
        receivedLength,
        f.length,
        maxArgsAllowed,
        f.name,
      );

      let res;
      try {
        const rawResult = f(...args);

        if (
          rawResult !== null &&
          typeof rawResult === 'object' &&
          typeof rawResult.then === 'function'
        ) {
          // A genuine asynchronous call: exclude however long it actually took to suspend from the
          // budget below, by shifting the clock forward by exactly that duration.
          const beforeAwait = Date.now();
          res = await rawResult;
          startTime += Date.now() - beforeAwait;
        } else {
          res = rawResult;
        }

        if (nativeStorage && Date.now() - startTime > nativeStorage.maxExecTime) {
          throw new PotentialInfiniteRecursionError(dummy, pastCalls, nativeStorage.maxExecTime);
        }
      } catch (error) {
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

      if (res === null || res === undefined) {
        return res;
      } else if (res.isTail === true) {
        f = res.function;
        args = res.arguments;
        source = res.source;
        line = res.line;
        column = res.column;
        pastCalls.push([res.functionName, args]);
      } else if (res.isTail === false) {
        return res.value;
      } else {
        return res;
      }
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
 * Async twin of {@link callWithoutMetadata}, for calling a Source closure from module interop code
 * (`src/conductor/modules/moduleInterop.ts`) — a module calling back into a student's function must
 * go through the trampoline like any other Source call, but from TypeScript, not transpiled code.
 */
export function callWithoutMetadataAsync<T extends (...args: any[]) => any>(
  f: T,
  ...args: Parameters<T>
): Promise<Awaited<ReturnType<T>>> {
  return callIfFuncAndRightArgsAsync(f, -1, -1, null, undefined, ...args);
}

/**
 * Augment the given function with the necessary information for it to be called
 * properly by {@link callIfFuncAndRightArgs}. It won't redefine any existing details
 * that the function has already been wrapped with.
 *
 * @example
 * ```ts
 * export const wrapped = wrap((...args: any[]) => args.length, true, 'wrapped');
 * ```
 *
 * - `optArgCount`: Represents the number of optional arguments the function has
 *   - If set to `undefined`, it will be assumed to be 0
 *   - If set to a number, that will be taken to be the number of optional arguments
 *   - If set to `true`, the function is assumed to have a rest argument
 *
 * - If `stringified` is `undefined`, the function won't try to define `toReplString`.
 * - `funcName`
 *   - If `funcName` is `undefined`, the function won't try to define the `name` property.
 *   - If `funcName` is provided, the `name` property will get overriden.
 */
export function wrap<T extends (...args: any[]) => any, OptArgs extends number>(
  f: HasCorrectParameters<T, OptArgs>,
  optArgCount: OptArgs,
  funcName?: string,
  stringified?: string,
  source?: string | null,
): T;
export function wrap<T extends (...args: any[]) => any>(
  f: HasCorrectParameters<T, true>,
  optArgCount: true,
  funcName?: string,
  stringified?: string,
  source?: string | null,
): T;
export function wrap<T extends (...args: any[]) => any>(
  f: HasCorrectParameters<T, 0>,
  optArgCount?: undefined,
  funcName?: string,
  stringified?: string,
  source?: string | null,
): T;
export function wrap(
  f: (...args: any[]) => any,
  optArgCount?: number | true,
  funcName?: string,
  stringified?: string,
  source: string | null = null,
) {
  if (funcName !== undefined) {
    Object.defineProperty(f, 'name', { value: funcName });
  }

  const maxArgsAllowed =
    optArgCount === true ? true : optArgCount === undefined ? f.length : f.length + optArgCount;

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

/**
 * A type-agnostic version of {@link wrap} to make it easier
 * when the function type is not known.
 */
export function wrapUnsafe<T extends (...args: any[]) => any>(
  f: T,
  optArgCount?: number | true,
  funcName?: string,
  stringified?: string,
  source?: string | null,
) {
  // @ts-expect-error Ignore type safety
  return wrap(f, optArgCount, funcName, stringified, source);
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
