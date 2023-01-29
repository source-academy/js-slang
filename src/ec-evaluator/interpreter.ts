/**
 *
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 * and the legacy interpreter at '../interpreter/interpreter'
 */

/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { uniqueId } from 'lodash'

import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, Environment, Frame, Value } from '../types'
import { blockArrowFunction, constantDeclaration } from '../utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import Closure from './closure'
import { AgendaItem, cmdEvaluator, IInstr, InstrTypes } from './types'
import { isNode, Stack } from './utils'

/**
 * The agenda is a list of commands that still needs to be executed by the machine.
 * It contains syntax tree nodes or instructions.
 */
//@ts-ignore TODO remove ts-ignore
export class Agenda extends Stack<AgendaItem> {
  constructor(program: es.Program) {
    super()
    // Evaluation of last statement is undefined if stash is empty
    this.push({ instrType: InstrTypes.PUSH_UNDEFINED })

    // Load program into agenda stack
    // program is a es.BlockStatement
    this.push(program)
  }
}

/**
 * The stash is a list of values that stores intermediate results.
 */
//@ts-ignore TODO remove ts-ignore
export class Stash extends Stack<Value> {
  constructor() {
    super()
  }
}

/**
 * Function to be called when a program is to be interpreted using
 * the explicit control evaluator.
 * @param program a program string parsed as a es.Program
 * @param context
 * @returns top value of the stash
 */
export function evaluate(program: es.Program, context: Context) {
  const agenda: Agenda = new Agenda(program)
  const stash: Stash = new Stash()
  let command: AgendaItem | undefined = agenda.pop()
  while (command) {
    if (isNode(command)) {
      console.log(command)
      // Not sure if context.runtime.nodes has been shifted/unshifted correctly here.
      context.runtime.nodes.unshift(command)
      checkEditorBreakpoints(context, command)
      // Logic to handle breakpoints might have to go somewhere here.
      cmdEvaluators[command.type](command, context, agenda, stash)
      // context.runtime.break = false
      context.runtime.nodes.shift()
    } else {
      cmdEvaluators[command.instrType](command, context, agenda, stash)
    }
    command = agenda.pop()
  }
  return stash.peek()
}

/**
 * Dictionary of functions which handle the logic for the response of the three registers of
 * the ASE machine to each AgendaItem.
 */
const cmdEvaluators: { [command: string]: cmdEvaluator } = {
  Program: function (command: es.BlockStatement, context: Context, agenda: Agenda) {
    context.numberOfOuterEnvironments += 1
    const environment: Environment = createBlockEnvironment(context, 'programEnvironment')
    pushEnvironment(context, environment)
    declareFunctionsAndVariables(context, command)
    // Allow AgendaInst to be an array of statements so that we can separate sequence from block?
    for (let index = command.body.length - 1; index > 0; index--) {
      agenda.push(command.body[index])
      agenda.push({ instrType: InstrTypes.POP })
    }
    agenda.push(command.body[0])
  },
  BlockStatement: function (command: es.BlockStatement, context: Context, agenda: Agenda) {
    // Lot of code with blockstatement and program is repeated and needs to be abstracted.
    const environment: Environment = createBlockEnvironment(context, 'blockEnvironment')
    pushEnvironment(context, environment)
    declareFunctionsAndVariables(context, command)
    agenda.push({ instrType: InstrTypes.ENVIRONMENT })
    for (let index = command.body.length - 1; index > 0; index--) {
      agenda.push(command.body[index])
      agenda.push({ instrType: InstrTypes.POP })
    }
    agenda.push(command.body[0])
  },
  Literal: function (command: es.Literal, context: Context, agenda: Agenda, stash: Stash) {
    stash.push(command.value)
  },
  ExpressionStatement: function (
    command: es.ExpressionStatement,
    context: Context,
    agenda: Agenda
  ) {
    agenda.push(command.expression)
  },
  DebuggerStatement: function(command: es.DebuggerStatement, context: Context, agenda: Agenda) {
    // temporary to make interpreter work in current source frontend. Not final.
    context.runtime.break = true;
  },
  VariableDeclaration: function (command: es.VariableDeclaration, context: Context, agenda: Agenda) {
    const declaration: es.VariableDeclarator = command.declarations[0]
    const id = declaration.id as es.Identifier
    // Results in a redundant pop if this is part of a sequence statements. Not sure if this is intended.
    agenda.push({ instrType: InstrTypes.POP })
    agenda.push({
      instrType: InstrTypes.ASSIGNMENT,
      symbol: id.name,
      const: command.kind === 'const'
    })
    agenda.push(declaration.init!)
  },
  Identifier: function (command: es.Identifier, context: Context, agenda: Agenda, stash: Stash) {
    stash.push(getVariable(context, command.name))
  },
  UnaryExpression: function (command: es.UnaryExpression, context: Context, agenda: Agenda) {
    agenda.push({ instrType: InstrTypes.UNARY_OP, symbol: command.operator })
    agenda.push(command.argument)
  },
  BinaryExpression: function (command: es.BinaryExpression, context: Context, agenda: Agenda) {
    agenda.push({ instrType: InstrTypes.BINARY_OP, symbol: command.operator })
    agenda.push(command.right)
    agenda.push(command.left)
  },
  ArrowFunctionExpression: function (command: es.ArrowFunctionExpression, context: Context, agenda: Agenda, stash: Stash) {
    const closure: Closure = Closure.makeFromArrowFunction(command, currentEnvironment(context), context)
    stash.push(closure)
  },
  FunctionDeclaration: function(command: es.FunctionDeclaration, context: Context, agenda: Agenda) {
    const lambdaExpression: es.ArrowFunctionExpression = blockArrowFunction(command.params as es.Identifier[], command.body, command.loc)
    const lambdaDeclaration: es.VariableDeclaration = constantDeclaration(command.id!.name, lambdaExpression, command.loc)
    agenda.push(lambdaDeclaration)
  },
  CallExpression: function(command: es.CallExpression, context: Context, agenda: Agenda, stash: Stash) {
    command.callee
  },
  UnaryOperation: function (command: IInstr, context: Context, agenda: Agenda, stash: Stash) {
    const argument = stash.pop()
    stash.push(evaluateUnaryExpression(command.symbol as es.UnaryOperator, argument))
  },
  BinaryOperation: function (command: IInstr, context: Context, agenda: Agenda, stash: Stash) {
    const right = stash.pop()
    const left = stash.pop()
    stash.push(evaluateBinaryExpression(command.symbol as es.BinaryOperator, left, right))
  },
  Assignment: function (command: IInstr, context: Context, agenda: Agenda, stash: Stash) {
    defineVariable(context, command.symbol!, stash.peek(), command.const)
  },
  Environment: function (command: IInstr, context: Context) {
    popEnvironment(context)
  },
  Pop: function (command: IInstr, context: Context, agenda: Agenda, stash: Stash) {
    stash.pop()
  },
  PushUndefined: function (command: IInstr, context: Context, agenda: Agenda, stash: Stash) {
    if (stash.size() === 0) {
      stash.push(undefined)
    }
  }
}

