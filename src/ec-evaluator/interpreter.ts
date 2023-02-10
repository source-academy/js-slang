/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 * and the legacy interpreter at '../interpreter/interpreter'
 */

/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { uniqueId } from 'lodash'

import * as constants from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import Closure from '../interpreter/closure'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, ContiguousArrayElements, Environment, Frame, Value } from '../types'
import {
  assignmentExpression,
  blockArrowFunction,
  blockStatement,
  conditionalExpression,
  constantDeclaration,
  expressionStatement,
  forStatement,
  identifier,
  literal,
  primitive,
  variableDeclaration,
  variableDeclarator,
  whileStatement
} from '../utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import {
  applicationInstr,
  assignmentInstr,
  branchInstr,
  envInstr,
  popInstr,
  pushUndefInstr,
  whileInstr
} from './instrCreator'
import { AgendaItem, cmdEvaluator, IInstr, InstrTypes } from './types'
import { handleSequence, isNode, Stack } from './utils'

/**
 * The agenda is a list of commands that still needs to be executed by the machine.
 * It contains syntax tree nodes or instructions.
 */
export class Agenda extends Stack<AgendaItem> {
  public constructor(program: es.Program) {
    super()
    // Evaluation of last statement is undefined if stash is empty
    this.push(pushUndefInstr())

    // Load program into agenda stack
    this.push(program)
  }
}

/**
 * The stash is a list of values that stores intermediate results.
 */
export class Stash extends Stack<Value> {
  public constructor() {
    super()
  }
}

/**
 * Function to be called when a program is to be interpreted using
 * the explicit control evaluator.
 *
 * @param program The program to evaluate.
 * @param context The context to evaluate in.
 * @returns The top value of the stash. It is usually the return value of the program.
 */
