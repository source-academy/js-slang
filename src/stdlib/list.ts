/**
 * list.ts: Supporting lists in the Scheme style, using pairs made
 *          up of two-element JavaScript array (vector)
 * @author: Martin Henz
 * Translated to TypeScript by Evan Sebastian
 */

import { GeneralRuntimeError } from '../errors/base';
import { InvalidParameterTypeError } from '../errors/rttcErrors';
import type { Value } from '../types';
import { assertFunctionOfLength, assertNumberWithinRange } from '../utils/rttc';
import type { ArrayLike } from '../utils/stringify';

export type Pair<H, T> = [H, T];
export type List<T = unknown> = null | NonEmptyList<T>;
export type NonEmptyList<T> = [T, List<T>];

// array test works differently for Rhino and
// the Firefox environment (especially Web Console)
function array_test(x: unknown): x is unknown[] {
  if (Array.isArray === undefined) {
    return x instanceof Array;
  } else {
    return Array.isArray(x);
  }
}

/**
 * constructs a pair using a two-element array\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function pair<T>(x: T, xs: List<T>): NonEmptyList<T>;
export function pair<H, T>(x: H, xs: T): Pair<H, T>;
export function pair<H, T>(x: H, xs: T) {
  return [x, xs];
}

/**
 * returns true iff arg is a two-element array\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function is_pair(x: unknown): x is Pair<unknown, unknown> {
  return array_test(x) && x.length === 2;
}

/**
 * returns the first component of the given pair\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a pair
 */
export function head<T>(xs: Pair<T, unknown> | NonEmptyList<T>): T;
export function head(xs: unknown) {
  if (!is_pair(xs)) {
    throw new InvalidParameterTypeError('pair', xs, head.name)
  }

  return xs[0];
}

/**
 * returns the second component of the given pair\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a pair
 */
export function tail<T>(xs: NonEmptyList<T>): List<T>;
export function tail<T>(xs: Pair<unknown, T>): T;
export function tail(xs: unknown) {
  if (!is_pair(xs)) {
    throw new InvalidParameterTypeError('pair', xs, tail.name);
  }

  return xs[1];
}

/**
 * changes the head of given pair xs to be x\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a pair
 */
export function set_head(xs: Pair<any, any>, x: any): void;
export function set_head(xs: unknown, x: any): void {
  if (!is_pair(xs)) {
    throw new InvalidParameterTypeError('pair', xs, set_head.name)
  }

  xs[0] = x;
}

/**
 * changes the tail of given pair xs to be x\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a pair
 */
export function set_tail(xs: Pair<any, any>, x: any): void;
export function set_tail(xs: unknown, x: any): void {
  if (!is_pair(xs)) {
    throw new InvalidParameterTypeError('pair', xs, set_tail.name)
  }

  xs[1] = x;
}

/**
 * returns true if arg is exactly null\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function is_null(xs: unknown): xs is null {
  return xs === null;
}

/**
 * makes a list out of its arguments\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function list<T>(...elements: T[]): NonEmptyList<T>;
export function list<T>(): List<T>;
export function list<T>(...elements: T[]): List<T> {
  return elements.reduceRight((res, each) => pair(each, res), null);
}

/**
 * recurses down the list and checks that it ends with the empty list null\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 */
export function is_list(xs: unknown): xs is List<unknown> {
  while (is_pair(xs)) {
    xs = tail(xs);
  }
  return is_null(xs);
}

/**
 * returns vector that contains the elements of the argument list
 * in the given order.\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a list
 */
export function list_to_vector<T>(lst: List<T>): T[] {
  const vector: T[] = [];
  for_each(each => vector.push(each), lst);
  return vector;
}

/**
 * returns a list that contains the elements of the argument vector
 * in the given order\
 * LOW-LEVEL FUNCTION, NOT SOURCE
 * @throws an exception if the argument is not a vector
 */
export function vector_to_list<T>(vector: T[]): List<T> {
  return list(...vector);
}

