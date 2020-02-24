/**
 * Type definitions for lazy evaluation, as well as
 * builtin functions for lazy evaluation
 */

export type Thunk<T> = () => T;

export type LazyNullary<T> = () => Thunk<T>;

export type LazyUnary<T, R> = (x: T) => Thunk<R>;

export type LazyBinary<T, U, R> = (x: T, y: U) => Thunk<R>;

export type LazyTertiary<T, U, V, R> = (x: T, y: U, z: V) => Thunk<R>;

export function force<T>(expression: Thunk<T>) {
    return expression();
}