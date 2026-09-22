/* eslint-disable @typescript-eslint/require-await --
 * Most methods here compute synchronously, so `require-await` flags every one of them. The `async`
 * is deliberate and load-bearing: `IDataHandler` declares these as `Promise`-returning, and without
 * `async` a failed lookup would throw *synchronously* out of a call that the caller is entitled to
 * treat as a promise — `handler.pair_head(p).catch(...)` would never see it. `async` turns every
 * one of those throws into a rejection. Returning `Promise.reject()` by hand at each throw site
 * would satisfy the rule and lose the guarantee at the first one anybody forgets.
 */
import type { IEvaluator, IInterfacableEvaluator } from '@sourceacademy/conductor/runner';
import {
  type ArrayIdentifier,
  type ClosureIdentifier,
  DataType,
  type ExternCallable,
  type IDataHandler,
  type IFunctionSignature,
  type OpaqueIdentifier,
  type PairIdentifier,
  type TypedValue,
} from '@sourceacademy/conductor/types';
import { isSameType } from '@sourceacademy/conductor/util';

import {
  InvalidArityError,
  InvalidArrayCreationError,
  InvalidIdentifierError,
  InvalidIndexError,
  InvalidOpaqueUpdateError,
  InvalidTypeError,
  typeName,
} from './errors';

/** The zero value for each type that has one. `array_make` needs an explicit `init` for the rest. */
const DEFAULT_VALUES = {
  [DataType.NUMBER]: { type: DataType.NUMBER, value: 0 },
  [DataType.CONST_STRING]: { type: DataType.CONST_STRING, value: '' },
  [DataType.BOOLEAN]: { type: DataType.BOOLEAN, value: false },
  [DataType.VOID]: { type: DataType.VOID, value: undefined },
  [DataType.EMPTY_LIST]: { type: DataType.EMPTY_LIST, value: null },
  [DataType.INTEGER]: { type: DataType.INTEGER, value: 0n },
} as const;

/**
 * js-slang's Conductor {@link IDataHandler}: the object a module talks to when it needs to build or
 * inspect a value on the Source side.
 *
 * Conductor does not let a module hold a live reference. Every compound value crosses the boundary
 * as an opaque identifier (`PairIdentifier`, `ArrayIdentifier`, `ClosureIdentifier`), and the module
 * comes back here to read or write it. This class is the table those identifiers index into.
 *
 * ## Why a private table rather than live Source values
 *
 * A Source pair already *is* a two-element JS array, so this handler could have handed out
 * identifiers backed by the student's actual values, making a module's `pair_settail` mutate the
 * pair the student holds. That was considered and rejected (#2081): keeping the table private
 * matches py-slang, and — more importantly — keeps the boundary one-directional, so a module cannot
 * reach into the evaluator's heap through a handle it was given for reading.
 *
 * The consequence is that values are **converted** across the boundary rather than shared. That
 * conversion is not in this file: this class never sees a js-slang value. Engine values enter only
 * through the `ExternCallable` passed to {@link closure_make}, and through the arguments and results
 * flowing through {@link closure_call} — all of which the interop layer builds.
 *
 * ## Why the shapes are more forgiving than the types suggest
 *
 * The module bundles are **shared between languages** — the same `rune`, `sound` and `midi` builds
 * serve Source and Python. So this handler has to accept the same shapes py-slang's does, or a
 * bundle that works from Python breaks from Source. Two places where that matters:
 *
 * - `pair_head`/`pair_tail`/`pair_sethead`/`pair_settail`/`pair_assert` work on a `DataType.ARRAY`
 *   of length ≥ 2 as well as a genuine `PAIR`. A pair is just a two-element array, and module code
 *   is free to keep calling `pair_head` for clarity on a value it was handed as an array.
 * - The list helpers (`is_list`, `list_to_vec`, `length`, `accumulate`) accept either a `PAIR`/
 *   `EMPTY_LIST` chain or a flat `ARRAY`.
 *
 * Both tolerances are deliberately copied from py-slang rather than re-derived.
 */
