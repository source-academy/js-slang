import * as es from 'estree'

import { Environment } from '../types'
import { Control, Stash } from './interpreter'

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

  constructor(control: Control, stash: Stash, env: Environment[]) {
    super()
    this.control = control.copy()
    this.stash = stash.copy()
    this.env = [...env]
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

  public toString(): string {
    return 'continuation'
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