export function evaluate(program: es.Program, context: Context): Value {
  const agenda: Agenda = new Agenda(program)
  const stash: Stash = new Stash()

  let command = agenda.pop()
  while (command) {
    if (isNode(command)) {
      // Not sure if context.runtime.nodes has been shifted/unshifted correctly here.
      context.runtime.nodes.unshift(command)
      checkEditorBreakpoints(context, command)
      // Logic to handle breakpoints might have to go somewhere here.
      cmdEvaluators[command.type](command, context, agenda, stash)
      // context.runtime.break = false
      context.runtime.nodes.shift()
    } else {
      // Node is an instrucion
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
const cmdEvaluators: { [commandType: string]: cmdEvaluator } = {
  /** Statements */
  Program: function (command: es.BlockStatement, context: Context, agenda: Agenda) {
    context.numberOfOuterEnvironments += 1
    const environment = createBlockEnvironment(context, 'programEnvironment')
    pushEnvironment(context, environment)
    declareFunctionsAndVariables(context, command)
    agenda.push(...handleSequence(command.body))
  },

  BlockStatement: function (command: es.BlockStatement, context: Context, agenda: Agenda) {
    // To restore environment after block ends
    agenda.push(envInstr(currentEnvironment(context)))

    const environment = createBlockEnvironment(context, 'blockEnvironment')
    pushEnvironment(context, environment)
    declareFunctionsAndVariables(context, command)

    // Push block body
    agenda.push(...handleSequence(command.body))
  },

  WhileStatement: function (
    command: es.WhileStatement,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    agenda.push(whileInstr(command.test, command.body))
    agenda.push(command.test)
    agenda.push(identifier('undefined')) // Return undefined if there is no loop execution
  },

  ForStatement: function (
    command: es.ForStatement,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    // All 3 parts will be defined due to parser rules
    const init = command.init!
    const test = command.test!
    const update = command.update!

    // Loop control variable present
    // Refer to Source §3 specifications https://docs.sourceacademy.org/source_3.pdf
    if (init.type === 'VariableDeclaration' && init.kind === 'let') {
      const id = init.declarations[0].id as es.Identifier
      const valueExpression = init.declarations[0].init!

      agenda.push(
        blockStatement([
          init,
          forStatement(
            assignmentExpression(id, valueExpression),
            test,
            update,
            blockStatement([
              variableDeclaration([
                variableDeclarator(identifier('_copy_of_' + id.name), identifier(id.name))
              ]),
              blockStatement([
                variableDeclaration([
                  variableDeclarator(identifier(id.name), identifier('_copy_of_' + id.name))
                ]),
                command.body
              ])
            ])
          )
        ])
      )
    } else {
      // Append update statement at the end of loop body
      const whileBody = blockStatement([command.body, expressionStatement(update)])
      agenda.push(whileStatement(whileBody, test))
      agenda.push(init)
    }
  },

  IfStatement: function (command: es.IfStatement, context: Context, agenda: Agenda, stash: Stash) {
    agenda.push(...reduceConditional(command))
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

  DebuggerStatement: function (command: es.DebuggerStatement, context: Context, agenda: Agenda) {
    context.runtime.break = true
  },

  VariableDeclaration: function (
    command: es.VariableDeclaration,
    context: Context,
    agenda: Agenda
  ) {
    const declaration: es.VariableDeclarator = command.declarations[0]
    const id = declaration.id as es.Identifier
    // Pop instruction required as declarations are not value producing so the value remaining on the stash needs to be popped.
    agenda.push(popInstr())
    agenda.push(assignmentInstr(id.name, command.kind === 'const', true, command))
    agenda.push(declaration.init!)
  },

  AssignmentExpression: function (
    command: es.AssignmentExpression,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    if (command.left.type === 'MemberExpression') {
      agenda.push({ instrType: InstrTypes.ARRAY_ASSIGNMENT })
      agenda.push(command.right)
      agenda.push(command.left.property)
      agenda.push(command.left.object)
    } else if (command.left.type === 'Identifier') {
      const id = command.left
      // No pop instruction because assignments are value producing so the value on the stash remains.
      agenda.push(assignmentInstr(id.name, false, false, command))
      agenda.push(command.right)
    }
  },

  ArrayExpression: function (
    command: es.ArrayExpression,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const elems = command.elements as ContiguousArrayElements
    const len = elems.length

    agenda.push({ instrType: InstrTypes.ARRAY_LITERAL, arity: len })
    for (const elem of elems) {
      agenda.push(elem)
    }
  },

  MemberExpression: function (
    command: es.MemberExpression,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    agenda.push({ instrType: InstrTypes.ARRAY_ACCESS })
    agenda.push(command.property)
    agenda.push(command.object)
  },

  ConditionalExpression: function (
    command: es.ConditionalExpression,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    agenda.push(...reduceConditional(command))
  },

  Identifier: function (command: es.Identifier, context: Context, agenda: Agenda, stash: Stash) {
    stash.push(getVariable(context, command.name, command))
  },

  UnaryExpression: function (command: es.UnaryExpression, context: Context, agenda: Agenda) {
    agenda.push({ instrType: InstrTypes.UNARY_OP, symbol: command.operator, srcNode: command })
    agenda.push(command.argument)
  },

  BinaryExpression: function (command: es.BinaryExpression, context: Context, agenda: Agenda) {
    agenda.push({ instrType: InstrTypes.BINARY_OP, symbol: command.operator, srcNode: command })
    agenda.push(command.right)
    agenda.push(command.left)
  },

  LogicalExpression: function (command: es.LogicalExpression, context: Context, agenda: Agenda) {
    if (command.operator === '&&') {
      agenda.push(conditionalExpression(command.left, command.right, literal(false), command.loc))
    } else {
      agenda.push(conditionalExpression(command.left, literal(true), command.right, command.loc))
    }
  },

  ArrowFunctionExpression: function (
    command: es.ArrowFunctionExpression,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const closure: Closure = Closure.makeFromArrowFunction(
      command,
      currentEnvironment(context),
      context
    )
    stash.push(closure)
  },

  FunctionDeclaration: function (
    command: es.FunctionDeclaration,
    context: Context,
    agenda: Agenda
  ) {
    // Function declaration desugared into constant declaration.
    const lambdaExpression: es.ArrowFunctionExpression = blockArrowFunction(
      command.params as es.Identifier[],
      command.body,
      command.loc
    )
    const lambdaDeclaration: es.VariableDeclaration = constantDeclaration(
      command.id!.name,
      lambdaExpression,
      command.loc
    )
    agenda.push(lambdaDeclaration)
  },

  CallExpression: function (
    command: es.CallExpression,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    // Push application instruction, function arguments and function onto agenda.
    agenda.push(applicationInstr(command.arguments.length, command))
    for (let index = command.arguments.length - 1; index >= 0; index--) {
      agenda.push(command.arguments[index])
    }
    agenda.push(command.callee)
  },

  ReturnStatement: function (
    command: es.ReturnStatement,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    // Push return argument onto agenda as well as Reset Instruction to clear to ignore all statements after the return.
    agenda.push({ instrType: InstrTypes.RESET })
    if (command.argument) {
      agenda.push(command.argument)
    }
  },

  /** Instructions */
  [InstrTypes.RESET]: function (command: IInstr, context: Context, agenda: Agenda) {
    // Keep pushing reset instructions until marker is found.
    const cmdNext: AgendaItem | undefined = agenda.pop()
    if (cmdNext && (isNode(cmdNext) || cmdNext.instrType !== InstrTypes.MARKER)) {
      agenda.push({ instrType: InstrTypes.RESET })
    }
  },

  [InstrTypes.APPLICATION]: function (
    command: IInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    // Get function arguments from the stash
    const args: Value[] = []
    for (let index = 0; index < command.numOfArgs!; index++) {
      args.unshift(stash.pop())
    }

    // Get function from the stash
    const func: Closure | Function = stash.pop()
    if (func instanceof Closure) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode! as es.CallExpression)

      // For User-defined and Pre-defined functions instruction to restore environment and marker for the reset instruction is required.
      const next = agenda.peek()
      if (!next || (!isNode(next) && next.instrType === InstrTypes.ENVIRONMENT)) {
        // Pushing another Env Instruction would be redundant so only Marker needs to be pushed.
        agenda.push({ instrType: InstrTypes.MARKER })
      } else if (!isNode(next) && next.instrType === InstrTypes.RESET) {
        // Reset Instruction will be replaced by Reset Instruction of new return statement.
        agenda.pop()
      } else {
        agenda.push(envInstr(currentEnvironment(context)))
        agenda.push({ instrType: InstrTypes.MARKER })
      }

      // Push function body on agenda and create environment for function parameters.
      agenda.push(func.node.body)
      const environment = createEnvironment(func, args)
      pushEnvironment(context, environment)
    } else if (typeof func === 'function') {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode! as es.CallExpression)
      // Directly stash result of applying pre-built functions without the ASE machine.
      try {
        const result = func(...args)
        stash.push(result)
      } catch (error) {
        context.runtime.environments = context.runtime.environments.slice(
          -context.numberOfOuterEnvironments
        )
        if (!(error instanceof RuntimeSourceError || error instanceof errors.ExceptionError)) {
          // The error could've arisen when the builtin called a source function which errored.
          // If the cause was a source error, we don't want to include the error.
          // However if the error came from the builtin itself, we need to handle it.
          const loc = command.srcNode ? command.srcNode.loc! : constants.UNKNOWN_LOCATION
          handleRuntimeError(context, new errors.ExceptionError(error, loc))
        }
      }
    } else {
      handleRuntimeError(context, new errors.CallingNonFunctionValue(func, command.srcNode!))
    }
  },

  [InstrTypes.BRANCH]: function (command: IInstr, context: Context, agenda: Agenda, stash: Stash) {
    const test = stash.pop()

    // TODO: Check if test value is boolean
    // This evaluator throws away the node which created the boolean
    // How to retrieve/save the node?
    // Save it in the branch function?
    const error = rttc.checkIfStatement(command.srcNode!, test, context.chapter)
    if (error) {
      // throw error instead of return?
      handleRuntimeError(context, error)
    }

    if (test) {
      agenda.push(command.consequent!)
    } else if (command.alternate) {
      agenda.push(command.alternate)
    }
  },

  [InstrTypes.WHILE]: function (command: IInstr, context: Context, agenda: Agenda, stash: Stash) {
    // TODO check if test is a boolean
    // Throw error if test is not boolean
    const test = stash.pop()
    if (test) {
      agenda.push(command)
      agenda.push(command.test!)
      agenda.push(pushUndefInstr()) // The loop returns undefined if the stash is empty
      agenda.push(command.body!)
      agenda.push(popInstr()) // Pop previous body value
    }
  },

  [InstrTypes.POP]: function (command: IInstr, context: Context, agenda: Agenda, stash: Stash) {
    stash.pop()
  },

  [InstrTypes.ASSIGNMENT]: function (
    command: IInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    command.declaration
      ? defineVariable(
          context,
          command.symbol!,
          stash.peek(),
          command.constant,
          command.srcNode! as es.VariableDeclaration
        )
      : setVariable(
          context,
          command.symbol!,
          stash.peek(),
          command.srcNode! as es.AssignmentExpression
        )
  },

  [InstrTypes.UNARY_OP]: function (
    command: IInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const argument = stash.pop()
    const error = rttc.checkUnaryExpression(
      command.srcNode!,
      command.symbol as es.UnaryOperator,
      argument,
      context.chapter
    )
    if (error) {
      handleRuntimeError(context, error)
    }
    stash.push(evaluateUnaryExpression(command.symbol as es.UnaryOperator, argument))
  },

  [InstrTypes.BINARY_OP]: function (
    command: IInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const right = stash.pop()
    const left = stash.pop()
    const error = rttc.checkBinaryExpression(
      command.srcNode!,
      command.symbol as es.BinaryOperator,
      context.chapter,
      left,
      right
    )
    if (error) {
      handleRuntimeError(context, error)
    }
    stash.push(evaluateBinaryExpression(command.symbol as es.BinaryOperator, left, right))
  },

  [InstrTypes.ENVIRONMENT]: function (command: IInstr, context: Context) {
    // Restore environment
    while (currentEnvironment(context).id !== command.env?.id) {
      popEnvironment(context)
    }
  },

  [InstrTypes.PUSH_UNDEFINED_IF_NEEDED]: function (
    command: IInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    if (stash.size() === 0) {
      stash.push(undefined)
    }
  },

  [InstrTypes.ARRAY_LITERAL]: function (
    command: IInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const arity = command.arity!
    const array = []
    for (let i = 0; i < arity; ++i) {
      array.push(stash.pop())
    }
    stash.push(array)
  },

  [InstrTypes.ARRAY_ACCESS]: function (
    command: IInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const index = stash.pop()
    const array = stash.pop()
    stash.push(array[index])
  },

  [InstrTypes.ARRAY_ASSIGNMENT]: function (
    command: IInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const value = stash.pop()
    const index = stash.pop()
    const array = stash.pop()
    array[index] = value
    stash.push(value)
  }

  // [InstrTypes.ARRAY_LENGTH]: function (
  //   command: IInstr,
  //   context: Context,
  //   agenda: Agenda,
  //   stash: Stash
  // ) {
  //   const array = stash.pop()
  //   stash.push(array.length)
  // }

  // [InstrTypes.CONTINUE]: function (
  //   command: IInstr,
  //   context: Context,
  //   agenda: Agenda,
  //   stash: Stash
  // ) {
  //   const next = stash.pop()
  //   if (!isInstr(next) || next.instrType !== InstrTypes.CONTINUE_MARKER) {
  //     // If no continue marker found,
  //     // continue loop by pushing same instruction back on agenda
  //     agenda.push(command)
  //   }
  // },

  // [InstrTypes.BREAK]: function (command: IInstr, context: Context, agenda: Agenda, stash: Stash) {
  //   const next = stash.pop()
  //   if (!isInstr(next) || next.instrType !== InstrTypes.BREAK_MARKER) {
  //     // If no break marker found
  //     // continue loop by pushing same instruction back on agenda
  //     agenda.push(command)
  //   }
  // },

  // [InstrTypes.CONTINUE_MARKER]: function () {},

  // [InstrTypes.BREAK_MARKER]: function () {}
}

// Should all of these be moved to utils?
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

function defineVariable(
  context: Context,
  name: string,
  value: Value,
  constant = false,
  node: es.VariableDeclaration
) {
  const environment = currentEnvironment(context)

  if (environment.head[name] !== DECLARED_BUT_NOT_YET_ASSIGNED) {
    return handleRuntimeError(context, new errors.VariableRedeclaration(node, name, !constant))
  }

  Object.defineProperty(environment.head, name, {
    value,
    writable: !constant,
    enumerable: true
  })

  return environment
}

const getVariable = (context: Context, name: string, node: es.Identifier) => {
  let environment: Environment | null = currentEnvironment(context)
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === DECLARED_BUT_NOT_YET_ASSIGNED) {
        return handleRuntimeError(context, new errors.UnassignedVariable(name, node))
      } else {
        return environment.head[name]
      }
    } else {
      environment = environment.tail
    }
  }
  return handleRuntimeError(context, new errors.UndefinedVariable(name, node))
}

