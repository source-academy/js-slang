import { DataType, type TypedValue } from '@sourceacademy/conductor/types';
import { describe, expect, test } from 'vitest';

import { moduleToSource, sourceToModule, SourceOpaque } from '../moduleInterop';
import { SourceDataHandler } from '../SourceDataHandler';

describe('sourceToModule', () => {
  test('primitives', async () => {
    expect(await sourceToModule(new SourceDataHandler(), null)).toEqual({
      type: DataType.EMPTY_LIST,
      value: null,
    });
    expect(await sourceToModule(new SourceDataHandler(), undefined)).toEqual({
      type: DataType.VOID,
      value: undefined,
    });
    expect(await sourceToModule(new SourceDataHandler(), 42)).toEqual({
      type: DataType.NUMBER,
      value: 42,
    });
    expect(await sourceToModule(new SourceDataHandler(), true)).toEqual({
      type: DataType.BOOLEAN,
      value: true,
    });
    expect(await sourceToModule(new SourceDataHandler(), 'hi')).toEqual({
      type: DataType.CONST_STRING,
      value: 'hi',
    });
  });

  // A Source pair and a §3 array are the *same* JS array — `pair(1, 2)` and `[1, 2]` are
  // indistinguishable at the value level — so there is nothing to special-case here; every array
  // converts as a flat ARRAY. `list(1, 2, 3)` is nested cons cells, `[1, [2, [3, null]]]` — a
  // module's `list_to_vec` reads a DataType.ARRAY's elements flat, with no recursion (see this
  // file's module doc), so the chain must be flattened into its 3 real elements first, or a module
  // would see a 2-element array whose second element is itself an array.
  test('a proper list is flattened into one flat ARRAY', async () => {
    const dh = new SourceDataHandler();
    const array = await sourceToModule(dh, [1, [2, [3, null]]]); // list(1, 2, 3)
    expect(array.type).toBe(DataType.ARRAY);
    const elements = await dh.list_to_vec(array as TypedValue<DataType.LIST>);
    expect(elements).toEqual([
      { type: DataType.NUMBER, value: 1 },
      { type: DataType.NUMBER, value: 2 },
      { type: DataType.NUMBER, value: 3 },
    ]);
  });

  // A module that simply forwards its argument unchanged (the common case: identity, a predicate
  // that returns its input, a wrapper that passes a value through) must hand the SAME flattened
  // ARRAY straight back to moduleToSource — this is exactly the shape `flattenedProperListArrays`
  // exists to recognise, so the round trip reconstructs `[1, [2, null]]`, not the lossy flat
  // `[1, 2]` a naive ARRAY -> array conversion would produce.
  test('a proper list survives an unchanged round trip through a module', async () => {
    const dh = new SourceDataHandler();
    const array = await sourceToModule(dh, [1, [2, null]]); // list(1, 2)
    expect(await moduleToSource(dh, array)).toEqual([1, [2, null]]);
  });

  // A flattened list nested inside a compound value (here, a genuine PAIR's head) must still be
  // recognised and reconstructed — the tracking is keyed by the array's own identifier, not by the
  // position moduleToSource happens to encounter it at.
  test('a flattened proper list nested inside a PAIR still reconstructs correctly', async () => {
    const dh = new SourceDataHandler();
    const list = await sourceToModule(dh, [1, [2, null]]); // list(1, 2)
    const pair = await dh.pair_make(list, {
      type: DataType.EMPTY_LIST,
      value: null,
    });
    expect(await moduleToSource(dh, pair)).toEqual([[1, [2, null]], null]);
  });

  // [1, 2] is NOT a proper list — its "tail", 2, is neither null nor another pair — whether it came
  // from `pair(1, 2)` or a §3 array literal. It must cross as a plain two-element ARRAY, unflattened
  // — flattening only applies to a chain that actually terminates in null.
  test('a non-proper-list two-element array is not flattened', async () => {
    const dh = new SourceDataHandler();
    const array = await sourceToModule(dh, [1, 2]);
    expect(array.type).toBe(DataType.ARRAY);
    expect(await dh.array_length(array as TypedValue<DataType.ARRAY>)).toBe(2);
    expect(await dh.array_get(array as TypedValue<DataType.ARRAY>, 1)).toEqual({
      type: DataType.NUMBER,
      value: 2,
    });
  });

  // A genuine §3 array (not a proper list) round-trips as a plain flat array, same as before this
  // was tracked — the reconstruction above must be specific to a flattened proper list, not to
  // every ARRAY.
  test('a genuine array round-trips as a plain flat array, not a cons chain', async () => {
    const dh = new SourceDataHandler();
    const array = await sourceToModule(dh, [1, 2]);
    expect(await moduleToSource(dh, array)).toEqual([1, 2]);
  });

  test('a plain closure becomes a callable module closure', async () => {
    const dh = new SourceDataHandler();
    const add = (a: number, b: number) => a + b;
    const typed = await sourceToModule(dh, add);
    expect(typed.type).toBe(DataType.CLOSURE);

    const gen = dh.closure_call(
      typed as TypedValue<DataType.CLOSURE>,
      [
        { type: DataType.NUMBER, value: 2 },
        { type: DataType.NUMBER, value: 3 },
      ],
      DataType.NUMBER,
    );
    let step = await gen.next();
    while (!step.done) step = await gen.next();
    expect(step.value).toEqual({ type: DataType.NUMBER, value: 5 });
  });

  // A closure moduleToSource previously produced from a module's own TypedValue must round-trip
  // back unchanged, not get wrapped in a new closure whose body would incorrectly try to call it
  // as if it were a Source function — see moduleToSource's CLOSURE case / the `moduleClosure` tag.
  test('a closure received from a module round-trips back to the identical TypedValue', async () => {
    const dh = new SourceDataHandler();
    const sig = { args: [DataType.NUMBER], returnType: DataType.NUMBER } as const;
    // ExternCallable is an async generator by contract; this one's own work is synchronous.
    // eslint-disable-next-line @typescript-eslint/require-await
    const original = await dh.closure_make(sig, async function* (a: TypedValue<DataType.NUMBER>) {
      return { type: DataType.NUMBER, value: a.value * 2 };
    });
    const asSourceValue = await moduleToSource(dh, original, 'double');
    const roundTripped = await sourceToModule(dh, asSourceValue);
    expect(roundTripped).toEqual(original);
  });

  test('an unsupported value type throws', async () => {
    await expect(sourceToModule(new SourceDataHandler(), { plain: 'object' })).rejects.toThrow(
      TypeError,
    );
    await expect(sourceToModule(new SourceDataHandler(), Symbol('x'))).rejects.toThrow(TypeError);
  });
});

