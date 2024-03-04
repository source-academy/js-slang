/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 * and the legacy interpreter at '../interpreter/interpreter'
 */

/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { reverse, uniqueId } from 'lodash'

import { IOptions } from '..'
import { UNKNOWN_LOCATION } from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import Closure from '../interpreter/closure'
import { UndefinedImportError } from '../modules/errors'
import { initModuleContext, loadModuleBundle } from '../modules/moduleLoader'
import { ImportTransformOptions } from '../modules/moduleTypes'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { checkProgramForUndefinedVariables } from '../transpiler/transpiler'
import { Context, ContiguousArrayElements, RawBlockStatement, Result, Value } from '../types'
import assert from '../utils/assert'
import { filterImportDeclarations } from '../utils/ast/helpers'
import * as ast from '../utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import {
  Continuation,
  getContinuationControl,
  getContinuationEnv,
  getContinuationStash,
  isCallWithCurrentContinuation,
  isContinuation,
  makeContinuation,
  makeDummyContCallExpression
} from './continuations'
import * as instr from './instrCreator'
import {
  AppInstr,
  ArrLitInstr,
  AssmtInstr,
  BinOpInstr,
  BranchInstr,
  ControlItem,
  CSEBreak,
  CseError,
  EnvInstr,
  ForInstr,
  Instr,
  InstrType,
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
  hasBreakStatement,
  hasContinueStatement,
  hasDeclarations,
  hasImportDeclarations,
  isAssmtInstr,
  isBlockStatement,
  isInstr,
  isNode,
  isRawBlockStatement,
  isSimpleFunction,
  popEnvironment,
  pushEnvironment,
  reduceConditional,
  setVariable,
  Stack,
  valueProducing
} from './utils'

type CmdEvaluator = (
  command: ControlItem,
  context: Context,
  control: Control,
  stash: Stash,
  isPrelude: boolean
) => void

/**
 * The control is a list of commands that still needs to be executed by the machine.
 * It contains syntax tree nodes or instructions.
 */
export class Control extends Stack<ControlItem> {
  public constructor(program?: es.Program) {
    super()

    // Load program into control stack
    program ? this.push(program) : null
  }

  public push(...items: ControlItem[]): void {
    const itemsNew: ControlItem[] = Control.simplifyBlocksWithoutDeclarations(...items)
    super.push(...itemsNew)
  }

  /**
   * Before pushing block statements on the control stack, we check if the block statement has any declarations.
   * If not (and its not a raw block statement), instead of pushing the entire block, just the body is pushed since the block is not adding any value.
   * @param items The items being pushed on the control.
   * @returns The same set of control items, but with block statements without declarations simplified.
   */
  private static simplifyBlocksWithoutDeclarations(...items: ControlItem[]): ControlItem[] {
    const itemsNew: ControlItem[] = []
    items.forEach(item => {
      if (
        isNode(item) &&
        isBlockStatement(item) &&
        !hasDeclarations(item) &&
        !isRawBlockStatement(item)
      ) {
        itemsNew.push(...Control.simplifyBlocksWithoutDeclarations(...handleSequence(item.body)))
      } else {
        itemsNew.push(item)
      }
    })
    return itemsNew
  }

  public copy(): Control {
    const newControl = new Control()
    const stackCopy = super.getStack()
    newControl.push(...stackCopy)
    return newControl
  }
}

/**
 * The stash is a list of values that stores intermediate results.
 */
export class Stash extends Stack<Value> {
  public constructor() {
    super()
  }

  public copy(): Stash {
    const newStash = new Stash()
    const stackCopy = super.getStack()
    newStash.push(...stackCopy)
    return newStash
  }
}

/**
 * Function to be called when a program is to be interpreted using
 * the explicit control evaluator.
 *
 * @param program The program to evaluate.
 * @param context The context to evaluate the program in.
 * @returns The result of running the CSE machine.
 */
