/**
 * This interpreter implements an explicit-control evaluator, capable of transpiling
 * Source code to WGSL, enabling the use of WebGPU for specific module functions.
 *
 * Heavily adapted from '../ec-evaluator/interpreter'
 */

/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { uniqueId } from 'lodash'
import * as _ from 'lodash'

import * as constants from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import Closure from '../interpreter/closure'
import { initModuleContext, loadModuleBundle } from '../modules/loader/moduleLoader'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, ContiguousArrayElements, Result, Value } from '../types'
import * as ast from '../utils/ast/astCreator'
import * as create from '../utils/ast/astCreator'
import * as rttc from '../utils/rttc'
import * as instr from './instrCreator'
import { applySpecial, evaluateBinaryExpression, evaluateUnaryExpression } from './operations'
import {
  AgendaItem,
  AppInstr,
  ArrLitInstr,
  AssmtInstr,
  BinOpInstr,
  BranchInstr,
  CmdEvaluator,
  CombineInstr,
  ECEBreak,
  ECError,
  EnvInstr,
  ForInstr,
  Instr,
  InstrType,
  PlayInstr,
  ReservedParam,
  UnOpInstr,
  WhileInstr
} from './types'
import {
  checkNumberOfArguments,
  checkStackOverFlow,
  createBlockEnvironment,
  createEnvironment,
  currentEnvironment,
  declareFunctionsAndVariables,
  declareIdentifier,
  defineVariable,
  getVariable,
  handleRuntimeError,
  handleSequence,
  isAssmtInstr,
  isInstr,
  isNode,
  popEnvironment,
  pushEnvironment,
  reduceConditional,
  setVariable,
  Stack,
  toStringWGSL
} from './utils'
import { play_gpu } from './webgpu/play_gpu'

/**
 * The agenda is a list of commands that still needs to be executed by the machine.
 * It contains syntax tree nodes or instructions.
 */