describe('moduleToSource', () => {
  test('primitives', async () => {
    const dh = new SourceDataHandler();
    expect(await moduleToSource(dh, { type: DataType.EMPTY_LIST, value: null })).toBeNull();
    expect(await moduleToSource(dh, { type: DataType.VOID, value: undefined })).toBeUndefined();
    expect(await moduleToSource(dh, { type: DataType.NUMBER, value: 7 })).toBe(7);
    expect(await moduleToSource(dh, { type: DataType.BOOLEAN, value: false })).toBe(false);
    expect(await moduleToSource(dh, { type: DataType.CONST_STRING, value: 'x' })).toBe('x');
    expect(await moduleToSource(dh, { type: DataType.INTEGER, value: 3n })).toBe(3);
  });

  test('an ARRAY converts recursively to a plain array', async () => {
    const dh = new SourceDataHandler();
    const inner = await dh.array_make(DataType.NUMBER, 2, { type: DataType.NUMBER, value: 0 });
    await dh.array_set(inner, 0, { type: DataType.NUMBER, value: 1 });
    await dh.array_set(inner, 1, { type: DataType.NUMBER, value: 2 });
    expect(await moduleToSource(dh, inner)).toEqual([1, 2]);
  });

  // A genuine PAIR (not array-backed) is read as its own two elements, whatever they are — not
  // forced through a proper-list read that would reject a dotted pair.
  test('a genuine PAIR round-trips as a two-element array, dotted or not', async () => {
    const dh = new SourceDataHandler();
    const dotted = await dh.pair_make(
      { type: DataType.NUMBER, value: 1 },
      { type: DataType.NUMBER, value: 2 }, // tail is a number, not EMPTY_LIST/PAIR — a dotted pair
    );
    expect(await moduleToSource(dh, dotted)).toEqual([1, 2]);
  });

  test('an OPAQUE value round-trips as a SourceOpaque wrapper', async () => {
    const dh = new SourceDataHandler();
    const opaque = await dh.opaque_make({ pixels: [1, 2, 3] });
    const asSource = await moduleToSource(dh, opaque);
    expect(asSource).toBeInstanceOf(SourceOpaque);
    expect(await dh.opaque_get((asSource as SourceOpaque).typed)).toEqual({ pixels: [1, 2, 3] });
  });

  test('a CLOSURE becomes a callable Source function, named and with the reported arity', async () => {
    const dh = new SourceDataHandler();
    const sig = {
      args: [DataType.NUMBER, DataType.NUMBER],
      returnType: DataType.NUMBER,
    } as const;
    // eslint-disable-next-line @typescript-eslint/require-await -- see the disable above.
    const typed = await dh.closure_make(sig, async function* (a, b) {
      return { type: DataType.NUMBER, value: (a as any).value + (b as any).value };
    });

    const f = await moduleToSource(dh, typed, 'add');
    expect(typeof f).toBe('function');
    expect(f.name).toBe('add');
    expect(f.length).toBe(2);
    await expect(f(3, 4)).resolves.toBe(7);
  });

  // A module calling back into that same wrapped closure with a Source-side (not TypedValue)
  // argument would be a caller bug — this just confirms the wrapper does the full round trip
  // through sourceToModule/moduleToSource itself, symmetric with the sourceToModule.CLOSURE test.
  test('a wrapped module closure converts its own arguments and result', async () => {
    const dh = new SourceDataHandler();
    const sig = { args: [DataType.ARRAY], returnType: DataType.ARRAY } as const;
    const reverseTyped = await dh.closure_make(sig, async function* (xs) {
      const elements = await dh.list_to_vec(xs as TypedValue<DataType.LIST>);
      return dh.list(...elements.reverse());
    });

    const reverse = await moduleToSource(dh, reverseTyped, 'reverse');
    await expect(reverse([1, [2, [3, null]]])).resolves.toEqual([3, [2, [1, null]]]);
  });
});
