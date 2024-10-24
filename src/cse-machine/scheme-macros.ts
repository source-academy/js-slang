import * as es from 'estree'
import { List } from '../stdlib/list'
import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import { SchemeNumber } from '../alt-langs/scheme/scm-slang/src/stdlib/core-math'
import { Context } from '..'
import { Control, Stash } from './interpreter'
import { getVariable } from './utils'

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

// helper function to check if a value is a list.
function isList(value: any): boolean {
  if (value === null) {
    return true
  }
  return Array.isArray(value) && value.length === 2 && isList(value[1])
}

// do a 1-level deep flattening of a list.
function flattenList(value: any): any[] {
  if (value === null) {
    return []
  }
  return [value[0], ...flattenList(value[1])]
}

export function schemeEval(
  command: SchemeControlItems,
  context: Context,
  control: Control,
  stash: Stash,
  isPrelude: boolean
) {
  // scheme CSE machine will only ever encounter
  // lists or primitives like symbols, booleans or strings.
  // if its a list, we can parse the list and evaluate each item as necessary
  // if its a symbol, we can look up the symbol in the environment.
  // for either of these operations, if our list matches some pattern in
  // the P component, then we can apply the corresponding rule.

  // if its a number, boolean, or string, we can just shift the value
  // onto the stash.

  if (command === null) {
    // TODO: error
    return
  }
  
  if (isList(command)) {
    // do something
    const parsedList = flattenList(command)
    // do work based on the first element of the list.
    // it should match some symbol "define", "set", "lambda", etc...
    // or if it doesn't match any of these, then it is a function call.
    if (parsedList[0] instanceof _Symbol) {
      // we attempt to piggyback on the standard CSE machine to 
      // handle the basic special forms.
      // however, for more advanced stuff like quotes or definitions,
      // the logic will be handled here.
      switch (parsedList[0].sym) {
        case 'lambda':
          // do something
        case 'define':
          // assume that define-function
          // has been resolved to define-variable
          // (P component will deal with this)
          // at this point, parser enforces that variable
          // is a symbol
          const variable = parsedList[1]
          const value = parsedList[2]
          // estree VariableDeclaration
          const definition = {
            type: 'VariableDeclaration',
            kind: 'let',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: makeDummyIdentifierNode(variable.sym),
                init: value
              }
            ]
          }

          control.push(definition as es.VariableDeclaration)
        case 'set!':
          const set_variable = parsedList[1]
          const set_value = parsedList[2]

          // estree AssignmentExpression
          const assignment = {
            type: 'AssignmentExpression',
            operator: '=',
            left: makeDummyIdentifierNode(set_variable.sym),
            right: set_value
          }

          control.push(assignment as es.AssignmentExpression)
        case 'if':
          const condition = parsedList[1]
          const consequent = parsedList[2]
          // check if there is an alternate
          const alternate = parsedList[3] ? parsedList[3] : null

          // estree ConditionalExpression
          const conditional = {
            type: 'ConditionalExpression',
            test: condition,
            consequent,
            alternate
          }

          control.push(conditional as es.ConditionalExpression)
        case 'begin':
          // begin is a sequence of expressions
          // that are evaluated in order.
          // we can just push the expressions to the control.
          for (let i = 1; i < parsedList.length; i++) {
            control.push(parsedList[i])
          }

        case "quote":
          // TODO
        case "quasiquote":
          // hey, we can deal with unquote-splicing here!
          // TODO
        case "define-syntax":
          // parse the pattern and template here,
          // and add it to the Patterns component.
          // TODO
      }
      return
    }
    // if we get to this point, then it is a function call.
    // convert it into an es.CallExpression and push it to the control.
    const procedure = parsedList[0]
    const args = parsedList.slice(1)
    const appln = {
      type: 'CallExpression',
      optional: false,
      callee: procedure,
      arguments: args
    }
    control.push(appln as es.CallExpression)
    return
  } else if (command instanceof _Symbol) {
    // do something else
    stash.push(getVariable(context, command.sym, makeDummyIdentifierNode(command.sym)))
    return
  }
  // if we get to this point of execution, it is just some primitive value.
  // just push it to the stash.
  stash.push(command)
  return
}

export function makeDummyIdentifierNode(name: string): es.Identifier {
  return {
    type: 'Identifier',
    name
  }
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