export function evaluate(program: es.Program, context: Context, options: IOptions): Value {
  try {
    checkProgramForUndefinedVariables(program, context)
  } catch (error) {
    context.errors.push(error)
    return new CseError(error)
  }

  try {
    context.runtime.isRunning = true
    context.runtime.control = new Control(program)
    context.runtime.stash = new Stash()
    return runCSEMachine(
      context,
      context.runtime.control,
      context.runtime.stash,
      options.envSteps,
      options.stepLimit,
      options.isPrelude
    )
  } catch (error) {
    return new CseError(error)
  } finally {
    context.runtime.isRunning = false
  }
}

/**
 * Function that is called when a user wishes to resume evaluation after
 * hitting a breakpoint.
 * This should only be called after the first 'evaluate' function has been called so that
 * context.runtime.control and context.runtime.stash are defined.
 * @param context The context to continue evaluating the program in.
 * @returns The result of running the CSE machine.
 */
export function resumeEvaluate(context: Context) {
  try {
    context.runtime.isRunning = true
    return runCSEMachine(context, context.runtime.control!, context.runtime.stash!, -1, -1)
  } catch (error) {
    return new CseError(error)
  } finally {
    context.runtime.isRunning = false
  }
}

function evaluateImports(
  program: es.Program,
  context: Context,
  { loadTabs, checkImports }: ImportTransformOptions
) {
  try {
    const [importNodeMap] = filterImportDeclarations(program)

    const environment = currentEnvironment(context)
    Object.entries(importNodeMap).forEach(([moduleName, nodes]) => {
      initModuleContext(moduleName, context, loadTabs)
      const functions = loadModuleBundle(moduleName, context, nodes[0])
      for (const node of nodes) {
        for (const spec of node.specifiers) {
          assert(
            spec.type === 'ImportSpecifier',
            `Only ImportSpecifiers are supported, got: ${spec.type}`
          )

          if (checkImports && !(spec.imported.name in functions)) {
            throw new UndefinedImportError(spec.imported.name, moduleName, spec)
          }

          declareIdentifier(context, spec.local.name, node, environment)
          defineVariable(context, spec.local.name, functions[spec.imported.name], true, node)
        }
      }
    })
  } catch (error) {
    handleRuntimeError(context, error)
  }
}

/**
 * Function that returns the appropriate Promise<Result> given the output of CSE machine evaluating, depending
 * on whether the program is finished evaluating, ran into a breakpoint or ran into an error.
 * @param context The context of the program.
 * @param value The value of CSE machine evaluating the program.
 * @returns The corresponding promise.
 */
export function CSEResultPromise(context: Context, value: Value): Promise<Result> {
  return new Promise((resolve, reject) => {
    if (value instanceof CSEBreak) {
      resolve({ status: 'suspended-cse-eval', context })
    } else if (value instanceof CseError) {
      resolve({ status: 'error' })
    } else {
      resolve({ status: 'finished', context, value })
    }
  })
}

/**
 * The primary runner/loop of the explicit control evaluator.
 *
 * @param context The context to evaluate the program in.
 * @param control Points to the current context.runtime.control
 * @param stash Points to the current context.runtime.stash
 * @param isPrelude Whether the program we are running is the prelude
 * @returns A special break object if the program is interrupted by a breakpoint;
 * else the top value of the stash. It is usually the return value of the program.
 */