export class Agenda extends Stack<AgendaItem> {
  public constructor(program: es.Program) {
    super()
    // Evaluation of last statement is undefined if stash is empty
    this.push(instr.pushUndefIfNeededInstr())

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
export async function evaluate(program: es.Program, context: Context): Promise<Value> {
  try {
    context.runtime.isRunning = true
    context.runtime.agenda_wgsl = new Agenda(program)
    context.runtime.stash_wgsl = new Stash()
    return await runECEMachine(context, context.runtime.agenda_wgsl, context.runtime.stash_wgsl)
  } catch (error) {
    return new ECError()
  } finally {
    context.runtime.isRunning = false
  }
}

/**
 * Function that is called when a user wishes to resume evaluation after
 * hitting a breakpoint.
 * This should only be called after the first 'evaluate' function has been called so that
 * context.runtime.agenda_wgsl and context.runtime.stash_wgsl are defined.
 * @param context The context to continue evaluating the program in.
 * @returns The result of running the ECE machine.
 */
export function resumeEvaluate(context: Context) {
  try {
    context.runtime.isRunning = true
    return runECEMachine(context, context.runtime.agenda_wgsl!, context.runtime.stash_wgsl!)
  } catch (error) {
    return new ECError()
  } finally {
    context.runtime.isRunning = false
  }
}

/**
 * Function that returns the appropriate Promise<Result> given the output of ec evaluating, depending
 * on whether the program is finished evaluating, ran into a breakpoint or ran into an error.
 * @param context The context of the program.
 * @param value The value of ec evaluating the program.
 * @returns The corresponding promise.
 */
export function ECEResultPromise(context: Context, value: Value): Promise<Result> {
  return new Promise((resolve, reject) => {
    if (value instanceof ECEBreak) {
      resolve({ status: 'suspended-cse-eval', context })
    } else if (value instanceof ECError) {
      resolve({ status: 'error' })
    } else {
      resolve({ status: 'finished', context, value })
    }
  })
}

/**
 *
 * @param context The context to evaluate the program in.
 * @param Agenda Points to the current context.runtime.Agenda
 * @param Stash Points to the current context.runtime.Stash
 * @returns A special break object if the program is interrupted by a break point;
 * else the top value of the Stash. It is usually the return value of the program.
 */
async function runECEMachine(context: Context, Agenda: Agenda, Stash: Stash) {
  context.runtime.break = false
  context.runtime.nodes = []
  initModuleContext('sound', context, false)
  let command = Agenda.pop()
  while (command) {
    if (isNode(command)) {
      context.runtime.nodes.unshift(command)
      checkEditorBreakpoints(context, command)
      await cmdEvaluators[command.type](command, context, Agenda, Stash)
      if (context.runtime.break && context.runtime.debuggerOn) {
        // We can put this under isNode since context.runtime.break
        // will only be updated after a debugger statement and so we will
        // run into a node immediately after.
        return new ECEBreak()
      }
      context.runtime.nodes.shift()
    } else {
      // Node is an instrucion
      await cmdEvaluators[command.instrType](command, context, Agenda, Stash)
    }
    command = Agenda.pop()
  }
  return Stash.peek()
}

/**
 * Dictionary of functions which handle the logic for the response of the three registers of
 * the ASE machine to each AgendaItem.
 */
const cmdEvaluators: { [type: string]: CmdEvaluator } = {
  /**
   * Statements
   */

  Program: async function (
    command: es.BlockStatement,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const environment = createBlockEnvironment(context, 'programEnvironment')
    // Push the environment only if it is non empty.
    if (declareFunctionsAndVariables(context, command, environment)) {
      pushEnvironment(context, environment)
    }
    // Push block body
    Agenda.push(...handleSequence(command.body))
  },

  BlockStatement: async function (command: es.BlockStatement, context: Context, Agenda: Agenda) {
    // To restore environment after block ends
    Agenda.push(instr.envInstr(currentEnvironment(context)))

    const environment = createBlockEnvironment(context, 'blockEnvironment')
    // Push the environment only if it is non empty.
    if (declareFunctionsAndVariables(context, command, environment)) {
      pushEnvironment(context, environment)
    }

    // Push block body
    Agenda.push(...handleSequence(command.body))
  },

  WhileStatement: async function (command: es.WhileStatement, context: Context, Agenda: Agenda) {
    Agenda.push(instr.breakMarkerInstr())
    Agenda.push(instr.whileInstr(command.test, command.body, command))
    Agenda.push(command.test)
    Agenda.push(ast.identifier('undefined')) // Return undefined if there is no loop execution
  },

  ForStatement: async function (command: es.ForStatement, context: Context, Agenda: Agenda) {
    // All 3 parts will be defined due to parser rules
    const init = command.init!
    const test = command.test!
    const update = command.update!

    // Loop control variable present
    // Refer to Source §3 specifications https://docs.sourceacademy.org/source_3.pdf
    if (init.type === 'VariableDeclaration' && init.kind === 'let') {
      const id = init.declarations[0].id as es.Identifier
      const valueExpression = init.declarations[0].init!

      Agenda.push(
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
      Agenda.push(instr.breakMarkerInstr())
      Agenda.push(instr.forInstr(init, test, update, command.body, command))
      Agenda.push(test)
      Agenda.push(instr.popInstr()) // Pop value from init assignment
      Agenda.push(init)
      Agenda.push(ast.identifier('undefined')) // Return undefined if there is no loop execution
    }
  },

  IfStatement: async function (
    command: es.IfStatement,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    Agenda.push(...reduceConditional(command))
  },

  ExpressionStatement: async function (
    command: es.ExpressionStatement,
    context: Context,
    Agenda: Agenda
  ) {
    Agenda.push(command.expression)
  },

  DebuggerStatement: async function (command: es.DebuggerStatement, context: Context) {
    context.runtime.break = true
  },

  VariableDeclaration: async function (
    command: es.VariableDeclaration,
    context: Context,
    Agenda: Agenda
  ) {
    const declaration: es.VariableDeclarator = command.declarations[0]
    const id = declaration.id as es.Identifier

    // Parser enforces initialisation during variable declaration
    const init = declaration.init!

    Agenda.push(instr.popInstr())
    Agenda.push(instr.assmtInstr(id.name, command.kind === 'const', true, command))
    Agenda.push(init)
  },

  FunctionDeclaration: async function (
    command: es.FunctionDeclaration,
    context: Context,
    Agenda: Agenda
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
    Agenda.push(lambdaDeclaration)
  },

  ReturnStatement: async function (command: es.ReturnStatement, context: Context, Agenda: Agenda) {
    // Push return argument onto Agenda as well as Reset Instruction to clear to ignore all statements after the return.
    Agenda.push(instr.resetInstr())
    if (command.argument) {
      Agenda.push(command.argument)
    }
  },

  ContinueStatement: async function (
    command: es.ContinueStatement,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    Agenda.push(instr.contInstr())
  },

  BreakStatement: async function (
    command: es.BreakStatement,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    Agenda.push(instr.breakInstr())
  },

  /**
   * Expressions
   */

  Literal: async function (command: es.Literal, context: Context, Agenda: Agenda, Stash: Stash) {
    Stash.push(command.value)
  },

  AssignmentExpression: async function (
    command: es.AssignmentExpression,
    context: Context,
    Agenda: Agenda
  ) {
    if (command.left.type === 'MemberExpression') {
      Agenda.push(instr.arrAssmtInstr())
      Agenda.push(command.right)
      Agenda.push(command.left.property)
      Agenda.push(command.left.object)
    } else if (command.left.type === 'Identifier') {
      const id = command.left
      Agenda.push(instr.assmtInstr(id.name, false, false, command))
      Agenda.push(command.right)
    }
  },

  ArrayExpression: async function (command: es.ArrayExpression, context: Context, Agenda: Agenda) {
    const elems = command.elements as ContiguousArrayElements
    const len = elems.length

    Agenda.push(instr.arrLitInstr(len))
    for (const elem of elems) {
      Agenda.push(elem)
    }
  },

  MemberExpression: async function (
    command: es.MemberExpression,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    Agenda.push(instr.arrAccInstr())
    Agenda.push(command.property)
    Agenda.push(command.object)
  },

  ConditionalExpression: async function (
    command: es.ConditionalExpression,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    Agenda.push(...reduceConditional(command))
  },

  Identifier: async function (
    command: es.Identifier,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    Stash.push(getVariable(context, command.name, command))
  },

  UnaryExpression: async function (command: es.UnaryExpression, context: Context, Agenda: Agenda) {
    Agenda.push(instr.unOpInstr(command.operator, command))
    Agenda.push(command.argument)
  },

  BinaryExpression: async function (
    command: es.BinaryExpression,
    context: Context,
    Agenda: Agenda
  ) {
    Agenda.push(instr.binOpInstr(command.operator, command))
    Agenda.push(command.right)
    Agenda.push(command.left)
  },

  LogicalExpression: async function (
    command: es.LogicalExpression,
    context: Context,
    Agenda: Agenda
  ) {
    if (command.operator === '&&') {
      Agenda.push(
        ast.conditionalExpression(command.left, command.right, ast.literal(false), command.loc)
      )
    } else {
      Agenda.push(
        ast.conditionalExpression(command.left, ast.literal(true), command.right, command.loc)
      )
    }
  },

  ArrowFunctionExpression: async function (
    command: es.ArrowFunctionExpression,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    // Reuses the Closure data structure from legacy interpreter
    const closure: Closure = Closure.makeFromArrowFunction(
      command,
      currentEnvironment(context),
      context,
      true
    )
    const next = Agenda.peek()
    if (!(next && isInstr(next) && isAssmtInstr(next))) {
      if (closure instanceof Closure) {
        Object.defineProperty(currentEnvironment(context).head, uniqueId(), {
          value: closure,
          writable: false,
          enumerable: true
        })
      }
    }
    Stash.push(closure)
  },

  CallExpression: async function (command: es.CallExpression, context: Context, Agenda: Agenda) {
    // Push application instruction, function arguments and function onto Agenda.
    Agenda.push(instr.appInstr(command.arguments.length, command))
    for (let index = command.arguments.length - 1; index >= 0; index--) {
      Agenda.push(command.arguments[index])
    }
    Agenda.push(command.callee)
  },

  /**
   * Instructions
   */

  [InstrType.RESET]: async function (
    command: Instr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    // Keep pushing reset instructions until marker is found.
    const cmdNext: AgendaItem | undefined = Agenda.pop()
    if (cmdNext && (isNode(cmdNext) || cmdNext.instrType !== InstrType.MARKER)) {
      Agenda.push(instr.resetInstr())
    }
  },

  [InstrType.WHILE]: async function (
    command: WhileInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const test = Stash.pop()

    // Check if test condition is a boolean
    const error = rttc.checkIfStatement(command.srcNode, test, context.chapter)
    if (error) {
      handleRuntimeError(context, error)
    }

    if (test) {
      Agenda.push(command)
      Agenda.push(command.test)
      Agenda.push(instr.contMarkerInstr())
      Agenda.push(instr.pushUndefIfNeededInstr()) // The loop returns undefined if the Stash is empty
      Agenda.push(command.body)
      Agenda.push(instr.popInstr()) // Pop previous body value
    }
  },

  [InstrType.FOR]: async function (
    command: ForInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const test = Stash.pop()

    // Check if test condition is a boolean
    const error = rttc.checkIfStatement(command.srcNode, test, context.chapter)
    if (error) {
      handleRuntimeError(context, error)
    }

    if (test) {
      Agenda.push(command)
      Agenda.push(command.test)
      Agenda.push(instr.popInstr()) // Pop value from update
      Agenda.push(command.update)
      Agenda.push(instr.contMarkerInstr())
      Agenda.push(instr.pushUndefIfNeededInstr()) // The loop returns undefined if the Stash is empty
      Agenda.push(command.body)
      Agenda.push(instr.popInstr()) // Pop previous body value
    }
  },

  [InstrType.ASSIGNMENT]: async function (
    command: AssmtInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    command.declaration
      ? defineVariable(
          context,
          command.symbol,
          Stash.peek(),
          command.constant,
          command.srcNode as es.VariableDeclaration
        )
      : setVariable(
          context,
          command.symbol,
          Stash.peek(),
          command.srcNode as es.AssignmentExpression
        )
  },

  [InstrType.UNARY_OP]: async function (
    command: UnOpInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const argument = Stash.pop()
    if (!(argument instanceof ReservedParam)) {
      const error = rttc.checkUnaryExpression(
        command.srcNode,
        command.symbol as es.UnaryOperator,
        argument,
        context.chapter
      )
      if (error) {
        handleRuntimeError(context, error)
      }
    }
    Stash.push(evaluateUnaryExpression(command.symbol as es.UnaryOperator, argument))
  },

  [InstrType.BINARY_OP]: async function (
    command: BinOpInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const right = Stash.pop()
    const left = Stash.pop()
    if (!(left instanceof ReservedParam || right instanceof ReservedParam)) {
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
    }
    Stash.push(evaluateBinaryExpression(command.symbol as es.BinaryOperator, left, right))
  },

  [InstrType.POP]: async function (command: Instr, context: Context, Agenda: Agenda, Stash: Stash) {
    Stash.pop()
  },

  [InstrType.APPLICATION]: async function (
    command: AppInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    checkStackOverFlow(context, Agenda)
    // Get function arguments from the Stash
    const args: Value[] = []
    let isSepecial: boolean = false
    for (let index = 0; index < command.numOfArgs; index++) {
      const arg = Stash.pop()
      // Check whether current application is in a WGSL transpiling process
      if (arg instanceof ReservedParam) {
        isSepecial = true
      }
      args.unshift(arg)
    }
    // Get function from the Stash
    const func: Closure | Function = Stash.pop()
    if (func instanceof Closure) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      // For User-defined and Pre-defined functions instruction to restore environment and marker for the reset instruction is required.
      const next = Agenda.peek()
      if (!next || (!isNode(next) && next.instrType === InstrType.ENVIRONMENT)) {
        // Pushing another Env Instruction would be redundant so only Marker needs to be pushed.
        Agenda.push(instr.markerInstr())
      } else if (!isNode(next) && next.instrType === InstrType.RESET) {
        // Reset Instruction will be replaced by Reset Instruction of new return statement.
        Agenda.pop()
      } else {
        Agenda.push(instr.envInstr(currentEnvironment(context)))
        Agenda.push(instr.markerInstr())
      }

      // Push function body on Agenda and create environment for function parameters.
      // Name the environment if the function call expression is not anonymous
      Agenda.push(func.node.body)
      const environment = createEnvironment(func, args, command.srcNode)
      pushEnvironment(context, environment)
    } else if (typeof func === 'function') {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)
      // Directly Stash result of applying pre-built functions without the ASE machine.
      try {
        if (isSepecial) {
          if (func.name == 'is_null') {
            // Calling `is_null` function on a ReservedParam will cause an infinite loop
            reevaluate(
              context,
              Agenda,
              Stash,
              ' This issue may be due to certain built-in functions (e.g. list) being incompatible with the parameters of the wave function.'
            )
          } else {
            const result = applySpecial(func.name, args)
            Stash.push(result)
          }
        } else {
          const result = func(...args)
          Stash.push(result)
        }
      } catch (error) {
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

  [InstrType.BRANCH]: async function (
    command: BranchInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const test = Stash.pop()
    if (test instanceof ReservedParam) {
      // It is in a WGSL transpiling process and the condition involves `ReservedParam`
      Stash.push(test)
      if (command.consequent.type == 'BlockStatement') {
        Agenda.push(instr.resetInstr())
      }
      Agenda.push(instr.combineInstr('select'))
      // Evaluate both the alternative and the consequent
      if (command.alternate) {
        if (command.alternate.type == 'BlockStatement' || command.alternate.type == 'IfStatement') {
          Agenda.push(instr.markerInstr())
        }
        Agenda.push(command.alternate)
      }
      if (command.consequent.type == 'BlockStatement') {
        Agenda.push(instr.markerInstr())
      }
      Agenda.push(command.consequent)
    } else {
      // Check if test condition is a boolean
      const error = rttc.checkIfStatement(command.srcNode, test, context.chapter)
      if (error) {
        handleRuntimeError(context, error)
      }

      if (test) {
        Agenda.push(command.consequent)
      } else if (command.alternate) {
        Agenda.push(command.alternate)
      }
    }
  },

  [InstrType.ENVIRONMENT]: async function (command: EnvInstr, context: Context) {
    // Restore environment
    while (currentEnvironment(context).id !== command.env.id) {
      popEnvironment(context)
    }
  },

  [InstrType.PUSH_UNDEFINED_IF_NEEDED]: async function (
    command: Instr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    if (Stash.size() === 0) {
      Stash.push(undefined)
    }
  },

  [InstrType.ARRAY_LITERAL]: async function (
    command: ArrLitInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const arity = command.arity!
    const array = []
    for (let i = 0; i < arity; ++i) {
      array.push(Stash.pop())
    }
    Stash.push(array)
  },

  [InstrType.ARRAY_ACCESS]: async function (
    command: Instr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const index = Stash.pop()
    const array = Stash.pop()
    Stash.push(array[index])
  },

  [InstrType.ARRAY_ASSIGNMENT]: async function (
    command: Instr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const value = Stash.pop()
    const index = Stash.pop()
    const array = Stash.pop()
    array[index] = value
    Stash.push(value)
  },

  [InstrType.CONTINUE]: async function (
    command: Instr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const next = Agenda.pop() as AgendaItem
    if (isInstr(next) && next.instrType == InstrType.CONTINUE_MARKER) {
      // Encountered continue mark, stop popping
    } else if (isInstr(next) && next.instrType == InstrType.ENVIRONMENT) {
      Agenda.push(command)
      Agenda.push(next) // Let instruction evaluate to restore env
    } else {
      // Continue popping from Agenda by pushing same instruction on Agenda
      Agenda.push(command)
    }
  },

  [InstrType.CONTINUE_MARKER]: async function () {},

  [InstrType.BREAK]: async function (
    command: Instr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const next = Agenda.pop() as AgendaItem
    if (isInstr(next) && next.instrType == InstrType.BREAK_MARKER) {
      // Encountered break mark, stop popping
    } else if (isInstr(next) && next.instrType == InstrType.ENVIRONMENT) {
      Agenda.push(command)
      Agenda.push(next) // Let instruction evaluate to restore env
    } else {
      // Continue popping from Agenda by pushing same instruction on Agenda
      Agenda.push(command)
    }
  },

  [InstrType.BREAK_MARKER]: async function () {},

  [InstrType.PLAY]: async function (
    command: PlayInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    const code = Stash.pop()
    let codeStr = ''
    if (code instanceof ReservedParam) {
      codeStr = code.value
    } else {
      // Code is a constant number
      codeStr = String(code)
    }
    let rawChannel: number[]
    let time, numCore: number
    try {
      // Call WebGPU API
      ;[time, numCore, rawChannel] = await play_gpu(command.length, command.frequency, codeStr)
      const audioplayer = new window.AudioContext()

      // Create mono buffer
      const theBuffer = audioplayer.createBuffer(
        1,
        Math.ceil(command.frequency * command.length),
        command.frequency
      )
      const channel = theBuffer.getChannelData(0)

      for (let i = 0; i < channel.length; i += 1) {
        channel[i] = rawChannel[i]
      }

      // Connect data to output destination
      const source = audioplayer.createBufferSource()
      source.buffer = theBuffer
      source.connect(audioplayer.destination)
      source.start()
      source.onended = () => {
        source.disconnect(audioplayer.destination)
      }

      Agenda.push(
        create.callExpression(create.identifier('display'), [
          create.literal(
            'Successfully processed a sound using ' +
              numCore +
              ' GPU cores. Total computation time: ' +
              time.toFixed(2) +
              ' ms. Audio played.'
          )
        ])
      )
    } catch (error) {
      reevaluate(context, Agenda, Stash)
    }
  },

  [InstrType.COMBINE]: async function (
    command: CombineInstr,
    context: Context,
    Agenda: Agenda,
    Stash: Stash
  ) {
    // `COMBINE` is the special instruction to combine the condition, consequence and
    // alternative into a call expression on `select` in WGSL
    if (command.connector == 'select') {
      const first = Stash.pop() // The consequence
      const second = Stash.pop() // The alternative
      const third = Stash.pop() // The condition
      Stash.push(
        new ReservedParam(
          'select(' +
            toStringWGSL(first) +
            ',' +
            toStringWGSL(second) +
            ',' +
            toStringWGSL(third) +
            ')'
        )
      )
    }
  }
}

/**
 * Function importing module functions in the `sound` module into the current environment.
 */
function importSoundModule(context: Context) {
  const environment = currentEnvironment(context)
  initModuleContext('sound', context, true)
  const functions = loadModuleBundle('sound', context, create.identifier(''))
  const fakeNode = create.declaration('soundFunc', 'const', create.identifier(''))
  for (const functionName in functions) {
    declareIdentifier(context, functionName, create.identifier(''), environment)
    defineVariable(context, functionName, functions[functionName], true, fakeNode)
  }
}

/**
 * Function for initializing and triggering a reevaluation of the program
 * using imported sound functions.
 * Activated only when a WebGPU execution attempt fails.
 */
function reevaluate(context: Context, Agenda: Agenda, Stash: Stash, errorMsg = '') {
  while (currentEnvironment(context).name !== 'global') {
    popEnvironment(context)
  }
  const environment = createBlockEnvironment(context, 'soundEnvironment')
  pushEnvironment(context, environment)
  Agenda.reset()
  Stash.reset()
  importSoundModule(context)
  Agenda.push(context.previousPrograms[0])
  Agenda.push(
    create.callExpression(create.identifier('display'), [
      create.literal(
        'The attempt to process the audio using the GPU was unsuccessful. Automatically retry using the CPU.' +
          errorMsg
      )
    ])
  )
}
