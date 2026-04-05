import { TimeoutError } from '../errors/timeoutErrors'
import type { Node } from '../types'
import { Chapter } from '../langs'
import {
  InvalidCallbackError,
  InvalidNumberParameterError,
  InvalidNumberParameterErrorOptions
} from '../errors/runtimeErrors'

export class PromiseTimeoutError extends TimeoutError {
  public override explain() {
    return 'An internal operation timed out while executing.'
  }

  public override elaborate() {
    return this.explain()
  }
}

export const timeoutPromise = <T>(promise: Promise<T>, timeout: number, node?: Node) =>
  new Promise<T>((resolve, reject) => {
    const timeoutid = setTimeout(() => reject(new PromiseTimeoutError(node)), timeout)

    promise
      .then(res => {
        clearTimeout(timeoutid)
        resolve(res)
      })
      .catch(e => {
        clearTimeout(timeoutid)
        reject(e)
      })
  })

/**
 * Run the mapping function over the items, filtering out any items that
 * that the mapping function returned `undefined` for
 */
export function mapAndFilter<T, U>(items: T[], mapper: (input: T) => U | undefined) {
  return items.reduce((res, item) => {
    const newItem = mapper(item)
    if (newItem !== undefined) return [...res, newItem]
    return res
  }, [] as U[])
}

/**
 * Type safe `Object.keys`
 */
export function objectKeys<T extends string | number | symbol>(obj: Record<T, any>): T[] {
  return Object.keys(obj) as T[]
}

/**
 * Given the chapter value, return the string name of that chapter
 */
export function getChapterName(chapter: Chapter) {
  return objectKeys(Chapter).find(name => Chapter[name] === chapter)!
}

type TupleOfLengthHelper<T extends number, U, V extends U[] = []> = V['length'] extends T
  ? V
  : TupleOfLengthHelper<T, U, [...V, U]>

/**
 * Utility type that represents a tuple of a specific length
 */
export type TupleOfLength<T extends number, U = unknown> = TupleOfLengthHelper<T, U>

/**
 * Type guard for checking that the provided value is a function and that it has the specified number of parameters.
 * Of course at runtime parameter types are not checked, so this is only useful when combined with TypeScript types.
 */
export function isFunctionOfLength<T extends (...args: any[]) => any>(
  f: (...args: any) => any,
  l: Parameters<T>['length']
): f is T
export function isFunctionOfLength<T extends number>(
  f: unknown,
  l: T
): f is (...args: TupleOfLength<T>) => unknown
export function isFunctionOfLength(f: unknown, l: number) {
  // TODO: Need a variation for rest parameters
  return typeof f === 'function' && f.length === l
}

/**
 * Assertion version of {@link isFunctionOfLength}
 *
 * @param f Value to validate
 * @param l Number of parameters that `f` is expected to have
 * @param func_name Function within which the validation is occurring
 * @param type_name Optional alias for the function type
 * @param param_name Name of the parameter that's being validated
 */
export function assertFunctionOfLength<T extends (...args: any[]) => any>(
  f: (...args: any) => any,
  l: Parameters<T>['length'],
  func_name: string,
  type_name?: string,
  param_name?: string
): asserts f is T
export function assertFunctionOfLength<T extends number>(
  f: unknown,
  l: T,
  func_name: string,
  type_name?: string,
  param_name?: string
): asserts f is (...args: TupleOfLength<T>) => unknown
export function assertFunctionOfLength(
  f: unknown,
  l: number,
  func_name: string,
  type_name?: string,
  param_name?: string
) {
  if (!isFunctionOfLength(f, l)) {
    throw new InvalidCallbackError(type_name ?? l, f, func_name, param_name)
  }
}

/**
 * Function for checking if a given value is a number and that it also potentially satisfies a bunch of other criteria:
 * - Within a given range of [min, max]
 * - Is an integer
 * - Is not NaN
 */
export function isNumberWithinRange(
  value: unknown,
  min?: number,
  max?: number,
  integer?: boolean
): value is number
export function isNumberWithinRange(
  value: unknown,
  options: InvalidNumberParameterErrorOptions
): value is number
export function isNumberWithinRange(
  value: unknown,
  arg0?: InvalidNumberParameterErrorOptions | number,
  max?: number,
  integer: boolean = true
): value is number {
  let options: InvalidNumberParameterErrorOptions

  if (typeof arg0 === 'number' || typeof arg0 === 'undefined') {
    options = {
      min: arg0,
      max,
      integer
    }
  } else {
    options = arg0
    options.integer = arg0.integer ?? true
  }

  if (typeof value !== 'number' || Number.isNaN(value)) return false

  if (options.max !== undefined && value > options.max) return false
  if (options.min !== undefined && value < options.min) return false

  return !options.integer || Number.isInteger(value)
}

interface AssertNumberWithinRangeOptions extends InvalidNumberParameterErrorOptions {
  func_name: string
  param_name?: string
}

/**
 * Assertion version of {@link isNumberWithinRange}
 */
export function assertNumberWithinRange(
  value: unknown,
  func_name: string,
  min?: number,
  max?: number,
  integer?: boolean,
  param_name?: string
): asserts value is number
export function assertNumberWithinRange(
  value: unknown,
  options: AssertNumberWithinRangeOptions
): asserts value is number
export function assertNumberWithinRange(
  value: unknown,
  arg0: AssertNumberWithinRangeOptions | string,
  min?: number,
  max?: number,
  integer?: boolean,
  param_name?: string
): asserts value is number {
  let options: AssertNumberWithinRangeOptions

  if (typeof arg0 === 'string') {
    options = {
      func_name: arg0,
      min,
      max,
      integer: integer ?? true,
      param_name
    }
  } else {
    options = arg0
  }

  if (!isNumberWithinRange(value, options)) {
    throw new InvalidNumberParameterError(value, options, options.func_name, options.param_name)
  }
}
