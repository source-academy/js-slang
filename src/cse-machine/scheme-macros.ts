import * as es from 'estree'
import * as errors from '../errors/errors'
import { List } from '../stdlib/list'
import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import { is_number, SchemeNumber } from '../alt-langs/scheme/scm-slang/src/stdlib/core-math'
import { Context } from '..'
import { Control, Pattern, Stash } from './interpreter'
import { getVariable, handleRuntimeError } from './utils'
import {
  Transformer,
  arrayToImproperList,
  arrayToList,
  flattenImproperList,
  isImproperList,
  macro_transform,
  match
} from './patterns'
import { ControlItem } from './types'
import { encode } from '../alt-langs/scheme/scm-slang/src'
import { popInstr } from './instrCreator'

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
    return handleRuntimeError(context, new errors.ExceptionError(new Error('Cannot evaluate null')))
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
        return handleRuntimeError(
          context,
          new errors.ExceptionError(new Error('No matching transformer found for macro'))
        )
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
            body: body as any,
            modified: true
          }

          control.push(lambda as unknown as es.ArrowFunctionExpression)
          return

        case 'define':
          const variable = parsedList[1]
          if (isList(variable)) {
            // then this define is actually a function definition
            const varList = flattenList(variable)
            const name = varList[0]
            const params = varList.slice(1)
            const body = parsedList.slice(2)

            const define_function = arrayToList([
              new _Symbol('define'),
              name,
              arrayToList([new _Symbol('lambda'), arrayToList(params), ...body])
            ])
            control.push(define_function as any)
            return
          } else if (isImproperList(variable)) {
            const [varList, rest] = flattenImproperList(variable)
            const name = varList[0]
            const params = varList.slice(1)
            const body = parsedList.slice(2)

            const define_function = arrayToList([
              new _Symbol('define'),
              name,
              arrayToList([new _Symbol('lambda'), arrayToImproperList(params, rest), ...body])
            ])
            control.push(define_function as any)
            return
          }
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
            ],
            modified: true
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
            right: set_value,
            modified: true
          }

          control.push(assignment as es.AssignmentExpression)
          return
        case 'if':
          const condition = parsedList[1]
          const consequent = parsedList[2]
          // check if there is an alternate
          const alternate = parsedList.length > 3 ? parsedList[3] : undefined

          // evaluate the condition with truthy
          const truthyCondition = arrayToList([new _Symbol('truthy'), condition])

          // estree ConditionalExpression
          const conditional = {
            type: 'ConditionalExpression',
            test: truthyCondition as any,
            consequent,
            alternate,
            modified: true
          }

          control.push(conditional as es.ConditionalExpression)
          return
        case 'begin':
          // begin is a sequence of expressions
          // that are evaluated in order.
          // push the expressions to the control in reverse
          control.push(parsedList[parsedList.length - 1])
          for (let i = parsedList.length - 2; i > 0; i--) {
            control.push(popInstr(makeDummyIdentifierNode('pop')))
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
            ((_ ((unquote-splicing x) . rest))
              (append x (quasiquote rest)))

            ((_ (a . rest))
            (cons (quasiquote a) (quasiquote rest)))
              
            ((_ x) (quote x))))
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
          const literalList = flattenList(syntaxRulesList[1])
          const literals: string[] = literalList.map((literal: _Symbol) => literal.sym)
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
    if (patterns.hasPattern(command.sym)) {
      // get the relevant transformers
      const transformers: Transformer[] = patterns.getPattern(command.sym)

      // find the first matching transformer
      for (const transformer of transformers) {
        // check if the transformer matches the list
        if (match(command, transformer.pattern, transformer.literals)) {
          // if it does, apply the transformer
          const transformedMacro = macro_transform(command, transformer)
          control.push(transformedMacro as ControlItem)
          return
        }
      }

      // there is an error if we get to here
      return handleRuntimeError(
        context,
        new errors.ExceptionError(new Error('No matching transformer found for macro'))
      )
    }
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

/**
 * Because we have passed estree nodes with list elements
 * to the control, if any future estree functions require 
 * the values within the nodes to be evaluated, we use this
 * function to re-parse the modified estree nodes to avoid any errors.
 */
