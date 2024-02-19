import * as es from 'estree'

import { Environment } from '../types'
import { Control, Stash } from './interpreter'

/**
 * A dummy function used to detect for the call/cc function object.
 * If the interpreter sees this specific object, a continuation at the current
 * point of evaluation is executed instead of a regular function call.
 */

export function call_with_current_continuation(f: any) {
  return f()
}

/**
 * An object representing a continuation of the ECE machine.
 * Used to enable first-class continuations for scm-slang.
 * When instantiated, it copies the control and stack, but pops 2 items from its (the continuation's) stack.
 * This pops the continuation itself, and the call to the lambda using the continuation.
 * It also takes in the current environment (plus history of environments) at the point of capture.
 * BUT as a shallow copy (top level array is separate, but point to the same
 * environment frames)
 */

export class Continuation {
  control: Control
  stash: Stash
  envs: Environment[]
  public constructor(control: Control, stash: Stash, envs: Environment[]) {
    this.control = control.copy()
    this.stash = stash.copy()
    this.envs = [...envs]
  }
}

export function wrapContinuation(c: Continuation): Function {
  const fn = (x: any) => x
  fn.continuation = c
  return fn
}

export function unwrapContinuation(f: Function): Continuation {
  return (f as any).continuation
}

export function isWrappedContinuation(f: Function): boolean {
  return 'continuation' in f
}

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
