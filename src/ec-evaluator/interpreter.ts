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
import Closure from './closure'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, ContiguousArrayElements, Environment, Frame, Result, Value } from '../types'
import * as ast from '../utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import * as instr from './instrCreator'
import {
  AgendaItem,
  AppInstr,
  ArrLitInstr,
  AssmtInstr,
  BinOpInstr,
  BranchInstr,
  CmdEvaluator,
  EnvInstr,
  Instr,
  InstrType,
  UnOpInstr,
  WhileInstr
} from './types'
import { handleSequence, isIdentifier, isNode, Stack } from './utils'

/**
 * The agenda is a list of commands that still needs to be executed by the machine.
 * It contains syntax tree nodes or instructions.
 */
export class Agenda extends Stack<AgendaItem> {
  public constructor(program: es.Program) {
    super()
    // Evaluation of last statement is undefined if stash is empty
    this.push(instr.pushUndefInstr())

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
 * @param context The context to evaluate the program in.
 * @returns The result of running the ECE machine.
 */
export function evaluate(program: es.Program, context: Context): Value {
  context.runtime.agenda = new Agenda(program)
  context.runtime.stash = new Stash()
  return runECEMachine(context, context.runtime.agenda, context.runtime.stash)
}

/**
 * Function that is called when a user wishes to resume evaluation after
 * hitting a breakpoint.
 * @param context The context to continue evaluating the program in.
 * @returns The result of running the ECE machine.
 */
export function resumeEvaluate(context: Context) {
  return runECEMachine(context, context.runtime.agenda!, context.runtime.stash!)
  // Agenda and stash should not be undefined since resumeEvaluate should only be called when
  // after the initial evaluate so context.runtime.agenda and context.runtime.stash
  // should be initialised.
}

/**
 * Function that helps decide whether the function is finished evaluating
 * or suspended depending on the breakpoints.
 * @param context The context of the program.
 * @param value The value of ec evaluating the program.
 * @returns The corresponding promise.
 */
export function ECEResultPromise(context: Context, value: Value): Promise<Result> {
  return new Promise((resolve, reject) => {
    if (value && value.break) {
      resolve({ status: 'suspended-ec-eval', context })
    } else {
      resolve({ status: 'finished', context, value })
    }
  })
}

/**
 *
 * @param context The context to evaluate the program in.
 * @param agenda Points to the current context.runtime.agenda
 * @param stash Points to the current context.runtime.stash
 * @returns A special break object if the program is interrupted by a break point;
 * else the top value of the stash. It is usually the return value of the program.
 */
function runECEMachine(context: Context, agenda: Agenda, stash: Stash) {
  context.runtime.break = false
  context.runtime.nodes = []
  let command = agenda.pop()
  while (command) {
    if (isNode(command)) {
      context.runtime.nodes.unshift(command)
      checkEditorBreakpoints(context, command)
      cmdEvaluators[command.type](command, context, agenda, stash)
      if (context.runtime.break && context.runtime.debuggerOn) {
        // We can put this under isNode since context.runtime.break
        // will only be updated after a debugger statement and so we will
        // run into a node immediately after.
        return { break: true }
      }
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
const cmdEvaluators: { [type: string]: CmdEvaluator } = {
  /**
   * Statements
   */
  Program: function (command: es.BlockStatement, context: Context, agenda: Agenda, stash: Stash) {
    context.numberOfOuterEnvironments += 1
    const environment = createBlockEnvironment(context, 'programEnvironment')
    pushEnvironment(context, environment)
    declareFunctionsAndVariables(context, command)
    agenda.push(...handleSequence(command.body))
  },

  BlockStatement: function (
    command: es.BlockStatement,
    context: Context,
    agenda: Agenda,
  ) {
    // To restore environment after block ends
    agenda.push(instr.envInstr(currentEnvironment(context)))

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
  ) {
    agenda.push(instr.whileInstr(command.test, command.body, command))
    agenda.push(command.test)
    agenda.push(ast.identifier('undefined')) // Return undefined if there is no loop execution
  },

  ForStatement: function (
    command: es.ForStatement,
    context: Context,
    agenda: Agenda,
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
        ast.blockStatement([
          init,
          ast.forStatement(
            ast.assignmentExpression(id, valueExpression),
            test,
            update,
            ast.blockStatement([
              ast.variableDeclaration([
                ast.variableDeclarator(
                  ast.identifier(`_copy_of_${id.name}`),
                  ast.identifier(id.name)
                )
              ]),
              ast.blockStatement([
                ast.variableDeclaration([
                  ast.variableDeclarator(
                    ast.identifier(id.name),
                    ast.identifier(`_copy_of_${id.name}`)
                  )
                ]),
                command.body
              ])
            ])
          )
        ])
      )
    } else {
      // Append update statement at the end of loop body
      const whileBody = ast.blockStatement([command.body, ast.expressionStatement(update)])
      agenda.push(ast.whileStatement(whileBody, test))
      agenda.push(init)
    }
  },

  IfStatement: function (command: es.IfStatement, context: Context, agenda: Agenda, stash: Stash) {
    agenda.push(...reduceConditional(command))
  },

  ExpressionStatement: function (
    command: es.ExpressionStatement,
    context: Context,
    agenda: Agenda,
  ) {
    agenda.push(command.expression)
  },

  DebuggerStatement: function (
    command: es.DebuggerStatement,
    context: Context,
  ) {
    context.runtime.break = true
  },

  VariableDeclaration: function (
    command: es.VariableDeclaration,
    context: Context,
    agenda: Agenda,
  ) {
    const declaration: es.VariableDeclarator = command.declarations[0]
    const id = declaration.id as es.Identifier

    // Parser enforces initialisation during variable declaration
    const init = declaration.init!

    agenda.push(instr.popInstr())
    agenda.push(instr.assignmentInstr(id.name, command.kind === 'const', true, command))
    agenda.push(init)
  },

  FunctionDeclaration: function (
    command: es.FunctionDeclaration,
    context: Context,
    agenda: Agenda
  ) {
    // Function declaration desugared into constant declaration.
    const lambdaExpression: es.ArrowFunctionExpression = ast.blockArrowFunction(
      command.params as es.Identifier[],
      command.body,
      command.loc
    )
    const lambdaDeclaration: es.VariableDeclaration = ast.constantDeclaration(
      command.id!.name,
      lambdaExpression,
      command.loc
    )
    agenda.push(lambdaDeclaration)
  },

  ReturnStatement: function (
    command: es.ReturnStatement,
    context: Context,
    agenda: Agenda,
  ) {
    // Push return argument onto agenda as well as Reset Instruction to clear to ignore all statements after the return.
    agenda.push(instr.resetInstr())
    if (command.argument) {
      agenda.push(command.argument)
    }
  },

  /**
   * Expressions
   */

  Literal: function (command: es.Literal, context: Context, agenda: Agenda, stash: Stash) {
    stash.push(command.value)
  },

  AssignmentExpression: function (
    command: es.AssignmentExpression,
    context: Context,
    agenda: Agenda,
  ) {
    if (command.left.type === 'MemberExpression') {
      agenda.push(instr.arrAssmtInstr())
      agenda.push(command.right)
      agenda.push(command.left.property)
      agenda.push(command.left.object)
    } else if (command.left.type === 'Identifier') {
      const id = command.left
      agenda.push(instr.assignmentInstr(id.name, false, false, command))
      agenda.push(command.right)
    }
  },

  ArrayExpression: function (
    command: es.ArrayExpression,
    context: Context,
    agenda: Agenda,
  ) {
    const elems = command.elements as ContiguousArrayElements
    const len = elems.length

    agenda.push(instr.arrLitInstr(len))
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
    agenda.push(instr.arrAccInstr())
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
    agenda.push(instr.unOpInstr(command.operator, command))
    agenda.push(command.argument)
  },

  BinaryExpression: function (command: es.BinaryExpression, context: Context, agenda: Agenda) {
    agenda.push(instr.binOpInstr(command.operator, command))
    agenda.push(command.right)
    agenda.push(command.left)
  },

  LogicalExpression: function (command: es.LogicalExpression, context: Context, agenda: Agenda) {
    if (command.operator === '&&') {
      agenda.push(
        ast.conditionalExpression(command.left, command.right, ast.literal(false), command.loc)
      )
    } else {
      agenda.push(
        ast.conditionalExpression(command.left, ast.literal(true), command.right, command.loc)
      )
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

  CallExpression: function (
    command: es.CallExpression,
    context: Context,
    agenda: Agenda,
  ) {
    // Push application instruction, function arguments and function onto agenda.
    agenda.push(instr.appInstr(command.arguments.length, command))
    for (let index = command.arguments.length - 1; index >= 0; index--) {
      agenda.push(command.arguments[index])
    }
    agenda.push(command.callee)
  },

  /**
   * Instructions
   */

  [InstrType.RESET]: function (command: Instr, context: Context, agenda: Agenda, stash: Stash) {
    // Keep pushing reset instructions until marker is found.
    const cmdNext: AgendaItem | undefined = agenda.pop()
    if (cmdNext && (isNode(cmdNext) || cmdNext.instrType !== InstrType.MARKER)) {
      agenda.push(instr.resetInstr())
    }
  },

  [InstrType.WHILE]: function (
    command: WhileInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const test = stash.pop()

    // Check if test condition is a boolean
    const error = rttc.checkIfStatement(command.srcNode, test, context.chapter)
    if (error) {
      handleRuntimeError(context, error)
    }

    if (test) {
      agenda.push(command)
      agenda.push(command.test)
      agenda.push(instr.pushUndefInstr()) // The loop returns undefined if the stash is empty
      agenda.push(command.body)
      agenda.push(instr.popInstr()) // Pop previous body value
    }
  },

  [InstrType.ASSIGNMENT]: function (
    command: AssmtInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    command.declaration
      ? defineVariable(
          context,
          command.symbol,
          stash.peek(),
          command.constant,
          command.srcNode as es.VariableDeclaration
        )
      : setVariable(
          context,
          command.symbol,
          stash.peek(),
          command.srcNode as es.AssignmentExpression
        )
  },

  [InstrType.UNARY_OP]: function (
    command: UnOpInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const argument = stash.pop()
    const error = rttc.checkUnaryExpression(
      command.srcNode,
      command.symbol as es.UnaryOperator,
      argument,
      context.chapter
    )
    if (error) {
      handleRuntimeError(context, error)
    }
    stash.push(evaluateUnaryExpression(command.symbol as es.UnaryOperator, argument))
  },

  [InstrType.BINARY_OP]: function (
    command: BinOpInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const right = stash.pop()
    const left = stash.pop()
    const error = rttc.checkBinaryExpression(
      command.srcNode,
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

  [InstrType.POP]: function (command: Instr, context: Context, agenda: Agenda, stash: Stash) {
    stash.pop()
  },

  [InstrType.APPLICATION]: function (
    command: AppInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    // Get function arguments from the stash
    const args: Value[] = []
    for (let index = 0; index < command.numOfArgs; index++) {
      args.unshift(stash.pop())
    }

    // Get function from the stash
    const func: Closure | Function = stash.pop()
    if (func instanceof Closure) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      // For User-defined and Pre-defined functions instruction to restore environment and marker for the reset instruction is required.
      const next = agenda.peek()
      if (!next || (!isNode(next) && next.instrType === InstrType.ENVIRONMENT)) {
        // Pushing another Env Instruction would be redundant so only Marker needs to be pushed.
        agenda.push(instr.markerInstr())
      } else if (!isNode(next) && next.instrType === InstrType.RESET) {
        // Reset Instruction will be replaced by Reset Instruction of new return statement.
        agenda.pop()
      } else {
        agenda.push(instr.envInstr(currentEnvironment(context)))
        agenda.push(instr.markerInstr())
      }

      // Push function body on agenda and create environment for function parameters.
      // Name the environment if the function call expression is not anonymous
      agenda.push(func.node.body)
      if (isIdentifier(command.srcNode.callee)) {
        const environment = createEnvironment(func, args, command.srcNode.callee.name)
        pushEnvironment(context, environment)
      } else {
        const environment = createEnvironment(func, args)
        pushEnvironment(context, environment)
      }
    } else if (typeof func === 'function') {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)
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
      handleRuntimeError(context, new errors.CallingNonFunctionValue(func, command.srcNode))
    }
  },

  [InstrType.BRANCH]: function (
    command: BranchInstr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const test = stash.pop()

    // Check if test condition is a boolean
    const error = rttc.checkIfStatement(command.srcNode, test, context.chapter)
    if (error) {
      handleRuntimeError(context, error)
    }

    if (test) {
      agenda.push(command.consequent)
    } else if (command.alternate) {
      agenda.push(command.alternate)
    }
  },

  [InstrType.ENVIRONMENT]: function (command: EnvInstr, context: Context) {
    // Restore environment
    while (currentEnvironment(context).id !== command.env.id) {
      popEnvironment(context)
    }
  },

  [InstrType.PUSH_UNDEFINED_IF_NEEDED]: function (
    command: Instr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    if (stash.size() === 0) {
      stash.push(undefined)
    }
  },

  [InstrType.ARRAY_LITERAL]: function (
    command: ArrLitInstr,
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

  [InstrType.ARRAY_ACCESS]: function (
    command: Instr,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    const index = stash.pop()
    const array = stash.pop()
    stash.push(array[index])
  },

  [InstrType.ARRAY_ASSIGNMENT]: function (
    command: Instr,
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

const handleRuntimeError = (context: Context, error: RuntimeSourceError) => {
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
  name?: string
): Environment => {
  const environment: Environment = {
    name: name ? name : closure.functionName, 
    tail: closure.environment,
    head: {},
    id: uniqueId()
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
  return [instr.branchInstr(node.consequent, node.alternate, node), node.test]
}
