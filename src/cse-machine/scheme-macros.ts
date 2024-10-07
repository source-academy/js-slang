import * as es from 'estree'
import { List } from '../stdlib/list'
import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import { SchemeNumber } from '../alt-langs/scheme/scm-slang/src/stdlib/core-math'
import { Context } from '..'
import { Control, Stash } from './interpreter'

// this needs to be better but for now it's fine
export type SchemeControlItems = List | _Symbol | SchemeNumber | boolean | string

/**
 * A metaprocedure used to detect for the eval function object.
 * If the interpreter sees this specific function,
 */
export class Eval extends Function {
  private static instance: Eval = new Eval()

  private constructor() {
    super()
  }

  public static get(): Eval {
    return Eval.instance
  }

  public toString(): string {
    return 'eval'
  }
}

export const csep_eval = Eval.get()

export function isEval(value: any): boolean {
  return value === csep_eval
}

export function schemeEval(
  command: SchemeControlItems,
  context: Context,
  control: Control,
  stash: Stash,
  isPrelude: boolean
) {
  // do absolutely nothing for now
}

/**
 * Provides an adequate representation of what calling
 * eval looks like, to give to the
 * APPLICATION instruction.
 */
export function makeDummyEvalExpression(callee: string, argument: string): es.CallExpression {
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
