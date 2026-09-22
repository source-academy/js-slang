import { describe, expect, test } from 'vitest';

import { CallingNonFunctionValueError, ExceptionError } from '../../errors/errors';
import { PotentialInfiniteRecursionError } from '../../errors/timeoutErrors';
import type { NativeStorage } from '../../types';
import {
  callIfFuncAndRightArgsAsync,
  callWithoutMetadataAsync,
  markExternModuleCall,
  wrap,
} from '../operators';

/** A minimal `NativeStorage` slice — `maxExecTime` for the timeout budget, `asyncCallDepth` for
 * the call-depth guard, both real fields `callIfFuncAndRightArgsAsync` reads and writes. */
function nativeStorage(maxExecTime: number): NativeStorage {
  return { maxExecTime, asyncCallDepth: 0 } as NativeStorage;
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
    await expect(callWithoutMetadataAsync(42 as never)).rejects.toBeInstanceOf(
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
      1,
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
      1,
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
    const ns = nativeStorage(10_000); // generous; the DEPTH guard should fire long before this
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
    const ns = { maxExecTime: 10_000 } as NativeStorage; // asyncCallDepth deliberately omitted
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

  // Confirms the exclusion is actually conditional, not "await everything and let the near-zero
  // cost of awaiting a plain value wash out" — a tight, purely-synchronous trampoline loop (never
  // once returning a thenable) must trip the budget at roughly the configured time, not run
  // substantially longer because each iteration's await-of-a-plain-value tick quietly padded the
  // clock. The cap is set far above what a correct implementation could reach in 15ms, so hitting
  // it is itself the failure signal.
  test('a purely synchronous trampoline loop is not given extra budget by the exclusion', async () => {
    let n = 0;
    const countUp = wrap(
      (): any => {
        n++;
        if (n > 5_000_000) return { isTail: false, value: 'never' };
        return {
          isTail: true,
          function: countUp,
          functionName: 'countUp',
          arguments: [],
          line: 1,
          column: 1,
          source: null,
        };
      },
      0,
      'countUp',
    );

    await expect(
      callIfFuncAndRightArgsAsync(countUp, -1, -1, null, nativeStorage(15)),
    ).rejects.toBeInstanceOf(PotentialInfiniteRecursionError);
    // If the exclusion fired unconditionally, this would have run to completion (n > 5_000_000)
    // instead of timing out partway through.
    expect(n).toBeLessThan(5_000_000);
  });

  // The exclusion is specifically for a call that ACTUALLY suspends (returns a thenable) — a
  // synchronous busy-loop hidden inside a wrapped function must still count fully.
  test('a synchronous call that merely takes a long time is not excluded from the budget', async () => {
    const busy = wrap(
      (): any => {
        const until = Date.now() + 30;
        while (Date.now() < until) {
          /* burn wall-clock time, synchronously */
        }
        return { isTail: false, value: 'done' };
      },
      0,
      'busy',
    );

    await expect(
      callIfFuncAndRightArgsAsync(busy, -1, -1, null, nativeStorage(10)),
    ).rejects.toBeInstanceOf(PotentialInfiniteRecursionError);
  });

  // The actual point of the exclusion: a call chain that spends real wall-clock time suspended on
  // a genuine host round-trip (what a module call looks like) must not trip the same budget a
  // synchronous busy-loop would, even though more real time elapses. `markExternModuleCall` is
  // exactly the tag `moduleInterop.ts` applies to a module's own closure wrapper — without it, this
  // call is indistinguishable from any other Promise-returning Source function.
  test('time spent awaiting a thenable is excluded from the recursion budget, for a genuine module call', async () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const slowButFinite = markExternModuleCall(
      wrap(
        async (): Promise<any> => {
          await delay(30); // longer than the 10ms budget below, on purpose
          return { isTail: false, value: 'done' };
        },
        0,
        'slowButFinite',
      ),
    );

    await expect(
      callIfFuncAndRightArgsAsync(slowButFinite, -1, -1, null, nativeStorage(10)),
    ).resolves.toBe('done');
  });

  // Every Source function is Promise-returning in dual/async mode, not just a genuine module call
  // (see `markArrowFunctionsAsync` in transpiler.ts) — so an ordinary, untagged async function must
  // NOT get the exclusion above, or a same-thread Source-to-Source tail recursion would forgive its
  // own elapsed time every iteration and never trip this budget (js-slang#2083, Codex finding).
  test('time spent awaiting a thenable is NOT excluded for a call not tagged as a module call', async () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const slowUntaggedCall = wrap(
      async (): Promise<any> => {
        await delay(30); // longer than the 10ms budget below
        return { isTail: false, value: 'done' };
      },
      0,
      'slowUntaggedCall',
    );

    await expect(
      callIfFuncAndRightArgsAsync(slowUntaggedCall, -1, -1, null, nativeStorage(10)),
    ).rejects.toBeInstanceOf(PotentialInfiniteRecursionError);
  });
});
