import * as es from 'estree'

import { Context, Environment } from '../types'
import { Control, Stash, Transformers } from './interpreter'
import { uniqueId } from './utils'

/**
 * A dummy function used to detect for the apply function object.
 * If the interpreter sees this specific function, it applies the function
 * with the given arguments to apply.
 *
 * We need this to be a metaprocedure so that it can properly handle
 * the arguments passed to it, even if they are continuations.
 */
export class Apply extends Function {
  private static instance: Apply = new Apply()

  private constructor() {
    super()
  }

  public static get(): Apply {
    return Apply.instance
  }

  public toString(): string {
    return 'apply'
  }
}

export const apply = Apply.get()

export function isApply(value: any): boolean {
  return value === apply
}

/**
 * A dummy function used to detect for the call/cc function object.
 * If the interpreter sees this specific function, a continuation at the current
 * point of evaluation is executed instead of a regular function call.
 */
export class Call_cc extends Function {
  private static instance: Call_cc = new Call_cc()

  private constructor() {
    super()
  }

  public static get(): Call_cc {
    return Call_cc.instance
  }

  public toString(): string {
    return 'call/cc'
  }
}

export const call_with_current_continuation = Call_cc.get()

export function isCallWithCurrentContinuation(value: any): boolean {
  return value === call_with_current_continuation
}

/**
 * An object representing a continuation of the CSE machine.
 * When instantiated, it copies the control stack, and
 * current environment at the point of capture.
 *
 * Continuations and functions are treated as the same by
 * the typechecker so that they can be first-class values.
 */
export class Continuation extends Function {
  private control: Control
  private stash: Stash
  private env: Environment[]
  private transformers: Transformers

  /** Unique ID defined for continuation */
  public readonly id: string

  constructor(
    context: Context,
    control: Control,
    stash: Stash,
    env: Environment[],
    transformers: Transformers
  ) {
    super()
    this.control = control.copy()
    this.stash = stash.copy()
    this.env = [...env]
    this.transformers = transformers
    this.id = uniqueId(context)
  }

  // As the continuation needs to be immutable (we can call it several times)
  // we need to copy its elements whenever we access them
  public getControl(): Control {
    return this.control.copy()
  }

  public getStash(): Stash {
    return this.stash.copy()
  }

  public getEnv(): Environment[] {
    return [...this.env]
  }

  public getTransformers(): Transformers {
    return this.transformers
  }

  public toString(): string {
    return 'continuation'
  }

  public equals(other: Continuation): boolean {
    return this === other
  }
}

/**
 * Provides an adequate representation of what calling
 * call/cc or continuations looks like, to give to the
 * APPLICATION instruction.
 */
export function makeDummyContCallExpression(callee: string, argument: string): es.CallExpression {
  return {
    type: 'CallExpression',
    optional: false,
    callee: {
      type: 'Identifier',
      name: callee
    },
    arguments: [
      {
        type: 'Identifier',
        name: argument
      }
    ]
  }
}
