type TupleOfLengthHelper<T extends number, U, V extends U[] = []> = V['length'] extends T
  ? V
  : TupleOfLengthHelper<T, U, [...V, U]>;

/**
 * Utility type that represents a tuple of a specific length
 */
export type TupleOfLength<T extends number, U = unknown> = TupleOfLengthHelper<T, U>;

/**
 * Given the number of required and optional elements, evaluates to true if the specified tuple
 * indeed has the specified number of elements, false otherwise.
 */
type CheckTupleHelper<
  T extends any[],
  OptArgs extends number,
  OptionalElements extends any[],
> = T extends []
  ? OptionalElements['length'] extends OptArgs
    ? true
    : false
  : Partial<T> extends T
    ? CheckTupleHelper<[], OptArgs, Required<T>>
    : T extends [any, ...infer Rest]
      ? CheckTupleHelper<Rest, OptArgs, []>
      : never;

/**
 * Given the number of required and optional
 * parameters, determine if the provided function
 * type has the correct signature
 */
export type HasCorrectParameters<
  T extends (...args: any[]) => any,
  OptArgs extends number | true,
> = OptArgs extends number
  ? number extends Parameters<T>['length']
    ? never
    : CheckTupleHelper<Parameters<T>, OptArgs, []> extends true
      ? T
      : never
  : number extends Parameters<T>['length']
    ? T
    : never;

/**
 * Helper type to recursively make properties that are also objects
 * partial
 *
 * By default, `Partial<Array<T>>` is equivalent to `Array<T | undefined>`. For this type, `Array<T>` will be
 * transformed to Array<Partial<T>> instead
 */
export type RecursivePartial<T> =
  T extends Array<any>
    ? Array<RecursivePartial<T[number]>>
    : // to records?
      T extends (...args: any[]) => any
      ? T
      : T extends Record<any, any>
        ? Partial<{
            [K in keyof T]: RecursivePartial<T[K]>;
          }>
        : T;