/**
 * Accumulate applies given operation op to elements of a list
 * in a right-to-left order, first apply op to the last element
 * and an initial element, resulting in r1, then to the second-last
 * element and r1, resulting in r2, etc, and finally to the first element
 * and r_n-1, where n is the length of the list. `accumulate(op,zero,list(1,2,3))`
 * results in `op(1, op(2, op(3, zero)))`
 */
export function accumulate<T, U>(op: (each: T, result: U) => U, initial: U, sequence: List<T>): U {
  // Use CPS to prevent stack overflow
  function $accumulate(xs: typeof sequence, cont: (each: U) => U): U {
    return is_null(xs) ? cont(initial) : $accumulate(tail(xs), x => cont(op(head(xs), x)));
  }
  return $accumulate(sequence, x => x);
}

/**
 * Appends the list `ys` to the end of list `xs` and returns the
 * resulting list
 */
export function append<T>(xs: List<T>, ys: List<T>): List<T> {
  function $append(xs: List<T>, ys: List<T>, cont: (res: List<T>) => List<T>): List<T> {
    return is_null(xs) ? cont(ys) : $append(tail(xs), ys, zs => cont(pair(head(xs), zs)));
  }

  return $append(xs, ys, xs => xs);
}

/**
 * Takes a unary function `f` and a non-negative integer `n`. Returns the list
 * of `n` elements that results from applying `f` to the numbers from 0 to `n-1`.
 */
export function build_list<T>(f: (arg: number) => T, n: number): List<T> {
  assertNumberWithinRange(n, build_list.name, 0);
  assertFunctionOfLength(f, 1, build_list.name);

  function $build_list(i: number, already_built: List<T>): List<T> {
    return i < 0 ? already_built : $build_list(i - 1, pair(f(i), already_built));
  }

  return $build_list(n - 1, null);
}

/**
 * Takes two numbers, `start` and `end` and returns the list containing numbers between `start` and `end`,
 * beginning with `start` and then incrementing by 1 until the value exceeds `end`.
 */
export function enum_list(start: number, end: number): List<number> {
  assertNumberWithinRange(start, { func_name: enum_list.name, param_name: 'start', integer: false });
  assertNumberWithinRange(end, enum_list.name, start, undefined, false, 'end');

  return build_list(x => x + start, Math.floor(end - start) + 1);
}

/**
 * Returns a new list that only contains elements that the predicate function returned `true`
 * for
 */
export function filter<T, U extends T>(pred: (arg: T) => arg is U, xs: List<T>): List<U>;
export function filter<T>(pred: (arg: T) => boolean, xs: List<T>): List<T>;
export function filter<T>(pred: (arg: T) => boolean, xs: List<T>): List<T> {
  return accumulate((each, result) => (pred(each) ? pair(each, result) : result), list(), xs);
}

/**
 * Applies the provided function to each element in the list. Returns `true`.
 */
export function for_each<T>(op: (arg: T) => void, xs: List<T>): true {
  if (is_null(xs)) return true;
  op(head(xs));
  return for_each(op, tail(xs));
}

/**
 * returns the length of a List xs. Throws an exception if xs is not a List
 */
export function length(xs: unknown): number {
  if (!is_list(xs)) {
    throw new InvalidParameterTypeError('list', xs, length.name);
  }

  return accumulate((_, total) => total + 1, 0, xs);
}

/**
 * Returns the element at the `n`th index in the provided list
 */
export function list_ref<T>(xs: List<T>, n: number) {
  if (is_null(xs)) {
    throw new GeneralRuntimeError(`${list_ref.name}: Index ${n} is out of bounds.`);
  }

  let res: NonEmptyList<T> = xs;
  let i = n;
  while (i > 0) {
    const temp = tail(res);

    if (is_null(temp)) {
      throw new GeneralRuntimeError(`${list_ref.name}: Index ${n} is out of bounds.`);
    }

    res = temp;
    i--;
  }

  return head(res);
}

/**
 * Calls the provided function on each element of the provided list, and returns
 * a new list containing the results
 */
export function map<T, U>(op: (each: T) => U, sequence: List<T>): List<U> {
  return accumulate((each, result) => pair(op(each), result), list(), sequence);
}

