import * as es from 'estree'
import { List } from '../stdlib/list'
import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import { SchemeNumber } from '../alt-langs/scheme/scm-slang/src/stdlib/core-math'
import { Context } from '..'
import { Control, Pattern, Stash } from './interpreter'
import { getVariable } from './utils'
import {
  Transformer,
  arrayToList,
  flattenImproperList,
  isImproperList,
  macro_transform,
  match
} from './patterns'
import { ControlItem } from './types'
import { encode } from '../alt-langs/scheme/scm-slang/src'

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
export function isList(value: any): boolean {
  if (value === null) {
    return true
  }
  return Array.isArray(value) && value.length === 2 && isList(value[1])
}

// do a 1-level deep flattening of a list.
export function flattenList(value: any): any[] {
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
  patterns: Pattern,
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
    // error
    return
  }

  if (isList(command)) {
    // do something
    const parsedList = flattenList(command)
    const elem = parsedList[0]
    // do work based on the first element of the list.
    // it should match some symbol "define", "set", "lambda", etc...
    // or if it doesn't match any of these, then it is a function call.
    if (elem instanceof _Symbol) {
      // check if elem matches any defined syntax in the P component.
      // if it does, then apply the corresponding rule.
      if (patterns.hasPattern(elem.sym)) {
        // get the relevant transformers
        const transformers: Transformer[] = patterns.getPattern(elem.sym)

        // find the first matching transformer
        for (const transformer of transformers) {
          // check if the transformer matches the list
          if (match(command, transformer.pattern, transformer.literals)) {
            // if it does, apply the transformer
            const transformedMacro = macro_transform(command as List, transformer)
            control.push(transformedMacro as ControlItem)
            return
          }
        }

        // there is an error if we get to here
        // TODO
        return
      }

      // else, this is a standard special form.
      // we attempt to piggyback on the standard CSE machine to
      // handle the basic special forms.
      // however, for more advanced stuff like quotes or definitions,
      // the logic will be handled here.
      switch (parsedList[0].sym) {
        case 'lambda':
          // return a lambda expression that takes
          // in the arguments, and returns the body
          // as an eval of the body.
          const args = parsedList[1]

          let argsList: _Symbol[] = []
          let rest: _Symbol | null = null
          if (args instanceof _Symbol) {
            // if the args is a symbol, then it is a variadic function.
            // we can just set the args to a list of the symbol.
            rest = args
          } else if (isImproperList(args)) {
            ;[argsList, rest] = flattenImproperList(args)
          } else {
            argsList = flattenList(args) as _Symbol[]
          }

          // convert the args to estree pattern
          const params: (es.Identifier | es.RestElement)[] = argsList.map(arg =>
            makeDummyIdentifierNode(arg.sym)
          )

          let body_elements = parsedList.slice(2)
          let body: List = arrayToList([new _Symbol('begin'), ...body_elements])

          // if there is a rest argument, we need to wrap it in a rest element.
          // we also need to add another element to the body,
          // to convert the rest element into a list.
          if (rest !== null) {
            params.push({
              type: 'RestElement',
              argument: makeDummyIdentifierNode(rest.sym)
            })
            body = arrayToList([
              new _Symbol('begin'),
              arrayToList([
                new _Symbol('set!'),
                rest,
                arrayToList([new _Symbol('vector->list'), rest])
              ]),
              ...body_elements
            ])
          }

          // estree ArrowFunctionExpression
          const lambda = {
            type: 'ArrowFunctionExpression',
            params: params,
            body: body as any
          }

          control.push(lambda as es.ArrowFunctionExpression)
          return

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
                id: makeDummyIdentifierNode(encode(variable.sym)),
                init: value
              }
            ]
          }

          control.push(definition as es.VariableDeclaration)
          return
        case 'set!':
          const set_variable = parsedList[1]
          const set_value = parsedList[2]

          // estree AssignmentExpression
          const assignment = {
            type: 'AssignmentExpression',
            operator: '=',
            left: makeDummyIdentifierNode(encode(set_variable.sym)),
            right: set_value
          }

          control.push(assignment as es.AssignmentExpression)
          return
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
          return
        case 'begin':
          // begin is a sequence of expressions
          // that are evaluated in order.
          // push the expressions to the control in reverse
          for (let i = parsedList.length - 1; i > 0; i--) {
            control.push(parsedList[i])
          }
          return
        case 'quote':
          // quote is a special form that returns the expression
          // as is, without evaluating it.
          // we can just push the expression to the stash.
          stash.push(parsedList[1])
          return
        /*
        quasiquote can be represented using
        macros!

        (define-syntax quasiquote
          (syntax-rules (unquote unquote-splicing)
            ((_ (unquote x)) x)
            ((_ (unquote-splicing x) . rest)
              (append x (quasiquote rest)))

            ((_ (a . rest))
            (cons (quasiquote a) (quasiquote rest)))

            ((_ x) (quote x))))

        case 'quasiquote':
          // hey, we can deal with unquote-splicing here!
          // decompose the list into a call to a list of the elements,
          // leaving quoted items alone, and unquoting the unquoted items.
        */

        case 'define-syntax':
          // parse the pattern and template here,
          // generate a list of transformers from it,
          // and add it to the Patterns component.
          const syntaxName = parsedList[1]
          const syntaxRules = parsedList[2]

          // at this point, we assume that syntax-rules is verified
          // and parsed correctly already.
          const syntaxRulesList = flattenList(syntaxRules)
          const literals: string[] = syntaxRulesList[1].map((literal: _Symbol) => literal.sym)
          const rules = syntaxRulesList.slice(2)
          // rules are set as a list of patterns and templates.
          // we need to convert these into transformers.
          const transformers: Transformer[] = rules.map(rule => {
            const ruleList = flattenList(rule)
            const pattern = ruleList[0]
            const template = ruleList[1]
            return new Transformer(literals, pattern, template)
          })
          // now we can add the transformers to the patterns component.
          patterns.addPattern(syntaxName.sym, transformers)
          return
      }
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
    // get the value of the symbol from the environment
    // associated with this symbol.
    const encodedName = encode(command.sym)
    stash.push(getVariable(context, encodedName, makeDummyIdentifierNode(command.sym)))
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
