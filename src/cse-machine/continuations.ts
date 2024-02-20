import * as es from 'estree'

import { Environment } from '../types'
import { Control, Stash } from './interpreter'

/**
 * A dummy function used to detect for the call/cc function object.
 * If the interpreter sees this specific function, a continuation at the current
 * point of evaluation is executed instead of a regular function call.
 */

export function call_with_current_continuation(f: any): any {
  return f()
}

/**
 * Checks if the function refers to the designated function object call/cc.
 */
export function isCallWithCurrentContinuation(f: Function): boolean {
  return f === call_with_current_continuation
}

/**
 * An object representing a continuation of the ECE machine.
 * When instantiated, it copies the control stack, and
 * current environment at the point of capture.
 *
 * Continuations and functions are treated as the same by
 * the typechecker so that they can be first-class values.
 */
export interface Continuation extends Function {
  control: Control
  stash: Stash
  env: Environment[]
}

// As the continuation needs to be immutable (we can call it several times)
// we need to copy its elements whenever we access them
export function getContinuationControl(cn: Continuation): Control {
  return cn.control.copy()
}

export function getContinuationStash(cn: Continuation): Stash {
  return cn.stash.copy()
}

export function getContinuationEnv(cn: Continuation): Environment[] {
  return [...cn.env]
}

export function makeContinuation(control: Control, stash: Stash, env: Environment[]): Function {
  // Cast a function into a continuation
  const fn: any = (x: any) => x
  const cn: Continuation = fn as Continuation

  // Set the control, stash and environment
  // as shallow copies of the given program equivalents
  cn.control = control.copy()
  cn.stash = stash.copy()
  cn.env = [...env]

  // Return the continuation as a function so that
  // the type checker allows it to be called
  return cn as Function
}

/**
 * Checks whether a given function is actually a continuation.
 */
export function isContinuation(f: Function): f is Continuation {
  return 'control' in f && 'stash' in f && 'env' in f
}

/**
 * Provides an adequate representation of what calling
 * call/cc or continuations looks like, to give to the
 * GENERATE_CONT and RESUME_CONT instructions.
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