const setVariable = (context: Context, name: string, value: any, node: es.AssignmentExpression) => {
  let environment: Environment | null = currentEnvironment(context)
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === DECLARED_BUT_NOT_YET_ASSIGNED) {
        break
      }
      const descriptors = Object.getOwnPropertyDescriptors(environment.head)
      if (descriptors[name].writable) {
        environment.head[name] = value
        return undefined
      }
      return handleRuntimeError(context, new errors.ConstAssignment(node, name))
    } else {
      environment = environment.tail
    }
  }
  return handleRuntimeError(context, new errors.UndefinedVariable(name, node))
}

const checkNumberOfArguments = (
  context: Context,
  callee: Closure | Value,
  args: Value[],
  exp: es.CallExpression
) => {
  if (callee instanceof Closure) {
    // User-defined or Pre-defined functions
    const params = callee.node.params
    const hasVarArgs = params[params.length - 1]?.type === 'RestElement'
    if (hasVarArgs ? params.length - 1 > args.length : params.length !== args.length) {
      return handleRuntimeError(
        context,
        new errors.InvalidNumberOfArguments(
          exp,
          hasVarArgs ? params.length - 1 : params.length,
          args.length,
          hasVarArgs
        )
      )
    }
  } else {
    // Pre-built functions
    const hasVarArgs = callee.minArgsNeeded != undefined
    if (hasVarArgs ? callee.minArgsNeeded > args.length : callee.length !== args.length) {
      return handleRuntimeError(
        context,
        new errors.InvalidNumberOfArguments(
          exp,
          hasVarArgs ? callee.minArgsNeeded : callee.length,
          args.length,
          hasVarArgs
        )
      )
    }
  }
  return undefined
}

const createEnvironment = (
  closure: Closure,
  args: Value[],
  callExpression?: es.CallExpression
): Environment => {
  const environment: Environment = {
    name: closure.functionName, // TODO: Change this
    tail: closure.environment,
    head: {},
    id: uniqueId()
  }
  if (callExpression) {
    // Don't think this is required for ece. Stack and agenda eliminates need to keep track of call expression.
    environment.callExpression = {
      ...callExpression,
      arguments: args.map(primitive)
    }
  }
  closure.node.params.forEach((param, index) => {
    if (param.type === 'RestElement') {
      // Not sure where rest elements are used in source. If no use found can remove the condition.
      environment.head[(param.argument as es.Identifier).name] = args.slice(index)
    } else {
      environment.head[(param as es.Identifier).name] = args[index]
    }
  })
  return environment
}

/**
 * This function is used for ConditionalExpressions and IfStatements, to create the sequence
 * of agenda items to be added.
 */
const reduceConditional = (node: es.IfStatement | es.ConditionalExpression): AgendaItem[] => {
  return [branchInstr(node.consequent, node.alternate, node), node.test]
}
