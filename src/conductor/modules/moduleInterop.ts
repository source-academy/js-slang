import { DataType, type TypedValue } from '@sourceacademy/conductor/types';

import type { Value } from '../../types';
import { callWithoutMetadataAsync, wrapUnsafe } from '../../utils/operators';

import type { SourceDataHandler } from './SourceDataHandler';

/**
 * Conversion between js-slang's own runtime values and Conductor's module protocol
 * (`TypedValue<DataType>`), for js-slang's transpiler evaluator (`SourceEvaluator`). Mirrors
 * py-slang's `moduleInterop.ts` (`src/engines/py2js/moduleInterop.ts`) in shape, but is considerably
 * more direct, for a reason specific to this engine: js-slang's runtime values *are* Conductor's data
 * model already, because Conductor's model was designed from SICP in the first place. A Source pair
 * is already a two-element JS array; the empty list is already `null`. Nothing here builds a tagged
 * union or reinterprets one shape as another the way py-slang's converter has to.
 *
 * ## Why a proper list is flattened before crossing, even though a single pair isn't
 *
 * `list(1, 2, 3)` is `pair(1, pair(2, pair(3, null)))` — nested two-element arrays, `[1, [2, [3,
 * null]]]` — but `SourceDataHandler.list_to_vec`/`readListElements` read a `DataType.ARRAY`'s
 * elements *flat*, with no recursion (matching a genuine §3 array, which is exactly the point:
 * `SourceDataHandler` can't tell a cons chain from a real array either — see its own class doc). So
 * converting `[1, [2, [3, null]]]` element-for-element, keeping the nesting, would hand a module's
 * `list_to_vec` a 2-element array whose second element is itself an ARRAY, not the 3 elements a
 * module expects. `isProperList`/`flattenProperList` below detect exactly this shape (a chain of
 * 2-element arrays terminating in `null`) and flatten it into its real elements before building one
 * flat `ARRAY` — mirroring py-slang's identical `pythonToModule` step. A `[1, 2]` that is *not* part
 * of a longer chain (whether it's `pair(1, 2)` or a §3 two-element array) is not a proper list itself
 * (its tail, `2`, isn't `null` or another pair) and crosses as a plain flat two-element `ARRAY`,
 * unaffected — `SourceDataHandler`'s pair/array tolerance handles it identically either way once it's
 * on the module side.
 *
 * ## What crosses and what doesn't
 *
 * `null` (Source's empty list) ↔ `EMPTY_LIST`; `number`/`string`/`boolean` ↔ their obvious
 * counterparts; `Array` ↔ `ARRAY`, recursively; a JS `function` (every Source function value, in this
 * engine — there is no separate "Closure" wrapper the way the CSE machine has one) ↔ `CLOSURE`. An
 * `OPAQUE` value received from a module has no Source-side representation of its own, so it round-
 * trips as a `SourceOpaque` wrapper (below) that Source code can hold and pass back but never
 * inspect — matching how such a value behaves already (a game/image/wave handle is opaque to the
 * student in every engine). Anything else (a plain JS object literal, `undefined` outside `VOID`
 * position, a `RegExp`) throws — Source's own value set does not include them.
 */
export class SourceOpaque {
  constructor(readonly typed: TypedValue<DataType.OPAQUE>) {}
}

/** Converts a js-slang runtime value into a Conductor `TypedValue`, for an argument a Source program
 * passes into a module function, or a value a Source closure returns to a module that called it. */
export async function sourceToModule(
  dh: SourceDataHandler,
  value: Value,
): Promise<TypedValue<DataType>> {
  if (value === null) {
    return { type: DataType.EMPTY_LIST, value: null };
  }
  if (value === undefined) {
    return { type: DataType.VOID, value: undefined };
  }

  switch (typeof value) {
    case 'number':
      return { type: DataType.NUMBER, value };
    case 'boolean':
      return { type: DataType.BOOLEAN, value };
    case 'string':
      return { type: DataType.CONST_STRING, value };
    case 'function': {
      // A closure this same converter previously produced from a module value (see
      // `moduleToSource`'s CLOSURE case) is passed straight back unchanged, rather than wrapped in
      // a *new* closure whose body would incorrectly assume it is a Source function it can call —
      // it is still, underneath, the module's own closure. The module receiving it back samples it
      // directly, same as `pythonToModule`'s identical pass-through in py-slang.
      const moduleClosure = (value as { moduleClosure?: TypedValue<DataType.CLOSURE> })
        .moduleClosure;
      if (moduleClosure) return moduleClosure;

      const arity = Math.max(0, (value as (...args: unknown[]) => unknown).length);
      async function* sourceClosureFunc(
        ...args: TypedValue<DataType>[]
      ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
        const nativeArgs = await Promise.all(args.map(a => moduleToSource(dh, a)));
        const result = await callWithoutMetadataAsync(
          value as (...a: Value[]) => Value,
          ...nativeArgs,
        );
        return sourceToModule(dh, result);
      }
      // Every argument and the return type are DataType.ANY: Source is dynamically typed, so
      // nothing here can state a real signature the way a module's own closure_make call does.
      // isVararg: true — same reasoning: `arity` (fn.length) is a reasonable *minimum* for a
      // typical `(a, b) => ...` closure, but nothing observable from a bare function reference can
      // say whether it also accepts a rest parameter, so this errs toward not rejecting a call the
      // Source side itself would have accepted.
      return dh.closure_make(
        { args: Array(arity).fill(DataType.ANY), returnType: DataType.ANY },
        sourceClosureFunc,
        undefined,
        true,
      );
    }
    case 'object':
      if (Array.isArray(value)) {
        const flatElements = isProperList(value) ? flattenProperList(value) : value;
        const elements = await Promise.all(flatElements.map(el => sourceToModule(dh, el)));
        const array = await dh.array_make(DataType.ANY, elements.length, {
          type: DataType.VOID,
          value: undefined,
        });
        for (let i = 0; i < elements.length; i++) {
          await dh.array_set(array as TypedValue<DataType.ARRAY, DataType.VOID>, i, elements[i]);
        }
        return array;
      }
      if (value instanceof SourceOpaque) {
        return value.typed;
      }
      throw new TypeError(
        'Only numbers, strings, booleans, arrays and functions can cross into a module.',
      );
    default:
      throw new TypeError(`Cannot pass a value of type ${typeof value} to a module.`);
  }
}

