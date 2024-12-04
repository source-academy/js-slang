import * as es from 'estree'
import * as errors from '../errors/errors'
import { List } from '../stdlib/list'
import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import { is_number, SchemeNumber } from '../alt-langs/scheme/scm-slang/src/stdlib/core-math'
import { Context } from '..'
import { Control, Stash } from './interpreter'
import { currentTransformers, getVariable, handleRuntimeError } from './utils'
import { Transformer, macro_transform, match } from './patterns'
import {
  arrayToImproperList,
  arrayToList,
  flattenImproperList,
  isImproperList
} from './macro-utils'
import { ControlItem } from './types'
import { encode } from '../alt-langs/scheme/scm-slang/src'
import { popInstr } from './instrCreator'
import { flattenList, isList } from './macro-utils'

// this needs to be better but for now it's fine
export type SchemeControlItems = List | _Symbol | SchemeNumber | boolean | string

/**
 * A metaprocedure used to detect for the apply function object.
 * If the interpreter sees this specific function,
 * it will take all of the operands, and apply the second to second last operands as well as the last operand (must be a list)
 * to the first operand (which must be a function).
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

export const cset_apply = Apply.get()

export function isApply(value: any): boolean {
  return value === cset_apply
}

/**
 * A metaprocedure used to detect for the eval function object.
 * If the interpreter sees this specific function,
 * it will transfer its operand to the control component.
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

export const cset_eval = Eval.get()

export function isEval(value: any): boolean {
  return value === cset_eval
}

function isSpecialForm(sym: _Symbol): boolean {
  return [
    'lambda',
    'define',
    'set!',
    'if',
    'begin',
    'quote',
    'quasiquote',
    'define-syntax',
    'syntax-rules',
    'eval'
  ].includes(sym.sym)
}

export function schemeEval(
  command: SchemeControlItems,
  context: Context,
  control: Control,
  stash: Stash,
  isPrelude: boolean
) {
  const transformers = currentTransformers(context)
  // scheme CSE machine will only ever encounter
  // lists or primitives like symbols, booleans or strings.
  // if its a list, we can parse the list and evaluate each item as necessary
  // if its a symbol, we can look up the symbol in the environment.
  // for either of these operations, if our list matches some pattern in
  // the T component, then we can apply the corresponding rule.

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
      // check if elem matches any defined syntax in the T component.
      // if it does, then apply the corresponding rule.
      if (transformers.hasPattern(elem.sym)) {
        // get the relevant transformers
        const transformerList: Transformer[] = transformers.getPattern(elem.sym)

        // find the first matching transformer
        for (const transformer of transformerList) {
          // check if the transformer matches the list
          try {
            if (match(command, transformer.pattern, transformer.literals)) {
              // if it does, apply the transformer
              const transformedMacro = macro_transform(command as List, transformer)
              control.push(transformedMacro as ControlItem)
              return
            }
          } catch (e) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(
                new Error(
                  'Error in macro-expanding ' +
                    elem.sym +
                    '! Are the template and pattern well formed?'
                )
              )
            )
          }
        }

        // there is an error if we get to here
        return handleRuntimeError(
          context,
          new errors.ExceptionError(
            new Error('No matching transformer found for macro ' + elem.sym)
          )
        )
      }

      // else, this is a standard special form.
      // we attempt to piggyback on the standard CSE machine to
      // handle the basic special forms.
      // however, for more advanced stuff like quotes or definitions,
      // the logic will be handled here.
      switch (parsedList[0].sym) {
        case 'lambda':
          if (parsedList.length < 3) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('lambda requires at least 2 arguments!'))
            )
          }
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
            argsList.forEach((arg: any) => {
              if (!(arg instanceof _Symbol)) {
                return handleRuntimeError(
                  context,
                  new errors.ExceptionError(new Error('Invalid arguments for lambda!'))
                )
              }
              return
            })
            if (rest !== null && !(rest instanceof _Symbol)) {
              return handleRuntimeError(
                context,
                new errors.ExceptionError(new Error('Invalid arguments for lambda!'))
              )
            }
          } else if (isList(args)) {
            argsList = flattenList(args) as _Symbol[]
            argsList.forEach((arg: any) => {
              if (!(arg instanceof _Symbol)) {
                return handleRuntimeError(
                  context,
                  new errors.ExceptionError(new Error('Invalid arguments for lambda!'))
                )
              }
              return
            })
          } else {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('Invalid arguments for lambda!'))
            )
          }

          // convert the args to estree pattern
          const params: (es.Identifier | es.RestElement)[] = argsList.map(arg =>
            makeDummyIdentifierNode(encode(arg.sym))
          )

          let body_elements = parsedList.slice(2)
          let body: List = arrayToList([new _Symbol('begin'), ...body_elements])

          // if there is a rest argument, we need to wrap it in a rest element.
          // we also need to add another element to the body,
          // to convert the rest element into a list.
          if (rest !== null) {
            params.push({
              type: 'RestElement',
              argument: makeDummyIdentifierNode(encode(rest.sym))
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
            body: convertToEvalExpression(body)
          }

          control.push(lambda as es.ArrowFunctionExpression)
          return

        case 'define':
          if (parsedList.length < 3) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('define requires at least 2 arguments!'))
            )
          }
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
          } else if (!(variable instanceof _Symbol)) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('Invalid variable for define!'))
            )
          }
          if (parsedList.length !== 3) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('define requires 2 arguments!'))
            )
          }
          // make sure variable does not shadow a special form
          if (isSpecialForm(variable) && !isPrelude) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(
                new Error('Cannot shadow special form ' + variable.sym + ' with a definition!')
              )
            )
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
                init: convertToEvalExpression(value)
              }
            ]
          }

          control.push(definition as es.VariableDeclaration)
          return
        case 'set!':
          if (parsedList.length !== 3) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('set! requires 2 arguments!'))
            )
          }
          const set_variable = parsedList[1]
          if (!(set_variable instanceof _Symbol)) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('Invalid arguments for set!'))
            )
          }
          // make sure set_variable does not shadow a special form
          if (isSpecialForm(set_variable) && !isPrelude) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(
                new Error('Cannot overwrite special form ' + set_variable.sym + ' with a value!')
              )
            )
          }
          const set_value = parsedList[2]

          // estree AssignmentExpression
          const assignment = {
            type: 'AssignmentExpression',
            operator: '=',
            left: makeDummyIdentifierNode(encode(set_variable.sym)),
            right: convertToEvalExpression(set_value)
          }

          control.push(assignment as es.AssignmentExpression)
          return
        case 'if':
          if (parsedList.length < 3) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('if requires at least 2 arguments!'))
            )
          }
          if (parsedList.length > 4) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('if requires at most 3 arguments!'))
            )
          }
          const condition = parsedList[1]
          const consequent = parsedList[2]
          // check if there is an alternate
          const alternate = parsedList.length > 3 ? parsedList[3] : undefined

          // evaluate the condition with truthy
          const truthyCondition = arrayToList([new _Symbol('truthy'), condition])

          // estree ConditionalExpression
          const conditional = {
            type: 'ConditionalExpression',
            test: convertToEvalExpression(truthyCondition),
            consequent: convertToEvalExpression(consequent),
            alternate: alternate ? convertToEvalExpression(alternate) : undefined
          }

          control.push(conditional as es.ConditionalExpression)
          return
        case 'begin':
          // begin is a sequence of expressions
          // that are evaluated in order.
          // push the expressions to the control in reverse
          // order.
          if (parsedList.length < 2) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('begin requires at least 1 argument!'))
            )
          }

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
          if (parsedList.length !== 2) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('quote requires 1 argument!'))
            )
          }
          stash.push(parsedList[1])
          return
        // case 'quasiquote': quasiquote is implemented as a macro.
        case 'define-syntax':
          if (parsedList.length !== 3) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('define-syntax requires 2 arguments!'))
            )
          }
          // parse the pattern and template here,
          // generate a list of transformers from it,
          // and add it to the Patterns component.
          const syntaxName = parsedList[1]
          if (!(syntaxName instanceof _Symbol)) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('define-syntax requires a symbol!'))
            )
          }
          // make sure syntaxName does not shadow a special form
          if (isSpecialForm(syntaxName) && !isPrelude) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(
                new Error('Cannot shadow special form ' + syntaxName.sym + ' with a macro!')
              )
            )
          }
          const syntaxRules = parsedList[2]
          if (!isList(syntaxRules)) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(
                new Error('define-syntax requires a syntax-rules transformer!')
              )
            )
          }

          // at this point, we assume that syntax-rules is verified
          // and parsed correctly already.
          const syntaxRulesList = flattenList(syntaxRules)
          if (
            !(syntaxRulesList[0] instanceof _Symbol) ||
            syntaxRulesList[0].sym !== 'syntax-rules'
          ) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(
                new Error('define-syntax requires a syntax-rules transformer!')
              )
            )
          }
          if (syntaxRulesList.length < 3) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('syntax-rules requires at least 2 arguments!'))
            )
          }
          if (!isList(syntaxRulesList[1])) {
            return handleRuntimeError(
              context,
              new errors.ExceptionError(new Error('Invalid syntax-rules literals!'))
            )
          }
          const literalList = flattenList(syntaxRulesList[1])
          const literals: string[] = literalList.map((literal: _Symbol) => {
            if (!(literal instanceof _Symbol)) {
              return handleRuntimeError(
                context,
                new errors.ExceptionError(new Error('Invalid syntax-rules literals!'))
              )
            }
            return literal.sym
          })
          const rules = syntaxRulesList.slice(2)
          // rules are set as a list of patterns and templates.
          // we need to convert these into transformers.
          const transformerList: Transformer[] = rules.map(rule => {
            if (!isList(rule)) {
              return handleRuntimeError(
                context,
                new errors.ExceptionError(new Error('Invalid syntax-rules rule!'))
              )
            }
            const ruleList = flattenList(rule)
            const pattern = ruleList[0]
            const template = ruleList[1]
            return new Transformer(literals, pattern, template)
          })
          // now we can add the transformers to the transformers component.
          transformers.addPattern(syntaxName.sym, transformerList)

          // for consistency with scheme expecting undefined return values, push undefined to the stash.
          stash.push(undefined)
          return
        case 'syntax-rules':
          // syntax-rules is a special form that is used to define
          // a set of transformers.
          // it isn't meant to be evaluated outside of a define-syntax.
          // throw an error.
          return handleRuntimeError(
            context,
            new errors.ExceptionError(
              new Error('syntax-rules must only exist within define-syntax!')
            )
          )
      }
    }
    // if we get to this point, then it is a function call.
    // convert it into an es.CallExpression and push it to the control.
    const procedure = parsedList[0]
    const args = parsedList.slice(1)
    const appln = {
      type: 'CallExpression',
      optional: false,
      callee: convertToEvalExpression(procedure) as es.Expression,
      arguments: args.map(convertToEvalExpression) // unfortunately, each one needs to be converted.
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
 * Convert a scheme expression (that is meant to be evaluated)
 * into an estree expression, using eval.
 * this will let us avoid the "hack" of storing Scheme lists
 * in estree nodes.
 * @param expression
 * @returns estree expression
 */
