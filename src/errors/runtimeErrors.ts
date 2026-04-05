import type { BaseNode } from 'estree'
import { stringify } from '../utils/stringify'
import { SourceErrorWithNode, ErrorType, ErrorSeverity } from './base'

/**
 * Abstract Source Error class for Runtime errors
 */
export abstract class RuntimeSourceError<
  T extends BaseNode | undefined
> extends SourceErrorWithNode<T> {
  type = ErrorType.RUNTIME
  severity = ErrorSeverity.ERROR
}

/**
 * A concrete instantiation of {@link RuntimeSourceError} that can
 * be used when there just aren't any other good Source error classes that can be used
 */
export class GeneralRuntimeError extends RuntimeSourceError<BaseNode | undefined> {
  constructor(
    private readonly explanation: string,
    node?: BaseNode,
    private readonly elaboration?: string
  ) {
    super(node)
  }

  public override explain() {
    return this.explanation
  }

  public override elaborate(): string {
    return this.elaboration ?? this.explanation
  }
}

/**
 * A subclass of {@link RuntimeSourceError} intended for use when an unexpected runtime error
 * occurs due to an internal error rather than any error caused by the code being evaluated.
 */
export class InternalRuntimeError extends RuntimeSourceError<BaseNode | undefined> {
  constructor(
    private readonly explanation: string,
    node?: BaseNode,
    private readonly elaboration?: string
  ) {
    super(node)
  }

  public override explain() {
    return this.explanation
  }

  public override elaborate(): string {
    return this.elaboration ?? this.explanation
  }
}

/**
 * A specific {@link GeneralRuntimeError} that is thrown when a function receives a parameter of the wrong type.
 *
 * @example
 * ```
 * function play_sound(sound: unknown): asserts sound is Sound {
 *   if (!is_sound(sound)) {
 *     throw new InvalidParameterTypeError('Sound', sound, play_sound.name, 'sound');
 *   }
 * }
 * ```
 */
export class InvalidParameterTypeError extends GeneralRuntimeError {
  constructor(
    /**
     * String representation of the expected type. Examples include "number", "string", or "Point".
     */
    public readonly expectedType: string,

    /**
     * The actual value that was received.
     */
    public readonly actualValue: unknown,

    /**
     * The name of the function that received the invalid parameter.
     */
    public readonly func_name: string,

    /**
     * The name of the parameter that received the invalid value, if available.
     */
    public readonly param_name?: string,
    node?: BaseNode
  ) {
    const paramString = param_name ? ` for ${param_name}` : ''
    const explanation = `${func_name}: Expected ${expectedType}${paramString}, got ${stringify(actualValue)}.`
    super(explanation, node)
  }

  public override get message() {
    return this.explain()
  }

  public override toString() {
    return this.explain()
  }
}

/**
 * A subclass of the {@link InvalidParameterTypeError} that is thrown when a function receives a callback parameter
 * that is not a function or does not have the expected number of parameters.
 *
 * @example
 * ```
 * function call_callback(callback: (x: number, y: number) => number) {
 *   if (!isFunctionOfLength(callback, 2)) {
 *     throw new InvalidCallbackError(2, callback, call_callback.name, 'callback');
 *   }
 * }
 * ```
 */
export class InvalidCallbackError extends InvalidParameterTypeError {
  constructor(
    /**
     * Either the expected number of parameters of the callback function, or a string describing the expected callback type.
     */
    expected: number | string,
    actualValue: unknown,
    func_name: string,
    param_name?: string,
    node?: BaseNode
  ) {
    const expectedStr =
      typeof expected === 'number'
        ? `function with ${expected} parameter${expected !== 1 ? 's' : ''}`
        : expected
    super(expectedStr, actualValue, func_name, param_name, node)
  }
}

export interface InvalidNumberParameterErrorOptions {
  /**
   * Maximum allowable value (inclusive). Set to `undefined` to not perform a maximum check.
   */
  max?: number

  /**
   * Minimum allowable value (inclusive). Set to `undefined` to not perform a minimum check.
   */
  min?: number

  /**
   * `true` by default. Set to `false` to allow non integer values
   */
  integer?: boolean
}

/**
 * Subclass of {@link InvalidParameterTypeError} intended for
 * use with numeric values
 */
export class InvalidNumberParameterError extends InvalidParameterTypeError {
  constructor(
    value: unknown,
    options: InvalidNumberParameterErrorOptions | string,
    func_name: string,
    param_name?: string,
    node?: BaseNode
  ) {
    let expectedStr: string

    if (typeof options === 'string') {
      expectedStr = options
    } else {
      const { max, min, integer = true } = options
      const typeStr = integer ? 'integer' : 'number'

      if (max !== undefined) {
        expectedStr =
          min === undefined ? `${typeStr} less than ${max}` : `${typeStr} between ${min} and ${max}`
      } else {
        expectedStr = min === undefined ? typeStr : `${typeStr} greater than ${min}`
      }
    }

    super(expectedStr, value, func_name, param_name, node)
  }
}