export function reparseEstreeNode(node: any): es.Node {
  // if the node is an estree node, we recursively reparse it.
  if (node.type) {
    if (!node.modified) {
      return node
    }
    switch (node.type) {
      case 'ArrowFunctionExpression':
        return {
          type: 'ArrowFunctionExpression',
          params: node.params.map((param: any) => reparseEstreeNode(param) as es.Identifier | es.RestElement),
          body: reparseEstreeNode(node.body) as es.BlockStatement
        } as es.Node
      case 'VariableDeclaration':
        return {
          type: 'VariableDeclaration',
          kind: node.kind,
          declarations: node.declarations.map((decl: any) => reparseEstreeNode(decl) as es.VariableDeclarator)
        } as es.Node
      case 'VariableDeclarator':
        return {
          type: 'VariableDeclarator',
          id: reparseEstreeNode(node.id) as es.Identifier,
          init: reparseEstreeNode(node.init)
        } as es.Node
      case 'AssignmentExpression':
        return {
          type: 'AssignmentExpression',
          operator: node.operator,
          left: reparseEstreeNode(node.left) as es.Identifier,
          right: reparseEstreeNode(node.right)
        } as es.Node
      case 'ConditionalExpression':
        return {
          type: 'ConditionalExpression',
          test: reparseEstreeNode(node.test),
          consequent: reparseEstreeNode(node.consequent),
          alternate: reparseEstreeNode(node.alternate)
        } as es.Node
      case 'CallExpression':
        return {
          type: 'CallExpression',
          optional: false,
          callee: reparseEstreeNode(node.callee),
          arguments: node.arguments.map((arg: any) => reparseEstreeNode(arg))
        } as es.Node
      case 'Identifier':
        return {
          type: 'Identifier',
          name: node.name
        } as es.Node
      case 'RestElement':
        return {
          type: 'RestElement',
          argument: reparseEstreeNode(node.argument) as es.Identifier
        } as es.Node
      default:
        // no other node was touched by schemeEval.
        // return it as is.
        return node
    }
  }
  // if the node is not an estree node, there are several possibilities:
  // 1. it is a list/improper list
  // 2. it is a symbol
  // 3. it is a number
  // 4. it is a boolean
  // 5. it is a string
  // we need to handle each of these cases.
  if (isList(node)) {
    // if it is a list, we can be lazy and reparse the list as a
    // CallExpression to the list. followed by a call to eval.
    // this will ensure that the list is evaluated.
    const items = flattenList(node)
    const evalledItems = items.map((item: any) => reparseEstreeNode(item))
    const listCall = {
      type: 'CallExpression',
      optional: false,
      callee: {
        type: 'Identifier',
        name: 'list'
      },
      arguments: evalledItems
    }
    return {
      type: 'CallExpression',
      optional: false,
      callee: {
        type: 'Identifier',
        name: 'eval'
      },
      arguments: [listCall as es.CallExpression]
    }
  } else if (isImproperList(node)) {
    // we can treat the improper list as a recursive CallExpression of cons
    // followed by a call to eval.
    const pairCall = {
      type: 'CallExpression',
      optional: false,
      callee: {
        type: 'Identifier',
        name: 'cons'
      },
      arguments: [
        reparseEstreeNode(node[0]),
        reparseEstreeNode(node[1])
      ]
    }
    return {
      type: 'CallExpression',
      optional: false,
      callee: {
        type: 'Identifier',
        name: 'eval'
      },
      arguments: [pairCall as es.CallExpression]
    }
  } else if (node instanceof _Symbol) {
    // if it is a symbol, we can just return an Identifier node.
    return {
      type: 'Identifier',
      name: node.sym
    }
  } else if (is_number(node)) {
    // if it is a number, we treat it as a call to
    // the string->number function.
    return {
      type: 'CallExpression',
      optional: false,
      callee: {
        type: 'Identifier',
        name: 'string->number'
      },
      arguments: [
        {
          type: 'Literal',
          value: node.toString()
        }
      ]
    }
  } else if (typeof node === 'boolean') {
    return {
      type: 'Literal',
      value: node
    }
  } else if (typeof node === 'string') {
    return {
      type: 'Literal',
      value: node
    }
  }
  // if we get to this point, just return undefined
  return {
    type: 'Literal',
    value: "undefined"
  }
}