function runCSEMachine(
  context: Context,
  control: Control,
  stash: Stash,
  envSteps: number,
  stepLimit: number,
  isPrelude: boolean = false
) {
  context.runtime.break = false
  context.runtime.nodes = []
  let steps = 1

  let command = control.peek()

  // First node will be a Program
  context.runtime.nodes.unshift(command as es.Program)

  while (command) {
    // Return to capture a snapshot of the control and stash after the target step count is reached
    if (!isPrelude && steps === envSteps) {
      return stash.peek()
    }
    // Step limit reached, stop further evaluation
    if (!isPrelude && steps === stepLimit) {
      break
    }

    if (isNode(command) && command.type === 'DebuggerStatement') {
      // steps += 1

      // Record debugger step if running for the first time
      if (envSteps === -1) {
        context.runtime.breakpointSteps.push(steps)
      }
    }

    control.pop()
    if (isNode(command)) {
      context.runtime.nodes.shift()
      context.runtime.nodes.unshift(command)
      checkEditorBreakpoints(context, command)
      cmdEvaluators[command.type](command, context, control, stash, isPrelude)
      if (context.runtime.break && context.runtime.debuggerOn) {
        // We can put this under isNode since context.runtime.break
        // will only be updated after a debugger statement and so we will
        // run into a node immediately after.
        // With the new evaluator, we don't return a break
        // return new CSEBreak()
      }
    } else {
      // Command is an instruction
      cmdEvaluators[command.instrType](command, context, control, stash, isPrelude)
    }

    // Push undefined into the stack if both control and stash is empty
    if (control.isEmpty() && stash.isEmpty()) {
      stash.push(undefined)
    }
    command = control.peek()

    steps += 1
  }

  if (!isPrelude) {
    context.runtime.envStepsTotal = steps
  }
  return stash.peek()
}

/**
 * Dictionary of functions which handle the logic for the response of the three registers of
 * the ASE machine to each ControlItem.
 */