export const createBlockEnvironment = (
  context: Context,
  name = 'blockEnvironment',
  head: Frame = {}
): Environment => {
  return {
    name,
    tail: currentEnvironment(context),
    head,
    id: uniqueId()
  }
}

const handleRuntimeError = (context: Context, error: RuntimeSourceError): never => {
  context.errors.push(error)
  context.runtime.environments = context.runtime.environments.slice(
    -context.numberOfOuterEnvironments
  )
  throw error
}

const DECLARED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement hoisting')

function declareIdentifier(context: Context, name: string, node: es.Node) {
  const environment = currentEnvironment(context)
  if (environment.head.hasOwnProperty(name)) {
    const descriptors = Object.getOwnPropertyDescriptors(environment.head)

    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(node, name, descriptors[name].writable)
    )
  }
  environment.head[name] = DECLARED_BUT_NOT_YET_ASSIGNED
  return environment
}

function declareVariables(context: Context, node: es.VariableDeclaration) {
  for (const declaration of node.declarations) {
    declareIdentifier(context, (declaration.id as es.Identifier).name, node)
  }
}

function declareFunctionsAndVariables(context: Context, node: es.BlockStatement) {
  for (const statement of node.body) {
    switch (statement.type) {
      case 'VariableDeclaration':
        declareVariables(context, statement)
        break
      case 'FunctionDeclaration':
        declareIdentifier(context, (statement.id as es.Identifier).name, statement)
        break
    }
  }
}

function defineVariable(context: Context, name: string, value: Value, constant = false) {
  const environment = currentEnvironment(context)

  if (environment.head[name] !== DECLARED_BUT_NOT_YET_ASSIGNED) {
    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(context.runtime.nodes[0]!, name, !constant)
    )
  }

  Object.defineProperty(environment.head, name, {
    value,
    writable: !constant,
    enumerable: true
  })

  return environment
}

const currentEnvironment = (context: Context) => context.runtime.environments[0]

// const replaceEnvironment = (context: Context, environment: Environment) => {
//   context.runtime.environments[0] = environment
//   context.runtime.environmentTree.insert(environment)
// }

const popEnvironment = (context: Context) => context.runtime.environments.shift()
export const pushEnvironment = (context: Context, environment: Environment) => {
  context.runtime.environments.unshift(environment)
  context.runtime.environmentTree.insert(environment)
}

const getVariable = (context: Context, name: string) => {
  let environment: Environment | null = currentEnvironment(context)
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === DECLARED_BUT_NOT_YET_ASSIGNED) {
        return handleRuntimeError(
          context,
          new errors.UnassignedVariable(name, context.runtime.nodes[0])
        )
      } else {
        return environment.head[name]
      }
    } else {
      environment = environment.tail
    }
  }
  return handleRuntimeError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
}

// const setVariable = (context: Context, name: string, value: any) => {
//   let environment: Environment | null = currentEnvironment(context)
//   while (environment) {
//     if (environment.head.hasOwnProperty(name)) {
//       if (environment.head[name] === DECLARED_BUT_NOT_YET_ASSIGNED) {
//         break
//       }
//       const descriptors = Object.getOwnPropertyDescriptors(environment.head)
//       if (descriptors[name].writable) {
//         environment.head[name] = value
//         return undefined
//       }
//       return handleRuntimeError(
//         context,
//         new errors.ConstAssignment(context.runtime.nodes[0]!, name)
//       )
//     } else {
//       environment = environment.tail
//     }
//   }
//   return handleRuntimeError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
// }
