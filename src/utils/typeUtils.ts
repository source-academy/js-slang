type TupleOfLengthHelper<T extends number, U, V extends U[] = []> = V['length'] extends T
  ? V
  : TupleOfLengthHelper<T, U, [...V, U]>;

/**
 * Utility type that represents a tuple of a specific length
 */
export type TupleOfLength<T extends number, U = unknown> = TupleOfLengthHelper<T, U>;

/**
 * Checks that the given provided tuple T has at least MinArgs arguments
 * before a rest element
 */
export type CheckRestTuple<T extends any[], MinArgs extends number, V extends any[] = []> =
  T extends [infer First, ...infer Rest]
    ? CheckRestTuple<Rest, MinArgs, [First, ...V]>
    : number extends T['length']
      ? V['length'] extends MinArgs
        ? true
        : false
      : false;

/**
 * Given the number of required and optional elements, evaluates to true if the specified tuple
 * indeed has the specified number of elements, false otherwise.
 */
type CheckTupleHelper<
  T extends any[],
  ReqArgs extends number,
  OptArgs extends number,
  RequiredElements extends any[],
  OptionalElements extends any[]
> = 
  T extends []
    ? RequiredElements['length'] extends ReqArgs
      ? OptionalElements['length'] extends OptArgs
        ? true
        : false
      : false
    : Partial<T> extends T
      ? CheckTupleHelper<[], ReqArgs, OptArgs, RequiredElements, Required<T>>
      : T extends [infer First, ...infer Rest]
        ? CheckTupleHelper<Rest, ReqArgs, OptArgs, [First, ...RequiredElements], []>
        : never

/**
 * Given the number of required and optional
 * parameters, determine if the provided function
 * type has the correct signature
 */
export type HasCorrectParameters<
  T extends (...args: any[]) => any,
  ReqArgs extends number,
  OptArgs extends number | true
> = OptArgs extends number
  ? number extends Parameters<T>['length']
    ? never
    : CheckTupleHelper<Parameters<T>, ReqArgs, OptArgs, [], []> extends true ? T : never
  : CheckRestTuple<Parameters<T>, ReqArgs> extends true ? T : never
