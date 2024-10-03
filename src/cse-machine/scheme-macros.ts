import * as es from 'estree'

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