export function convertToEvalExpression(expression: SchemeControlItems): es.CallExpression {
  function convertToEstreeExpression(expression: SchemeControlItems): es.Expression {
    /*
    cases to consider:
    - list
    - pair/improper list
    - symbol
    - number
    - boolean
    - string
    */
    if (isList(expression)) {
      // make a call expression to list
      // with the elements of the list as its arguments.
      const args = flattenList(expression).map(convertToEstreeExpression)
      return {
        type: 'CallExpression',
        optional: false,
        callee: {
          type: 'Identifier',
          name: 'list'
        },
        arguments: args
      }
    } else if (isImproperList(expression)) {
      // make a call to cons
      // with the car and cdr as its arguments.
      const [car, cdr] = expression as [SchemeControlItems, SchemeControlItems]
      return {
        type: 'CallExpression',
        optional: false,
        callee: {
          type: 'Identifier',
          name: 'cons'
        },
        arguments: [convertToEstreeExpression(car), convertToEstreeExpression(cdr)]
      }
    } else if (expression instanceof _Symbol) {
      // make a call to string->symbol
      // with the symbol name as its argument.
      return {
        type: 'CallExpression',
        optional: false,
        callee: {
          type: 'Identifier',
          name: encode('string->symbol')
        },
        arguments: [
          {
            type: 'Literal',
            value: expression.sym
          }
        ]
      }
    } else if (is_number(expression)) {
      // make a call to string->number
      // with the number toString() as its argument.
      return {
        type: 'CallExpression',
        optional: false,
        callee: {
          type: 'Identifier',
          name: encode('string->number')
        },
        arguments: [
          {
            type: 'Literal',
            value: (expression as any).toString()
          }
        ]
      }
    }
    // if we're here, then it is a boolean or string.
    // just return the literal value.
    return {
      type: 'Literal',
      value: expression as boolean | string
    }
  }

  // make a call expression to eval with the single expression as its component.
  return {
    type: 'CallExpression',
    optional: false,
    callee: {
      type: 'Identifier',
      name: encode('eval')
    },
    arguments: [convertToEstreeExpression(expression) as es.Expression]
  }
}
