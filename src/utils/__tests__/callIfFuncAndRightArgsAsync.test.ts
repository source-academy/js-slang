import { describe, expect, test } from 'vitest';

import { CallingNonFunctionValueError, ExceptionError } from '../../errors/errors';
import { PotentialInfiniteRecursionError } from '../../errors/timeoutErrors';
import type { NativeStorage } from '../../types';
import { callIfFuncAndRightArgsAsync, callWithoutMetadataAsync, wrap } from '../operators';

/** A minimal `NativeStorage` slice — `asyncCallDepth` for the call-depth guard, the one real field
 * `callIfFuncAndRightArgsAsync` reads and writes. */
function nativeStorage(): NativeStorage {
  return { asyncCallDepth: 0 } as NativeStorage;
}

describe('callIfFuncAndRightArgsAsync', () => {
  test('calls a plain synchronous function and returns its value', async () => {
    const add = wrap((a: number, b: number) => a + b, 0, 'add');
    await expect(callWithoutMetadataAsync(add, 2, 3)).resolves.toBe(5);
  });

  test('awaits a function that returns a thenable', async () => {
    // Deliberately async with no await inside — the whole point is a Promise-returning callable
    // that never itself needs to suspend, exercising the "was this call actually asynchronous"
    // detection rather than genuine host latency.
    // eslint-disable-next-line @typescript-eslint/require-await
    const f = wrap(async (x: number) => x * 2, 0, 'f');
    await expect(callWithoutMetadataAsync(f, 21)).resolves.toBe(42);
  });

  test('rejects the same way a sync call throws for a non-function value', async () => {
    // `as any`, not `as never`: with a `never`-typed argument, `T`'s inferred `Parameters<T>` also
    // collapses to `never`, and TS then rejects the call's own (empty) argument list against that
    // — a generic-inference artifact of testing a value that's deliberately not a function, not
    // something to work around by weakening `callWithoutMetadataAsync`'s real signature.
    await expect(callWithoutMetadataAsync(42 as any)).rejects.toBeInstanceOf(
      CallingNonFunctionValueError,
    );
  });

  test('wraps a rejection the same way a sync throw is wrapped', async () => {
    const f = wrap(
      // eslint-disable-next-line @typescript-eslint/require-await
      async () => {
        throw new Error('boom');
      },
      0,
      'f',
    );
    await expect(callWithoutMetadataAsync(f)).rejects.toBeInstanceOf(ExceptionError);
  });

  // The trampoline's whole reason to exist: a tail call must not grow the JS call stack, whether
  // or not it crosses an await. Every tail call here returns the `{isTail, function, arguments}`
  // marker the transpiler's return-statement transform produces, exactly as a real transpiled
  // Source program would.
  test('preserves proper tail calls across an awaited call, without growing the stack', async () => {
    const countDown = wrap(
      (n: number): any => {
        if (n === 0) return { isTail: false, value: 'done' };
        return {
          isTail: true,
          function: countDownAsync,
          functionName: 'countDown',
          arguments: [n - 1],
          line: 1,
          column: 1,
          source: null,
        };
      },
      // 0, not 1: `n` is a single required parameter, no optional ones — `optArgCount` counts
      // optional arguments, not the total parameter count (see `wrap`'s own doc comment).
      0,
      'countDown',
    );
    // Every OTHER call suspends on a real await, so the trampoline is forced through both the
    // sync and the async branch repeatedly across one call chain, not just once.
    const countDownAsync = wrap(
      async (n: number): Promise<any> => {
        await Promise.resolve();
        if (n === 0) return { isTail: false, value: 'done' };
        return {
          isTail: true,
          function: countDown,
          functionName: 'countDownAsync',
          arguments: [n - 1],
          line: 1,
          column: 1,
          source: null,
        };
      },
      0,
      'countDownAsync',
    );

    // Deep enough that a real (non-trampolined) recursion of this depth would blow the stack.
    await expect(callWithoutMetadataAsync(countDown, 50_000)).resolves.toBe('done');
  });

  test('a genuinely runaway (non-tail) async recursion trips the call-depth guard', async () => {
    // What the transpiler actually emits for a non-tail call is
    // `await callIfFuncAndRightArgsAsync(f, line, col, source, native, ...args)` — `native` (this
    // test's `ns`) threaded through on every call, nested ones included, not just the outermost.
    // callWithoutMetadataAsync (no nativeStorage) would defeat both budgets below silently.
    const ns = nativeStorage();
    let calls = 0;
    const f = wrap(
      async (): Promise<any> => {
        calls++;
        await Promise.resolve();
        // Not a tail position: a real nested call, made from inside f's own body while the calling
        // invocation is still suspended — exactly the shape MAX_ASYNC_CALL_DEPTH exists to bound.
        return callIfFuncAndRightArgsAsync(f, -1, -1, null, ns);
      },
      0,
      'f',
    );

    await expect(callIfFuncAndRightArgsAsync(f, -1, -1, null, ns)).rejects.toBeInstanceOf(
      PotentialInfiniteRecursionError,
    );
    // Bounded: the depth guard must actually have fired well short of unbounded growth.
    expect(calls).toBeGreaterThan(1);
    expect(calls).toBeLessThan(10_000);
  });

  // `NativeStorage.asyncCallDepth` is a real, always-present field on every context
  // `createNativeStorage()` builds — but this function only requires `NativeStorage | undefined`,
  // so nothing stops a caller from constructing an object that omits it (as this suite's own
  // `nativeStorage()` helper originally did, by accident). `undefined + 1` is `NaN`, and every
  // comparison against `NaN` is false, so an unguarded increment would silently defeat the depth
  // guard forever rather than fail loudly — which is exactly what happened here once, and crashed
  // the whole test worker outright rather than raising a catchable error.
  test('the call-depth guard still works when asyncCallDepth starts uninitialized', async () => {
    const ns = {} as NativeStorage; // asyncCallDepth deliberately omitted
    const f = wrap(
      async (): Promise<any> => {
        await Promise.resolve();
        return callIfFuncAndRightArgsAsync(f, -1, -1, null, ns);
      },
      0,
      'f',
    );

    await expect(callIfFuncAndRightArgsAsync(f, -1, -1, null, ns)).rejects.toBeInstanceOf(
      PotentialInfiniteRecursionError,
    );
  });
});