/**
 * True iff `value` is a chain of two-element arrays terminating in `null` — a genuine Source proper
 * list, as `pair`/`list` build it, rather than a §3 array (or a dotted, non-terminating pair) that
 * merely happens to have length 2. No cycle detection, matching every other list primitive in this
 * codebase (`is_list`, `SourceDataHandler.readListElements`): a circular list hangs here too, rather
 * than erroring, which is the existing, deliberate stance elsewhere.
 */
function isProperList(value: unknown): value is [Value, Value] {
  let current = value;
  while (current !== null) {
    if (!Array.isArray(current) || current.length !== 2) return false;
    current = current[1];
  }
  return true;
}

/** Reads a proper list's own elements out of its cons chain, in order — the inverse of `list(...)`. */
function flattenProperList(value: unknown[]): Value[] {
  const result: Value[] = [];
  let current: unknown = value;
  while (current !== null) {
    const [head, tail] = current as [Value, Value];
    result.push(head);
    current = tail;
  }
  return result;
}

/**
 * Converts a Conductor `TypedValue` into a js-slang runtime value — for an imported binding, or an
 * argument a module passes to a Source closure it is calling back. `name`, when given, becomes the
 * wrapped function's displayed name (`f.name`), matching how an imported binding is actually named
 * in the student's program; it defaults to a generic placeholder for a value reached indirectly (one
 * module function returning another as its result).
 */
export async function moduleToSource(
  dh: SourceDataHandler,
  value: TypedValue<DataType>,
  name = '<module function>',
): Promise<Value> {
  switch (value.type) {
    case DataType.NUMBER:
      return value.value;
    case DataType.INTEGER:
      // js-slang has no separate integer type; every number crossing the module boundary is a
      // plain JS number, as pythonToModule's NUMBER case already produces. Only present here for
      // exhaustiveness over conductor's DataType enum.
      return Number(value.value);
    case DataType.BOOLEAN:
      return value.value;
    case DataType.CONST_STRING:
      return value.value;
    case DataType.VOID:
    case DataType.EMPTY_LIST:
      return value.type === DataType.EMPTY_LIST ? null : undefined;
    case DataType.OPAQUE:
      return new SourceOpaque(value);
    case DataType.CLOSURE: {
      const arity = await dh.closure_arity(value);
      const f = wrapUnsafe(
        async (...args: Value[]) => {
          const typedArgs = await Promise.all(args.map(a => sourceToModule(dh, a)));
          const gen = dh.closure_call(value, typedArgs, DataType.ANY);
          let step = await gen.next();
          while (!step.done) step = await gen.next();
          return moduleToSource(dh, step.value);
        },
        // Unlimited (`true`), whether or not the module closure is actually vararg:
        // `SourceDataHandler.closure_call` is the authoritative arity check regardless (it reports
        // `InvalidArityError` in Source's own vocabulary), so js-slang's own arg-count gate here
        // would only ever be a second, differently-worded check on top of it — not additionally
        // safe, just confusing on a mismatch.
        true,
        name,
        `function ${name} { [Function from a module; implementation hidden] }`,
        null,
      );
      Object.defineProperty(f, 'length', { value: arity, configurable: true });
      // Tags the wrapper with the TypedValue it came from — see sourceToModule's CLOSURE case,
      // which checks for this and passes the original identifier straight back rather than
      // wrapping a *new* closure around `f` (which isn't a genuine Source function; calling it
      // through callIfFuncAndRightArgsAsync would work, but every call would pay for an extra,
      // pointless round trip through sourceToModule/moduleToSource on values already in their
      // module-side form).
      (f as { moduleClosure?: TypedValue<DataType.CLOSURE> }).moduleClosure = value;
      return f;
    }
    case DataType.PAIR:
    case DataType.ARRAY: {
      const elements = await readCompoundElements(dh, value);
      const result: Value[] = [];
      for (const el of elements) {
        result.push(await moduleToSource(dh, el, name));
      }
      return result;
    }
  }
}

/** Reads a PAIR or ARRAY's own elements uniformly — a PAIR is always exactly 2 (head, tail,
 * whatever they are, not necessarily continuing a proper list — a module's own dotted pair, if it
 * has one, round-trips faithfully rather than being force-read as a list). */
async function readCompoundElements(
  dh: SourceDataHandler,
  value: TypedValue<DataType.ARRAY> | TypedValue<DataType.PAIR>,
): Promise<TypedValue<DataType>[]> {
  if (value.type === DataType.PAIR) {
    return [await dh.pair_head(value), await dh.pair_tail(value)];
  }
  const length = await dh.array_length(value);
  return Promise.all(Array.from({ length }, (_, i) => dh.array_get(value, i)));
}