export class SourceDataHandler implements IDataHandler {
  readonly hasDataInterface = true as const;

  private readonly pairMap = new Map<
    PairIdentifier,
    { head: TypedValue<DataType>; tail: TypedValue<DataType> }
  >();
  private readonly arrayMap = new Map<
    ArrayIdentifier<DataType>,
    { type: DataType; elements: TypedValue<DataType>[] }
  >();
  private readonly closureMap = new Map<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ClosureIdentifier<any>,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sig: IFunctionSignature<any, any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      func: ExternCallable<any, any>;
      dependsOn?: (TypedValue<DataType> | null)[];
      isVararg?: boolean;
    }
  >();
  private readonly opaqueMap = new Map<OpaqueIdentifier, { value: unknown; immutable: boolean }>();

  private uniqueId = 0;

  // ---------------------------------------------------------------- pairs

  async pair_make(
    head: TypedValue<DataType>,
    tail: TypedValue<DataType>,
  ): Promise<TypedValue<DataType.PAIR>> {
    const id = this.uniqueId++ as PairIdentifier;
    this.pairMap.set(id, { head, tail });
    return { type: DataType.PAIR, value: id };
  }

  /**
   * Resolves a value the caller is treating as a pair, whether it is a genuine `PAIR` or an `ARRAY`
   * of length ≥ 2 — see the class comment on why both are accepted. Returns a view that writes
   * back to whichever table actually owns the value.
   *
   * The array-backed `setHead`/`setTail` enforce `array.type` on the incoming value, exactly as
   * `array_set` does — without this, `pair_sethead` on a typed array would be a second, unchecked
   * way to write into it, silently breaking the array's own homogeneity (writing a `CONST_STRING`
   * into a `NUMBER` array, say) in a way `array_get` and `array_type` would then both disagree with.
   */
  private resolvePairView(p: TypedValue<DataType.PAIR>): {
    head: TypedValue<DataType>;
    tail: TypedValue<DataType>;
    setHead(tv: TypedValue<DataType>): void;
    setTail(tv: TypedValue<DataType>): void;
  } {
    if ((p.type as DataType) === DataType.ARRAY) {
      const array = this.arrayMap.get(p.value as unknown as ArrayIdentifier<DataType>);
      if (!array || array.elements.length < 2) {
        throw new InvalidIdentifierError('a pair', p.value);
      }
      const checkType = (tv: TypedValue<DataType>) => {
        if (array.type !== DataType.VOID && !isSameType(tv.type, array.type)) {
          throw new InvalidTypeError('an array element', typeName(array.type), typeName(tv.type));
        }
      };
      return {
        head: array.elements[0],
        tail: array.elements[1],
        setHead: tv => {
          checkType(tv);
          array.elements[0] = tv;
        },
        setTail: tv => {
          checkType(tv);
          array.elements[1] = tv;
        },
      };
    }

    const pair = this.pairMap.get(p.value);
    if (!pair) {
      throw new InvalidIdentifierError('a pair', p.value);
    }
    return {
      head: pair.head,
      tail: pair.tail,
      setHead: tv => (pair.head = tv),
      setTail: tv => (pair.tail = tv),
    };
  }

  async pair_head(p: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
    return this.resolvePairView(p).head;
  }

  async pair_tail(p: TypedValue<DataType.PAIR>): Promise<TypedValue<DataType>> {
    return this.resolvePairView(p).tail;
  }

  async pair_sethead(p: TypedValue<DataType.PAIR>, tv: TypedValue<DataType>): Promise<void> {
    this.resolvePairView(p).setHead(tv);
    return;
  }

  async pair_settail(p: TypedValue<DataType.PAIR>, tv: TypedValue<DataType>): Promise<void> {
    this.resolvePairView(p).setTail(tv);
    return;
  }

  async pair_assert(
    p: TypedValue<DataType.PAIR>,
    headType?: DataType,
    tailType?: DataType,
  ): Promise<void> {
    const { head, tail } = this.resolvePairView(p);
    if (headType !== undefined && !isSameType(head.type, headType)) {
      throw new InvalidTypeError('the head of a pair', typeName(headType), typeName(head.type));
    }
    if (tailType !== undefined && !isSameType(tail.type, tailType)) {
      throw new InvalidTypeError('the tail of a pair', typeName(tailType), typeName(tail.type));
    }
    return;
  }

  // --------------------------------------------------------------- arrays

  private resolveArray(a: TypedValue<DataType.ARRAY>) {
    const array = this.arrayMap.get(a.value);
    if (!array) {
      throw new InvalidIdentifierError('an array', a.value);
    }
    return array;
  }

  async array_make<T extends DataType>(
    t: T,
    len: number,
    init?: TypedValue<NoInfer<T>>,
  ): Promise<TypedValue<DataType.ARRAY, NoInfer<T>>> {
    if (init === undefined && !(t in DEFAULT_VALUES)) {
      throw new InvalidArrayCreationError(typeName(t));
    }
    const elements = new Array(len).fill(init ?? DEFAULT_VALUES[t as keyof typeof DEFAULT_VALUES]);
    const id = this.uniqueId++ as ArrayIdentifier<T>;
    this.arrayMap.set(id, { type: t, elements });
    return { type: DataType.ARRAY, value: id };
  }

  async array_length(a: TypedValue<DataType.ARRAY>): Promise<number> {
    return this.resolveArray(a).elements.length;
  }

  async array_type<T extends DataType>(a: TypedValue<DataType.ARRAY, T>): Promise<NoInfer<T>> {
    return this.resolveArray(a).type as NoInfer<T>;
  }

  async array_get<T extends DataType>(
    a: TypedValue<DataType.ARRAY, T>,
    idx: number,
  ): Promise<TypedValue<NoInfer<T>>>;
  async array_get(
    a: TypedValue<DataType.ARRAY, DataType.VOID>,
    idx: number,
  ): Promise<TypedValue<DataType>> {
    const array = this.resolveArray(a);
    if (!Number.isInteger(idx) || idx < 0 || idx >= array.elements.length) {
      throw new InvalidIndexError(idx, array.elements.length);
    }
    return array.elements[idx];
  }

  async array_set<T extends DataType>(
    a: TypedValue<DataType.ARRAY, T>,
    idx: number,
    tv: TypedValue<NoInfer<T>>,
  ): Promise<void>;
  async array_set(
    a: TypedValue<DataType.ARRAY, DataType.VOID>,
    idx: number,
    tv: TypedValue<DataType>,
  ): Promise<void>;
  async array_set(
    a: TypedValue<DataType.ARRAY, DataType>,
    idx: number,
    tv: TypedValue<DataType>,
  ): Promise<void> {
    const array = this.resolveArray(a);
    if (!Number.isInteger(idx) || idx < 0 || idx >= array.elements.length) {
      throw new InvalidIndexError(idx, array.elements.length);
    }
    // An array created with an explicit element type stays homogeneous; a VOID-typed one is the
    // untyped case conductor's own docs discourage, and accepts anything.
    if (array.type !== DataType.VOID && !isSameType(tv.type, array.type)) {
      throw new InvalidTypeError('an array element', typeName(array.type), typeName(tv.type));
    }
    array.elements[idx] = tv;
    return;
  }

  async array_assert<T extends DataType>(
    a: TypedValue<DataType.ARRAY>,
    type?: T,
    length?: number,
  ): Promise<void> {
    const array = this.resolveArray(a);
    if (type !== undefined && !isSameType(array.type, type)) {
      throw new InvalidTypeError(
        'an array',
        `an array of ${typeName(type)}`,
        `an array of ${typeName(array.type)}`,
      );
    }
    if (length !== undefined && array.elements.length !== length) {
      throw new InvalidIndexError(length, array.elements.length);
    }
    return;
  }

  // ------------------------------------------------------------- closures

  /**
   * `isVararg` is an extension beyond `IDataHandler`, whose `closure_make` takes only three
   * arguments — `IFunctionSignature` has no way to express a variadic closure. A module therefore
   * never passes it; only js-slang's own interop layer does, when it wraps a variadic Source
   * function such as `draw_data(x1, ...xs)`. py-slang extends the signature the same way.
   */
  async closure_make<const Arg extends readonly DataType[], const Ret extends DataType>(
    sig: IFunctionSignature<Arg, Ret>,
    func: ExternCallable<Arg, Ret>,
    dependsOn?: (TypedValue<DataType> | null)[],
    isVararg?: boolean,
  ): Promise<TypedValue<DataType.CLOSURE, Ret>> {
    const id = this.uniqueId++ as ClosureIdentifier<Ret>;
    this.closureMap.set(id, { sig, func, dependsOn, isVararg });
    return { type: DataType.CLOSURE, value: id };
  }

  private resolveClosure<T extends DataType>(c: TypedValue<DataType.CLOSURE, T>) {
    const closure = this.closureMap.get(c.value);
    if (closure === undefined) {
      throw new InvalidIdentifierError('a function', c.value);
    }
    return closure;
  }

  async closure_is_vararg(c: TypedValue<DataType.CLOSURE>): Promise<boolean> {
    return this.closureMap.get(c.value)?.isVararg ?? false;
  }

  async closure_arity(c: TypedValue<DataType.CLOSURE>): Promise<number> {
    return this.closureMap.get(c.value)?.sig.args.length ?? 0;
  }

  /**
   * A pair and a two-element array are the same thing to a module (see the class comment), so a
   * declared `PAIR`/`LIST` is satisfied by an `ARRAY`. Without this, a bundle that encodes a list as
   * an `ARRAY` — which py-slang's interop does — fails its own signature check.
   *
   * Deliberately one-directional: the reverse (a declared `ARRAY` accepting an actual `PAIR`) is NOT
   * allowed, even though it sounds symmetric. `resolveArray`/`array_get`/`array_set` only ever
   * consult `arrayMap` — a genuine (non-array-backed) `PAIR` has no entry there — so accepting one
   * here would let a value straight through the signature check only to throw
   * `InvalidIdentifierError` the moment the closure actually calls an array operation on it. Letting
   * that check fail immediately, at the boundary, is a far clearer error than a mismatched promise
   * a few lines further into the module's own code.
   */
  private typesCompatible(declared: DataType, actual: DataType): boolean {
    if (declared === DataType.ANY) return true;
    if ((declared === DataType.PAIR || declared === DataType.LIST) && actual === DataType.ARRAY) {
      return true;
    }
    return isSameType(actual, declared);
  }

  async *closure_call<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
    returnType: T,
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    const closure = this.resolveClosure(c);
    const arity = closure.sig.args.length;
    if (args.length < arity || (!closure.isVararg && args.length > arity)) {
      throw new InvalidArityError(arity, args.length);
    }

    for (const [i, arg] of args.entries()) {
      if (i >= arity) break;
      if (!this.typesCompatible(closure.sig.args[i], arg.type)) {
        throw new InvalidTypeError(
          `argument ${i + 1}`,
          typeName(closure.sig.args[i]),
          typeName(arg.type),
        );
      }
    }

    const result = yield* closure.func(...args);
    if (!this.typesCompatible(returnType, result.type)) {
      throw new InvalidTypeError('the returned value', typeName(returnType), typeName(result.type));
    }
    return result as TypedValue<NoInfer<T>>;
  }

  async *closure_call_unchecked<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
  ): AsyncGenerator<void, TypedValue<NoInfer<T>>, undefined> {
    const closure = this.resolveClosure(c);
    return (yield* closure.func(...args)) as TypedValue<NoInfer<T>>;
  }

  /**
   * The escape hatch for a module that must call a Source closure from synchronous code — the
   * `sound` bundle sampling a student's wave function 44100 times a second, or `pix_n_flix` running
   * a per-frame filter. Not part of `IDataHandler`; both bundles probe for it with
   * `evaluator.closure_call_sync?.bind(evaluator)` and fall back to `closure_call_unchecked`.
   *
   * An `ExternCallable` may carry a `.sync` twin: a plain function computing the same result with no
   * generator indirection, set by the interop layer **only** when it can prove the closure never
   * needs a host round-trip. Returning `undefined` means "no sync form, use the async path", which
   * is unambiguous because a real result is always a `{ type, value }` object — even for `VOID`.
   *
   * This handler only forwards. Deciding when a Source closure may carry a `.sync` twin is the
   * interop layer's job, and it cannot be answered until the async spine exists (#2081).
   */
  closure_call_sync<T extends DataType>(
    c: TypedValue<DataType.CLOSURE, T>,
    args: TypedValue<DataType>[],
  ): TypedValue<NoInfer<T>> | undefined {
    const func = this.closureMap.get(c.value)?.func as
      | (ExternCallable<DataType[], T> & {
          sync?: (...a: TypedValue<DataType>[]) => TypedValue<DataType> | undefined;
        })
      | undefined;
    return func?.sync?.(...args) as TypedValue<NoInfer<T>> | undefined;
  }

  async closure_arity_assert(c: TypedValue<DataType.CLOSURE>, arity: number): Promise<void> {
    const closure = this.resolveClosure(c);
    if (closure.sig.args.length !== arity && !closure.isVararg) {
      throw new InvalidArityError(closure.sig.args.length, arity);
    }
    return;
  }

  // -------------------------------------------------------------- opaques

  async opaque_make(v: unknown, immutable?: boolean): Promise<TypedValue<DataType.OPAQUE>> {
    const id = this.uniqueId++ as OpaqueIdentifier;
    this.opaqueMap.set(id, { value: v, immutable: immutable ?? false });
    return { type: DataType.OPAQUE, value: id };
  }

  async opaque_get(o: TypedValue<DataType.OPAQUE>): Promise<unknown> {
    const opaque = this.opaqueMap.get(o.value);
    if (!opaque) {
      throw new InvalidIdentifierError('an opaque', o.value);
    }
    return opaque.value;
  }

  async opaque_update(o: TypedValue<DataType.OPAQUE>, v: unknown): Promise<void> {
    const opaque = this.opaqueMap.get(o.value);
    if (!opaque) {
      throw new InvalidIdentifierError('an opaque', o.value);
    }
    if (opaque.immutable) {
      throw new InvalidOpaqueUpdateError();
    }
    opaque.value = v;
    return;
  }

  // ------------------------------------------------------------ lifetimes

  /**
   * `tie`/`untie` let an evaluator with its own garbage collector keep a dependee alive as long as
   * its dependent. js-slang has no such collector at this boundary: every table above holds a strong
   * reference for the lifetime of the handler, so everything is already tied and nothing can be
   * untied. Both are therefore no-ops rather than throws — py-slang throws `Method not implemented`,
   * which would abort a student's program for a call that asks for something already guaranteed.
   *
   * The honest cost is that identifiers are never reclaimed within a run. That is a leak, and it is
   * the reason {@link reset} exists.
   */
  async tie(
    _dependent: TypedValue<DataType>,
    _dependee: TypedValue<DataType> | null,
  ): Promise<void> {
    return;
  }

  async untie(
    _dependent: TypedValue<DataType>,
    _dependee: TypedValue<DataType> | null,
  ): Promise<void> {
    return;
  }

  /**
   * Drops every identifier issued so far. Called between runs, not between REPL chunks: a value a
   * module is still holding across chunks (a `sound` still playing, a `pix_n_flix` filter) must
   * survive, but nothing should survive pressing Run again.
   *
   * `uniqueId` is deliberately NOT reset here, even though every table it indexes into is cleared.
   * A module can hold a handle from a *previous* run past this call — the exact "still playing
   * sound" case this method exists to let survive across chunks is also, structurally, nothing
   * more than a module retaining a stale reference across a call to `reset()` it doesn't know
   * happened. If ids restarted at 0, the next value created after this reset would get the same
   * numeric id as the first value from the run before it, and a stale handle would silently read
   * or mutate the new run's unrelated value instead of raising `InvalidIdentifierError` the way a
   * genuinely dangling handle should. Keeping the counter monotonic for the handler's entire
   * lifetime is what keeps that error honest.
   */
  reset(): void {
    this.pairMap.clear();
    this.arrayMap.clear();
    this.closureMap.clear();
    this.opaqueMap.clear();
  }

  // ------------------------------------------------------- list utilities

  async list(...elements: TypedValue<DataType>[]): Promise<TypedValue<DataType.LIST>> {
    let acc: TypedValue<DataType.LIST> = { type: DataType.EMPTY_LIST, value: null };
    for (let i = elements.length - 1; i >= 0; i--) {
      acc = await this.pair_make(elements[i], acc);
    }
    return acc;
  }

  /**
   * Reads a list's elements, accepting either a `PAIR`/`EMPTY_LIST` chain or a flat `ARRAY` — see
   * the class comment. Improper lists and dangling handles both throw, which is what makes
   * {@link is_list} answerable by trying.
   */
  private readListElements(xs: TypedValue<DataType>): TypedValue<DataType>[] {
    if (xs.type === DataType.ARRAY) {
      return this.resolveArray(xs).elements;
    }

    const result: TypedValue<DataType>[] = [];
    let current: TypedValue<DataType> = xs;
    while (current.type !== DataType.EMPTY_LIST) {
      if (current.type !== DataType.PAIR) {
        throw new InvalidTypeError('the argument', 'a list', typeName(current.type));
      }
      const pair = this.pairMap.get(current.value);
      if (!pair) {
        throw new InvalidIdentifierError('a pair', current.value);
      }
      result.push(pair.head);
      current = pair.tail;
    }
    return result;
  }

  async is_list(xs: TypedValue<DataType.LIST>): Promise<boolean> {
    try {
      this.readListElements(xs);
      return true;
    } catch {
      return false;
    }
  }

  async list_to_vec(xs: TypedValue<DataType.LIST>): Promise<TypedValue<DataType>[]> {
    return this.readListElements(xs);
  }

  async length(xs: TypedValue<DataType.LIST>): Promise<number> {
    return this.readListElements(xs).length;
  }

  async *accumulate<T extends Exclude<DataType, DataType.VOID>>(
    op: TypedValue<DataType.CLOSURE, T>,
    initial: TypedValue<T>,
    sequence: TypedValue<DataType.LIST>,
    resultType: T,
  ): AsyncGenerator<void, TypedValue<T>, undefined> {
    let acc: TypedValue<T> = initial;
    // Right to left, matching Source's own `accumulate`.
    const elements = this.readListElements(sequence);
    for (let i = elements.length - 1; i >= 0; i--) {
      acc = yield* this.closure_call(op, [elements[i], acc], resultType);
    }
    return acc;
  }
}

/**
 * `ModuleLoaderRunnerPlugin` wants one object satisfying `IInterfacableEvaluator`
 * (`IEvaluator & IDataHandler`), but the two halves live on two objects: the evaluator itself, and
 * its {@link SourceDataHandler}. This proxy presents them as one, so registration stays a single
 * call rather than twenty forwarding methods per evaluator.
 *
 * Methods are bound to the handler before being returned. A bare `Reflect.get` hands back an unbound
 * method, and calling it through the proxy would set `this` to the proxy — so `this.uniqueId++` in
 * `pair_make` would read and write the *evaluator*, silently issuing duplicate identifiers.
 */
export function asInterfacableEvaluator(
  evaluator: IEvaluator,
  dataHandler: SourceDataHandler,
): IInterfacableEvaluator {
  return new Proxy(evaluator, {
    get(target, prop, receiver) {
      if (prop in dataHandler) {
        const value = Reflect.get(dataHandler, prop, dataHandler);
        return typeof value === 'function' ? value.bind(dataHandler) : value;
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as IInterfacableEvaluator;
}