const cmdEvaluators: { [type: string]: CmdEvaluator } = {
  /**
   * Statements
   */

  Program: function (
    command: es.BlockStatement,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    // Create and push the environment only if it is non empty.
    if (hasDeclarations(command) || hasImportDeclarations(command)) {
      const environment = createBlockEnvironment(context, 'programEnvironment')
      pushEnvironment(context, environment)
      evaluateImports(command as unknown as es.Program, context, {
        wrapSourceModules: true,
        checkImports: true,
        loadTabs: true
      })
      declareFunctionsAndVariables(context, command, environment)
    }

    if (command.body.length == 1) {
      // If program only consists of one statement, evaluate it immediately
      const next = command.body[0]
      cmdEvaluators[next.type](next, context, control, stash, isPrelude)
    } else {
      // Push raw block statement
      const rawCopy: RawBlockStatement = {
        type: 'BlockStatement',
        range: command.range,
        loc: command.loc,
        body: command.body,
        isRawBlock: 'true'
      }
      control.push(rawCopy)
    }
  },

  BlockStatement: function (command: es.BlockStatement, context: Context, control: Control) {
    if (isRawBlockStatement(command)) {
      // Raw block statement: unpack and push body
      // Push block body only
      control.push(...handleSequence(command.body))
      return
    }
    // Normal block statement: do environment setup
    // To restore environment after block ends
    // If there is an env instruction on top of the stack, or if there are no declarations, or there is no next control item
    // we do not need to push another one
    // The no declarations case is handled by Control :: simplifyBlocksWithoutDeclarations, so no blockStatement node
    // without declarations should end up here.
    const next = control.peek()
    // Push ENVIRONMENT instruction if needed
    if (next && !(isInstr(next) && next.instrType === InstrType.ENVIRONMENT)) {
      control.push(instr.envInstr(currentEnvironment(context), command))
    }

    const environment = createBlockEnvironment(context, 'blockEnvironment')
    declareFunctionsAndVariables(context, command, environment)
    pushEnvironment(context, environment)

    // Push raw block statement
    const rawCopy: RawBlockStatement = {
      type: 'BlockStatement',
      range: command.range,
      loc: command.loc,
      body: command.body,
      isRawBlock: 'true'
    }
    control.push(rawCopy)
  },

  WhileStatement: function (
    command: es.WhileStatement,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    if (hasBreakStatement(command.body as es.BlockStatement)) {
      control.push(instr.breakMarkerInstr(command))
    }
    control.push(instr.whileInstr(command.test, command.body, command))
    control.push(command.test)
    control.push(ast.identifier('undefined', command.loc)) // Return undefined if there is no loop execution
  },

  ForStatement: function (command: es.ForStatement, context: Context, control: Control) {
    // All 3 parts will be defined due to parser rules
    const init = command.init!
    const test = command.test!
    const update = command.update!

    // Loop control variable present
    // Refer to Source §3 specifications https://docs.sourceacademy.org/source_3.pdf
    if (init.type === 'VariableDeclaration' && init.kind === 'let') {
      const id = init.declarations[0].id as es.Identifier
      const valueExpression = init.declarations[0].init!

      control.push(
        ast.blockStatement(
          [
            init,
            ast.forStatement(
              ast.assignmentExpression(id, valueExpression, command.loc),
              test,
              update,
              ast.blockStatement(
                [
                  ast.variableDeclaration(
                    [
                      ast.variableDeclarator(
                        ast.identifier(`_copy_of_${id.name}`, command.loc),
                        ast.identifier(id.name, command.loc),
                        command.loc
                      )
                    ],
                    command.loc
                  ),
                  ast.blockStatement(
                    [
                      ast.variableDeclaration(
                        [
                          ast.variableDeclarator(
                            ast.identifier(id.name, command.loc),
                            ast.identifier(`_copy_of_${id.name}`, command.loc),
                            command.loc
                          )
                        ],
                        command.loc
                      ),
                      command.body
                    ],
                    command.loc
                  )
                ],
                command.loc
              ),
              command.loc
            )
          ],
          command.loc
        )
      )
    } else {
      if (hasBreakStatement(command.body as es.BlockStatement)) {
        control.push(instr.breakMarkerInstr(command))
      }
      control.push(instr.forInstr(init, test, update, command.body, command))
      control.push(test)
      control.push(instr.popInstr(command)) // Pop value from init assignment
      control.push(init)
      control.push(ast.identifier('undefined', command.loc)) // Return undefined if there is no loop execution
    }
  },

  IfStatement: function (
    command: es.IfStatement,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    control.push(...reduceConditional(command))
  },

  ExpressionStatement: function (
    command: es.ExpressionStatement,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    // Fast forward to the expression
    // If not the next step will look like it's only removing ';'
    cmdEvaluators[command.expression.type](command.expression, context, control, stash, isPrelude)
  },

  DebuggerStatement: function (command: es.DebuggerStatement, context: Context) {
    context.runtime.break = true
  },

  VariableDeclaration: function (
    command: es.VariableDeclaration,
    context: Context,
    control: Control
  ) {
    const declaration: es.VariableDeclarator = command.declarations[0]
    const id = declaration.id as es.Identifier

    // Parser enforces initialisation during variable declaration
    const init = declaration.init!

    control.push(instr.popInstr(command))
    control.push(instr.assmtInstr(id.name, command.kind === 'const', true, command))
    control.push(init)
  },

  FunctionDeclaration: function (
    command: es.FunctionDeclaration,
    context: Context,
    control: Control
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
    control.push(lambdaDeclaration)
  },

  ReturnStatement: function (command: es.ReturnStatement, context: Context, control: Control) {
    // Push return argument onto control as well as Reset Instruction to clear to ignore all statements after the return.
    const next = control.peek()
    if (next && isInstr(next) && next.instrType === InstrType.MARKER) {
      control.pop()
    } else {
      control.push(instr.resetInstr(command))
    }
    if (command.argument) {
      control.push(command.argument)
    }
  },

  ContinueStatement: function (
    command: es.ContinueStatement,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    control.push(instr.contInstr(command))
  },

  BreakStatement: function (
    command: es.BreakStatement,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    control.push(instr.breakInstr(command))
  },

  ImportDeclaration: function () {},

  /**
   * Expressions
   */

  Literal: function (command: es.Literal, context: Context, control: Control, stash: Stash) {
    stash.push(command.value)
  },

  AssignmentExpression: function (
    command: es.AssignmentExpression,
    context: Context,
    control: Control
  ) {
    if (command.left.type === 'MemberExpression') {
      control.push(instr.arrAssmtInstr(command))
      control.push(command.right)
      control.push(command.left.property)
      control.push(command.left.object)
    } else if (command.left.type === 'Identifier') {
      const id = command.left
      control.push(instr.assmtInstr(id.name, false, false, command))
      control.push(command.right)
    }
  },

  ArrayExpression: function (command: es.ArrayExpression, context: Context, control: Control) {
    const elems = command.elements as ContiguousArrayElements
    reverse(elems)
    const len = elems.length

    control.push(instr.arrLitInstr(len, command))
    for (const elem of elems) {
      control.push(elem)
    }
  },

  MemberExpression: function (
    command: es.MemberExpression,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    control.push(instr.arrAccInstr(command))
    control.push(command.property)
    control.push(command.object)
  },

  ConditionalExpression: function (
    command: es.ConditionalExpression,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    control.push(...reduceConditional(command))
  },

  Identifier: function (command: es.Identifier, context: Context, control: Control, stash: Stash) {
    stash.push(getVariable(context, command.name, command))
  },

  UnaryExpression: function (command: es.UnaryExpression, context: Context, control: Control) {
    control.push(instr.unOpInstr(command.operator, command))
    control.push(command.argument)
  },

  BinaryExpression: function (command: es.BinaryExpression, context: Context, control: Control) {
    control.push(instr.binOpInstr(command.operator, command))
    control.push(command.right)
    control.push(command.left)
  },

  LogicalExpression: function (command: es.LogicalExpression, context: Context, control: Control) {
    if (command.operator === '&&') {
      control.push(
        ast.conditionalExpression(command.left, command.right, ast.literal(false), command.loc)
      )
    } else {
      control.push(
        ast.conditionalExpression(command.left, ast.literal(true), command.right, command.loc)
      )
    }
  },

  ArrowFunctionExpression: function (
    command: es.ArrowFunctionExpression,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    // Reuses the Closure data structure from legacy interpreter
    const closure: Closure = Closure.makeFromArrowFunction(
      command,
      currentEnvironment(context),
      context,
      true,
      isPrelude
    )
    const next = control.peek()
    if (!(next && isInstr(next) && isAssmtInstr(next))) {
      Object.defineProperty(currentEnvironment(context).head, uniqueId(), {
        value: closure,
        writable: false,
        enumerable: true
      })
    }
    stash.push(closure)
  },

  CallExpression: function (command: es.CallExpression, context: Context, control: Control) {
    // Push application instruction, function arguments and function onto control.
    control.push(instr.appInstr(command.arguments.length, command))
    for (let index = command.arguments.length - 1; index >= 0; index--) {
      control.push(command.arguments[index])
    }
    control.push(command.callee)
  },

  /**
   * Instructions
   */

  [InstrType.RESET]: function (command: Instr, context: Context, control: Control, stash: Stash) {
    // Keep pushing reset instructions until marker is found.
    const cmdNext: ControlItem | undefined = control.pop()
    if (cmdNext && (isNode(cmdNext) || cmdNext.instrType !== InstrType.MARKER)) {
      control.push(instr.resetInstr(command.srcNode))
    }
  },

  [InstrType.WHILE]: function (
    command: WhileInstr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const test = stash.pop()

    // Check if test condition is a boolean
    const error = rttc.checkIfStatement(command.srcNode, test, context.chapter)
    if (error) {
      handleRuntimeError(context, error)
    }

    if (test) {
      control.push(command)
      control.push(command.test)
      if (hasContinueStatement(command.body as es.BlockStatement)) {
        control.push(instr.contMarkerInstr(command.srcNode))
      }
      if (!valueProducing(command.body)) {
        // if loop body is not value-producing, insert undefined expression statement
        control.push(ast.identifier('undefined', command.body.loc))
      }
      control.push(command.body)
      control.push(instr.popInstr(command.srcNode)) // Pop previous body value
    }
  },

  [InstrType.FOR]: function (command: ForInstr, context: Context, control: Control, stash: Stash) {
    const test = stash.pop()

    // Check if test condition is a boolean
    const error = rttc.checkIfStatement(command.srcNode, test, context.chapter)
    if (error) {
      handleRuntimeError(context, error)
    }

    if (test) {
      control.push(command)
      control.push(command.test)
      control.push(instr.popInstr(command.srcNode)) // Pop value from update
      control.push(command.update)
      if (hasContinueStatement(command.body as es.BlockStatement)) {
        control.push(instr.contMarkerInstr(command.srcNode))
      }
      if (!valueProducing(command.body)) {
        // if loop body is not value-producing, insert undefined expression statement
        control.push(ast.identifier('undefined', command.body.loc))
      }
      control.push(command.body)
      control.push(instr.popInstr(command.srcNode)) // Pop previous body value
    }
  },

  [InstrType.ASSIGNMENT]: function (
    command: AssmtInstr,
    context: Context,
    control: Control,
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
    control: Control,
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
    control: Control,
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

  [InstrType.POP]: function (command: Instr, context: Context, control: Control, stash: Stash) {
    stash.pop()
  },

  [InstrType.APPLICATION]: function (
    command: AppInstr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    checkStackOverFlow(context, control)
    // Get function arguments from the stash
    const args: Value[] = []
    for (let index = 0; index < command.numOfArgs; index++) {
      args.unshift(stash.pop())
    }

    // Get function from the stash
    const func: Closure | Function = stash.pop()

    if (!(func instanceof Closure || func instanceof Function)) {
      handleRuntimeError(context, new errors.CallingNonFunctionValue(func, command.srcNode))
    }

    if (isCallWithCurrentContinuation(func)) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      // Get the callee
      const cont_callee: Value = args[0]

      const dummyFCallExpression = makeDummyContCallExpression('f', 'cont')

      // Prepare a function call for the continuation-consuming function
      // along with a newly generated continuation
      control.push(instr.appInstr(command.numOfArgs, dummyFCallExpression))
      control.push(instr.genContInstr(dummyFCallExpression.arguments[0]))
      stash.push(cont_callee)
      return
    }

    if (isContinuation(func)) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      // A continuation is always given a single argument
      const expression: Value = args[0]

      const dummyContCallExpression = makeDummyContCallExpression('f', 'cont')

      // Restore the state of the stash,
      // but replace the function application instruction with
      // a resume continuation instruction
      stash.push(func)
      stash.push(expression)
      control.push(instr.resumeContInstr(dummyContCallExpression))
      return
    }

    if (func instanceof Closure) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      // Display the pre-defined functions on the global environment if needed.
      if (func.preDefined) {
        Object.defineProperty(context.runtime.environments[1].head, uniqueId(), {
          value: func,
          writable: false,
          enumerable: true
        })
      }

      const next = control.peek()

      // Push ENVIRONMENT instruction if needed
      if (
        next &&
        !(isInstr(next) && next.instrType === InstrType.ENVIRONMENT) &&
        !control.isEmpty()
      ) {
        control.push(instr.envInstr(currentEnvironment(context), command.srcNode))
      }

      // Create environment for function parameters if the function isn't nullary.
      // Name the environment if the function call expression is not anonymous
      if (args.length > 0) {
        const environment = createEnvironment(func, args, command.srcNode)
        pushEnvironment(context, environment)
      } else {
        context.runtime.environments.unshift(func.environment)
      }

      // Handle special case if function is simple
      if (isSimpleFunction(func.node)) {
        // Closures convert ArrowExpressionStatements to BlockStatements
        const block = func.node.body as es.BlockStatement
        const returnStatement = block.body[0] as es.ReturnStatement
        control.push(returnStatement.argument ?? ast.identifier('undefined', returnStatement.loc))
      } else {
        if (control.peek()) {
          // push marker if control not empty
          control.push(instr.markerInstr(command.srcNode))
        }
        control.push(func.node.body)
      }

      return
    }

    // Value is a function
    // Check for number of arguments mismatch error
    checkNumberOfArguments(context, func, args, command.srcNode)
    // Directly stash result of applying pre-built functions without the ASE machine.
    try {
      const result = func(...args)
      stash.push(result)
    } catch (error) {
      if (!(error instanceof RuntimeSourceError || error instanceof errors.ExceptionError)) {
        // The error could've arisen when the builtin called a source function which errored.
        // If the cause was a source error, we don't want to include the error.
        // However if the error came from the builtin itself, we need to handle it.
        const loc = command.srcNode.loc ?? UNKNOWN_LOCATION
        handleRuntimeError(context, new errors.ExceptionError(error, loc))
      }
    }
  },

  [InstrType.BRANCH]: function (
    command: BranchInstr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const test = stash.pop()

    // Check if test condition is a boolean
    const error = rttc.checkIfStatement(command.srcNode, test, context.chapter)
    if (error) {
      handleRuntimeError(context, error)
    }

    if (test) {
      if (!valueProducing(command.consequent)) {
        control.push(ast.identifier('undefined', command.consequent.loc))
      }
      control.push(command.consequent)
    } else if (command.alternate) {
      if (!valueProducing(command.alternate)) {
        control.push(ast.identifier('undefined', command.consequent.loc))
      }
      control.push(command.alternate)
    } else {
      control.push(ast.identifier('undefined', command.srcNode.loc))
    }
  },

  [InstrType.ENVIRONMENT]: function (command: EnvInstr, context: Context) {
    // Restore environment
    while (currentEnvironment(context).id !== command.env.id) {
      popEnvironment(context)
    }
  },

  [InstrType.ARRAY_LITERAL]: function (
    command: ArrLitInstr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const arity = command.arity
    const array = []
    for (let i = 0; i < arity; ++i) {
      array.push(stash.pop())
    }
    reverse(array)
    stash.push(array)
  },

  [InstrType.ARRAY_ACCESS]: function (
    command: Instr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const index = stash.pop()
    const array = stash.pop()
    stash.push(array[index])
  },

  [InstrType.ARRAY_ASSIGNMENT]: function (
    command: Instr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const value = stash.pop()
    const index = stash.pop()
    const array = stash.pop()
    array[index] = value
    stash.push(value)
  },

  [InstrType.CONTINUE]: function (
    command: Instr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const next = control.pop() as ControlItem
    if (isInstr(next) && next.instrType == InstrType.CONTINUE_MARKER) {
      // Encountered continue mark, stop popping
    } else if (isInstr(next) && next.instrType == InstrType.ENVIRONMENT) {
      control.push(command)
      control.push(next) // Let instruction evaluate to restore env
    } else {
      // Continue popping from control by pushing same instruction on control
      control.push(command)
    }
  },

  [InstrType.CONTINUE_MARKER]: function () {},

  [InstrType.BREAK]: function (command: Instr, context: Context, control: Control, stash: Stash) {
    const next = control.pop() as ControlItem
    if (isInstr(next) && next.instrType == InstrType.BREAK_MARKER) {
      // Encountered break mark, stop popping
    } else if (isInstr(next) && next.instrType == InstrType.ENVIRONMENT) {
      control.push(command)
      control.push(next) // Let instruction evaluate to restore env
    } else {
      // Continue popping from control by pushing same instruction on control
      control.push(command)
    }
  },

  [InstrType.BREAK_MARKER]: function () {},

  [InstrType.GENERATE_CONT]: function (
    _command: Instr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const contControl = control.copy()
    const contStash = stash.copy()
    const contEnv = context.runtime.environments

    // Remove all data related to the continuation-consuming function
    contControl.pop()
    contStash.pop()

    // Now this will accurately represent the slice of the
    // program execution at the time of the call/cc call
    const continuation = makeContinuation(contControl, contStash, contEnv)

    stash.push(continuation)
  },

  [InstrType.RESUME_CONT]: function (
    _command: Instr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const expression = stash.pop()
    const cn: Continuation = stash.pop() as Continuation

    const contControl = getContinuationControl(cn)
    const contStash = getContinuationStash(cn)
    const contEnv = getContinuationEnv(cn)

    // Set the control and stash to the continuation's control and stash
    control.setTo(contControl)
    stash.setTo(contStash)

    // Push the expression given to the continuation onto the stash
    stash.push(expression)

    // Restore the environment pointer to that of the continuation
    context.runtime.environments = contEnv
  }
}