/**
 * Returns the first postfix sublist that starts with the given element `v`. If
 * the element is not in `xs`, returns an empty list.
 */
export function member<T>(v: T, xs: List<T>): List<T> {
  return is_null(xs)
         ? null
	 : v === head(xs)
	 ? xs
	 : member(v, tail(xs));
}

/**
 * Removes the first instance of `v` in the given List `xs`.
 */
export function remove<T>(v: T, xs: List<T>): List<T> {
  if (is_null(xs)) return xs;

  const current = head(xs);
  if (current === v) return tail(xs);

  return pair(head(xs), remove(v, tail(xs)));
}

/**
 * Removes all instances of `v` from the given list `xs`.
 */
export function remove_all<T>(v: T, xs: List<T>): List<T> {
  return filter(x => x !== v, xs);
}

/**
 * Reverses the given list `xs`.
 */
export function reverse<T>(xs: List<T>): List<T> {
  function $reverse(original: List<T>, reversed: List<T>): List<T> {
    return is_null(original)
      ? reversed
      : $reverse(tail(original), pair(head(original), reversed));
  }

  return $reverse(xs, null);
}

export function rawDisplayList(
  display: (v: Value, ...s: string[]) => Value,
  xs: Value,
  prepend: string,
) {
  const visited: Set<Value> = new Set(); // Everything is put into this set, values, arrays, and even objects if they exist
  const asListObjects: Map<NonEmptyList<Value>, NonEmptyList<Value> | ListObject> = new Map(); // maps original list nodes to new list nodes

  // We will convert list-like structures in xs to ListObject.
  class ListObject implements ArrayLike {
    replPrefix = 'list(';
    replSuffix = ')';
    replArrayContents(): Value[] {
      return list_to_vector(this.listNode);
    }

    constructor(readonly listNode: NonEmptyList<Value>) {}
  }
  function getListObject(curXs: Value): Value {
    return asListObjects.get(curXs) || curXs;
  }

  const pairsToProcess: Value[] = [xs];
  // we need the guarantee that if there are any proper lists,
  // then the nodes of the proper list appear as a subsequence of this array.
  // We ensure this by always adding the tail after the current node is processed.
  // This means that sometimes, we add the same pair more than once!
  // But because we only process each pair once due to the visited check,
  // and each pair can only contribute to at most 3 items in this array,
  // this array has O(n) elements.
  for (let i = 0; i < pairsToProcess.length; i++) {
    const curXs = pairsToProcess[i];
    if (visited.has(curXs)) {
      continue;
    }
    visited.add(curXs);
    if (!is_pair(curXs)) {
      continue;
    }
    pairsToProcess.push(head(curXs), tail(curXs));
  }

  function isListObject(x: Value): x is NonEmptyList<Value> {
    return asListObjects.has(x);
  }

  // go through pairs in reverse to ensure the dependencies are resolved first
  while (pairsToProcess.length > 0) {
    const curXs = pairsToProcess.pop();
    if (!is_pair(curXs)) {
      continue;
    }
    const h = head(curXs);
    const t = tail(curXs);

    let newXs: Value;
    if (isListObject(t)) {
      const newTail = asListObjects.get(t)!;
      newXs =
        is_null(newTail) || newTail instanceof ListObject ? new ListObject(pair(h, t)) : pair(h, t);
    } else {
      newXs = is_null(t) ? new ListObject(pair(h, t)) : pair(h, t);
    }

    // @ts-ignore
    asListObjects.set(curXs, newXs);
  }

  for (const curXs of asListObjects.values()) {
    if (is_pair(curXs)) {
      set_head(curXs, getListObject(head(curXs)));
      set_tail(curXs, getListObject(tail(curXs)));
    } else if (curXs instanceof ListObject) {
      set_head(curXs.listNode, getListObject(head(curXs.listNode)));
      let newTail = getListObject(tail(curXs.listNode));
      if (newTail instanceof ListObject) {
        newTail = newTail.listNode;
      }
      set_tail(curXs.listNode, newTail);
    }
  }
  display(getListObject(xs), prepend);
  return xs;
}
