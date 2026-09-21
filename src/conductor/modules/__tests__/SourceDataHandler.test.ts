import { DataType, type ExternCallable, type TypedValue } from '@sourceacademy/conductor/types';
import { describe, expect, test } from 'vitest';

import {
  InvalidArityError,
  InvalidIdentifierError,
  InvalidIndexError,
  InvalidOpaqueUpdateError,
  InvalidTypeError,
} from '../errors';
import { asInterfacableEvaluator, SourceDataHandler } from '../SourceDataHandler';

const num = (n: number): TypedValue<DataType.NUMBER> => ({ type: DataType.NUMBER, value: n });
const str = (s: string): TypedValue<DataType.CONST_STRING> => ({
  type: DataType.CONST_STRING,
  value: s,
});
const NIL: TypedValue<DataType.EMPTY_LIST> = { type: DataType.EMPTY_LIST, value: null };

/** Drives an AsyncGenerator to its return value, as the module loader would. */
async function drive<T>(gen: AsyncGenerator<void, T, undefined>): Promise<T> {
  let next = await gen.next();
  while (!next.done) next = await gen.next();
  return next.value;
}

/**
 * An `ExternCallable` built from a plain synchronous function. `ExternCallable` is an
 * AsyncGenerator by contract even when the work behind it needs no suspension, which is exactly
 * the case these tests exercise — hence the disable rather than a pointless `await`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extern(f: (...args: any[]) => TypedValue<DataType>): ExternCallable<any, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/require-await
  return async function* (...args: any[]) {
    return f(...args);
  };
}

describe('pairs', () => {
  test('round-trips head and tail', async () => {
    const h = new SourceDataHandler();
    const p = await h.pair_make(num(1), num(2));
    expect(await h.pair_head(p)).toEqual(num(1));
    expect(await h.pair_tail(p)).toEqual(num(2));
  });

  test('sethead and settail are visible to a later read', async () => {
    const h = new SourceDataHandler();
    const p = await h.pair_make(num(1), num(2));
    await h.pair_sethead(p, str('x'));
    await h.pair_settail(p, NIL);
    expect(await h.pair_head(p)).toEqual(str('x'));
    expect(await h.pair_tail(p)).toEqual(NIL);
  });

  // The module bundles are shared with py-slang, whose interop encodes a pair as a 2-element
  // ARRAY. A bundle that calls pair_head on such a value must not break when called from Source.
  test('pair operations work on a two-element array', async () => {
    const h = new SourceDataHandler();
    const a = await h.array_make(DataType.NUMBER, 2, num(0));
    await h.array_set(a, 0, num(7));
    const asPair = a as unknown as TypedValue<DataType.PAIR>;
    expect(await h.pair_head(asPair)).toEqual(num(7));

    await h.pair_settail(asPair, num(9));
    expect(await h.array_get(a, 1)).toEqual(num(9));
  });

  test('a one-element array is not a pair', async () => {
    const h = new SourceDataHandler();
    const a = await h.array_make(DataType.NUMBER, 1, num(0));
    await expect(h.pair_head(a as unknown as TypedValue<DataType.PAIR>)).rejects.toBeInstanceOf(
      InvalidIdentifierError,
    );
  });

  test('a handle from another handler is rejected', async () => {
    const a = new SourceDataHandler();
    const b = new SourceDataHandler();
    const p = await a.pair_make(num(1), num(2));
    b.reset(); // ids restart at 0, so this is a *live-looking* but foreign handle
    await expect(b.pair_head(p)).rejects.toBeInstanceOf(InvalidIdentifierError);
  });

  test('pair_assert checks both components', async () => {
    const h = new SourceDataHandler();
    const p = await h.pair_make(num(1), str('a'));
    await expect(h.pair_assert(p, DataType.NUMBER, DataType.CONST_STRING)).resolves.toBeUndefined();
    await expect(h.pair_assert(p, DataType.CONST_STRING)).rejects.toBeInstanceOf(InvalidTypeError);
  });
});

describe('arrays', () => {
  test('array_make fills with the type default when no init is given', async () => {
    const h = new SourceDataHandler();
    const a = await h.array_make(DataType.NUMBER, 3);
    expect(await h.array_length(a)).toBe(3);
    expect(await h.array_get(a, 2)).toEqual(num(0));
    expect(await h.array_type(a)).toBe(DataType.NUMBER);
  });

  test('array_make refuses a type with no default and no init', async () => {
    const h = new SourceDataHandler();
    await expect(h.array_make(DataType.PAIR, 2)).rejects.toThrow(/without an initial value/);
  });

  test('out-of-bounds and non-integer indices are rejected on both get and set', async () => {
    const h = new SourceDataHandler();
    const a = await h.array_make(DataType.NUMBER, 2, num(0));
    await expect(h.array_get(a, 2)).rejects.toBeInstanceOf(InvalidIndexError);
    await expect(h.array_get(a, -1)).rejects.toBeInstanceOf(InvalidIndexError);
    await expect(h.array_get(a, 0.5)).rejects.toBeInstanceOf(InvalidIndexError);
    await expect(h.array_set(a, 2, num(1))).rejects.toBeInstanceOf(InvalidIndexError);
  });

  test('a typed array rejects an element of another type', async () => {
    const h = new SourceDataHandler();
    const a = await h.array_make(DataType.NUMBER, 1, num(0));
    await expect(h.array_set(a, 0, str('x'))).rejects.toBeInstanceOf(InvalidTypeError);
  });

  test('a VOID-typed array accepts anything', async () => {
    const h = new SourceDataHandler();
    const a = await h.array_make(DataType.VOID, 1);
    await expect(h.array_set(a, 0, str('x'))).resolves.toBeUndefined();
    expect(await h.array_get(a, 0)).toEqual(str('x'));
  });

  test('array_assert checks element type and length', async () => {
    const h = new SourceDataHandler();
    const a = await h.array_make(DataType.NUMBER, 2, num(0));
    await expect(h.array_assert(a, DataType.NUMBER, 2)).resolves.toBeUndefined();
    await expect(h.array_assert(a, DataType.CONST_STRING)).rejects.toBeInstanceOf(InvalidTypeError);
    await expect(h.array_assert(a, DataType.NUMBER, 3)).rejects.toBeInstanceOf(InvalidIndexError);
  });
});

describe('closures', () => {
  const addSig = { args: [DataType.NUMBER, DataType.NUMBER], returnType: DataType.NUMBER } as const;
  const add = extern((a: TypedValue<DataType.NUMBER>, b: TypedValue<DataType.NUMBER>) =>
    num(a.value + b.value),
  );

  test('calls through and checks the return type', async () => {
    const h = new SourceDataHandler();
    const c = await h.closure_make(addSig, add);
    expect(await drive(h.closure_call(c, [num(2), num(3)], DataType.NUMBER))).toEqual(num(5));
    expect(await h.closure_arity(c)).toBe(2);
    expect(await h.closure_is_vararg(c)).toBe(false);
  });

  test('arity is enforced, unless the closure is vararg', async () => {
    const h = new SourceDataHandler();
    const c = await h.closure_make(addSig, add);
    await expect(drive(h.closure_call(c, [num(2)], DataType.NUMBER))).rejects.toBeInstanceOf(
      InvalidArityError,
    );
    await expect(
      drive(h.closure_call(c, [num(2), num(3), num(4)], DataType.NUMBER)),
    ).rejects.toBeInstanceOf(InvalidArityError);

    const v = await h.closure_make(addSig, add, undefined, true);
    expect(await h.closure_is_vararg(v)).toBe(true);
    await expect(
      drive(h.closure_call(v, [num(2), num(3), num(4)], DataType.NUMBER)),
    ).resolves.toEqual(num(5));
  });

  test('argument types are checked', async () => {
    const h = new SourceDataHandler();
    const c = await h.closure_make(addSig, add);
    await expect(
      drive(h.closure_call(c, [num(2), str('x')], DataType.NUMBER)),
    ).rejects.toBeInstanceOf(InvalidTypeError);
  });

  // Same cross-language tolerance as the pair operations above: a declared PAIR is satisfied by an
  // ARRAY, because a pair *is* a two-element array.
  test('a declared pair accepts an array, and vice versa', async () => {
    const h = new SourceDataHandler();
    const sig = { args: [DataType.PAIR], returnType: DataType.NUMBER } as const;
    const c = await h.closure_make(
      sig,
      extern(() => num(1)),
    );
    const a = await h.array_make(DataType.NUMBER, 2, num(0));
    await expect(drive(h.closure_call(c, [a], DataType.NUMBER))).resolves.toEqual(num(1));
  });

  test('DataType.ANY accepts anything', async () => {
    const h = new SourceDataHandler();
    const sig = { args: [DataType.ANY], returnType: DataType.ANY } as const;
    const c = await h.closure_make(
      sig,
      extern(() => str('ok')),
    );
    await expect(drive(h.closure_call(c, [num(1)], DataType.ANY))).resolves.toEqual(str('ok'));
  });

  test('closure_call_unchecked skips both checks', async () => {
    const h = new SourceDataHandler();
    const c = await h.closure_make(
      addSig,
      extern(() => str('not a number')),
    );
    await expect(
      drive(h.closure_call(c, [num(1), num(2)], DataType.NUMBER)),
    ).rejects.toBeInstanceOf(InvalidTypeError);
    await expect(drive(h.closure_call_unchecked(c, [num(1)]))).resolves.toEqual(
      str('not a number'),
    );
  });

  test('closure_arity_assert', async () => {
    const h = new SourceDataHandler();
    const c = await h.closure_make(addSig, add);
    await expect(h.closure_arity_assert(c, 2)).resolves.toBeUndefined();
    await expect(h.closure_arity_assert(c, 3)).rejects.toBeInstanceOf(InvalidArityError);
  });

  // `sound` and `pix_n_flix` probe for this and fall back to closure_call_unchecked when it
  // returns undefined, so "no sync twin" must be distinguishable from "returned undefined".
  test('closure_call_sync forwards a sync twin, and reports its absence as undefined', async () => {
    const h = new SourceDataHandler();
    const plain = await h.closure_make(addSig, add);
    expect(h.closure_call_sync(plain, [num(1), num(2)])).toBeUndefined();

    const withTwin = Object.assign(
      extern(() => num(0)),
      {
        sync: (a: TypedValue<DataType.NUMBER>, b: TypedValue<DataType.NUMBER>) =>
          num(a.value * b.value),
      },
    );
    const fast = await h.closure_make(addSig, withTwin);
    expect(h.closure_call_sync(fast, [num(3), num(4)])).toEqual(num(12));
  });

  test('a dangling closure handle is rejected', async () => {
    const h = new SourceDataHandler();
    const c = await h.closure_make(addSig, add);
    h.reset();
    await expect(
      drive(h.closure_call(c, [num(1), num(2)], DataType.NUMBER)),
    ).rejects.toBeInstanceOf(InvalidIdentifierError);
  });
});

describe('opaques', () => {
  test('round-trips and updates', async () => {
    const h = new SourceDataHandler();
    const o = await h.opaque_make({ n: 1 });
    expect(await h.opaque_get(o)).toEqual({ n: 1 });
    await h.opaque_update(o, 'replaced');
    expect(await h.opaque_get(o)).toBe('replaced');
  });

  test('an immutable opaque refuses updates but still reads', async () => {
    const h = new SourceDataHandler();
    const o = await h.opaque_make('frozen', true);
    await expect(h.opaque_update(o, 'x')).rejects.toBeInstanceOf(InvalidOpaqueUpdateError);
    expect(await h.opaque_get(o)).toBe('frozen');
  });
});

describe('list utilities', () => {
  test('list builds a chain that list_to_vec and length read back', async () => {
    const h = new SourceDataHandler();
    const xs = await h.list(num(1), num(2), num(3));
    expect(await h.length(xs)).toBe(3);
    expect(await h.list_to_vec(xs)).toEqual([num(1), num(2), num(3)]);
    expect(await h.is_list(xs)).toBe(true);
  });

  test('the empty list is a list of length zero', async () => {
    const h = new SourceDataHandler();
    const xs = await h.list();
    expect(xs).toEqual(NIL);
    expect(await h.length(xs)).toBe(0);
    expect(await h.is_list(xs)).toBe(true);
  });

  test('an improper list is not a list', async () => {
    const h = new SourceDataHandler();
    const p = await h.pair_make(num(1), num(2));
    expect(await h.is_list(p as unknown as TypedValue<DataType.LIST>)).toBe(false);
  });

  test('the list helpers accept a flat array', async () => {
    const h = new SourceDataHandler();
    const a = await h.array_make(DataType.NUMBER, 2, num(5));
    const asList = a as unknown as TypedValue<DataType.LIST>;
    expect(await h.length(asList)).toBe(2);
    expect(await h.is_list(asList)).toBe(true);
    expect(await h.list_to_vec(asList)).toEqual([num(5), num(5)]);
  });

  // Conductor's own reference implementation (conductor/src/conductor/stdlib/list/accumulate.ts)
  // specifies right-to-left with the element first: `closure_call(op, [vec[i], result])`. A
  // non-commutative op is the only way to tell that apart from the left-to-right reading, and the
  // bundles are shared across languages, so getting it wrong silently changes module results.
  test('accumulate applies right-to-left, element first', async () => {
    const h = new SourceDataHandler();
    const sig = {
      args: [DataType.CONST_STRING, DataType.CONST_STRING],
      returnType: DataType.CONST_STRING,
    } as const;
    const concat = await h.closure_make(
      sig,
      extern((a: TypedValue<DataType.CONST_STRING>, b: TypedValue<DataType.CONST_STRING>) =>
        str(`(${a.value} ${b.value})`),
      ),
    );
    const xs = await h.list(str('1'), str('2'), str('3'));
    const result = await drive(h.accumulate(concat, str('nil'), xs, DataType.CONST_STRING));
    expect(result).toEqual(str('(1 (2 (3 nil)))'));
  });
});

describe('lifetimes', () => {
  // js-slang's tables hold strong references for the handler's lifetime, so a tie is already
  // guaranteed and an untie cannot be honoured. Both are no-ops rather than throws: py-slang throws
  // `Method not implemented`, which would abort a student's program over a call asking for
  // something we already provide.
  test('tie and untie are no-ops rather than throws', async () => {
    const h = new SourceDataHandler();
    const p = await h.pair_make(num(1), num(2));
    await expect(h.tie(p, null)).resolves.toBeUndefined();
    await expect(h.untie(p, null)).resolves.toBeUndefined();
    expect(await h.pair_head(p)).toEqual(num(1));
  });

  test('reset drops every table', async () => {
    const h = new SourceDataHandler();
    const p = await h.pair_make(num(1), num(2));
    const o = await h.opaque_make('x');
    h.reset();
    await expect(h.pair_head(p)).rejects.toBeInstanceOf(InvalidIdentifierError);
    await expect(h.opaque_get(o)).rejects.toBeInstanceOf(InvalidIdentifierError);
  });
});

describe('asInterfacableEvaluator', () => {
  test('exposes both halves on one object', () => {
    const h = new SourceDataHandler();
    const evaluator = { startEvaluator: () => Promise.resolve() };
    const combined = asInterfacableEvaluator(evaluator, h);

    expect(combined.hasDataInterface).toBe(true);
    expect(typeof (combined as unknown as { startEvaluator: unknown }).startEvaluator).toBe(
      'function',
    );
  });

  // A bare Reflect.get returns the method unbound, so calling it through the proxy would set
  // `this` to the proxy and write `uniqueId` onto the *evaluator* — issuing duplicate identifiers
  // that silently alias each other.
  test('handler methods stay bound to the handler', async () => {
    const h = new SourceDataHandler();
    const evaluator = {};
    const combined = asInterfacableEvaluator(evaluator as never, h);

    const p1 = await combined.pair_make(num(1), num(1));
    const p2 = await combined.pair_make(num(2), num(2));
    expect(p1.value).not.toBe(p2.value);

    // ...and the identifiers are the handler's own, readable straight off it.
    expect(await h.pair_head(p2)).toEqual(num(2));
    expect(evaluator).toEqual({});
  });
});
