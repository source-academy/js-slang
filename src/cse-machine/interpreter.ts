/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 * and the legacy interpreter at '../interpreter/interpreter'
 */

/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { isArray, reverse } from 'lodash'

import { IOptions } from '..'
import { UNKNOWN_LOCATION } from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, ContiguousArrayElements, Result, Value, type StatementSequence } from '../types'
import * as ast from '../utils/ast/astCreator'
import { filterImportDeclarations } from '../utils/ast/helpers'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import * as seq from '../utils/statementSeqTransform'
import { checkProgramForUndefinedVariables } from '../validator/validator'
import { isSchemeLanguage } from '../alt-langs/mapper'
import Closure from './closure'
import {
  Continuation,
  isCallWithCurrentContinuation,
  makeDummyContCallExpression
} from './continuations'
import * as instr from './instrCreator'
import { Stack } from './stack'
import {
  AppInstr,
  ArrLitInstr,
  AssmtInstr,
  BinOpInstr,
  BranchInstr,
  CSEBreak,
  ControlItem,
  CseError,
  EnvInstr,
  ForInstr,
  Instr,
  InstrType,
  UnOpInstr,
  WhileInstr,
  SpreadInstr
} from './types'
import {
  checkNumberOfArguments,
  checkStackOverFlow,
  createBlockEnvironment,
  createEnvironment,
  createProgramEnvironment,
  currentEnvironment,
  currentTransformers,
  declareFunctionsAndVariables,
  declareIdentifier,
  defineVariable,
  envChanging,
  getVariable,
  handleArrayCreation,
  handleRuntimeError,
  handleSequence,
  hasBreakStatement,
  hasContinueStatement,
  hasDeclarations,
  hasImportDeclarations,
  isBlockStatement,
  isEnvArray,
  isEnvDependent,
  isInstr,
  isNode,
  isSimpleFunction,
  isStreamFn,
  popEnvironment,
  pushEnvironment,
  reduceConditional,
  setTransformers,
  setVariable,
  valueProducing
} from './utils'
import { isApply, isEval, schemeEval } from './scheme-macros'
import { Transformer } from './patterns'
import { flattenList, isList } from './macro-utils'

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
  private numEnvDependentItems: number
  public constructor(program?: es.Program | StatementSequence) {
    super()
    this.numEnvDependentItems = 0
    // Load program into control stack
    if (program) this.push(program)
  }

  public canAvoidEnvInstr(): boolean {
    return this.numEnvDependentItems === 0
  }

  // For testing purposes
  public getNumEnvDependentItems(): number {
    return this.numEnvDependentItems
  }

  public pop(): ControlItem | undefined {
    const item = super.pop()
    if (item !== undefined && isEnvDependent(item)) {
      this.numEnvDependentItems--
    }
    return item
  }

  public push(...items: ControlItem[]): void {
    const itemsNew: ControlItem[] = Control.simplifyBlocksWithoutDeclarations(...items)
    itemsNew.forEach((item: ControlItem) => {
      if (isEnvDependent(item)) {
        this.numEnvDependentItems++
      }
    })
    super.push(...itemsNew)
  }

  /**
   * Before pushing block statements on the control stack, we check if the block statement has any declarations.
   * If not, the block is converted to a StatementSequence.
   * @param items The items being pushed on the control.
   * @returns The same set of control items, but with block statements without declarations converted to StatementSequences.
   * NOTE: this function handles any case where StatementSequence has to be converted back into BlockStatement due to type issues
   */
  private static simplifyBlocksWithoutDeclarations(...items: ControlItem[]): ControlItem[] {
    const itemsNew: ControlItem[] = []
    items.forEach(item => {
      if (isNode(item) && isBlockStatement(item) && !hasDeclarations(item)) {
        // Push block body as statement sequence
        const seq: StatementSequence = ast.statementSequence(item.body, item.loc)
        itemsNew.push(seq)
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
 * The T component is a dictionary of mappings from syntax names to
 * their corresponding syntax rule transformers (patterns).
 *
 * Similar to the E component, there is a matching
 * "T" environment tree that is used to store the transformers.
 * as such, we need to track the transformers and update them with the environment.
 */
export class Transformers {
  private parent: Transformers | null
  private items: Map<string, Transformer[]>
  public constructor(parent?: Transformers) {
    this.parent = parent || null
    this.items = new Map<string, Transformer[]>()
  }

  // only call this if you are sure that the pattern exists.
  public getPattern(name: string): Transformer[] {
    // check if the pattern exists in the current transformer
    if (this.items.has(name)) {
      return this.items.get(name) as Transformer[]
    }
    // else check if the pattern exists in the parent transformer
    if (this.parent) {
      return this.parent.getPattern(name)
    }
    // should not get here. use this properly.
    throw new Error(`Pattern ${name} not found in transformers`)
  }

  public hasPattern(name: string): boolean {
    // check if the pattern exists in the current transformer
    if (this.items.has(name)) {
      return true
    }
    // else check if the pattern exists in the parent transformer
    if (this.parent) {
      return this.parent.hasPattern(name)
    }
    return false
  }

  public addPattern(name: string, item: Transformer[]): void {
    this.items.set(name, item)
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
  seq.transform(program)

  try {
    context.runtime.isRunning = true
    context.runtime.control = new Control(program)
    context.runtime.stash = new Stash()
    // set a global transformer if it does not exist.
    context.runtime.transformers = context.runtime.transformers
      ? context.runtime.transformers
      : new Transformers()

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

function evaluateImports(program: es.Program, context: Context) {
  try {
    const [importNodeMap] = filterImportDeclarations(program)

    const environment = currentEnvironment(context)
    for (const [moduleName, nodes] of importNodeMap) {
      const functions = context.nativeStorage.loadedModules[moduleName]
      for (const node of nodes) {
        for (const spec of node.specifiers) {
          declareIdentifier(context, spec.local.name, node, environment)
          let obj: any

          switch (spec.type) {
            case 'ImportSpecifier': {
              obj = functions[spec.imported.name]
              break
            }
            case 'ImportDefaultSpecifier': {
              obj = functions.default
              break
            }
            case 'ImportNamespaceSpecifier': {
              obj = functions
              break
            }
          }

          defineVariable(context, spec.local.name, obj, true, node)
        }
      }
    }
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
  return new Promise(resolve => {
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
  const eceState = generateCSEMachineStateStream(
    context,
    control,
    stash,
    envSteps,
    stepLimit,
    isPrelude
  )

  // Done intentionally as the state is not needed
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of eceState) {
  }

  return stash.peek()
}

export function* generateCSEMachineStateStream(
  context: Context,
  control: Control,
  stash: Stash,
  envSteps: number,
  stepLimit: number,
  isPrelude: boolean = false
) {
  context.runtime.break = false
  context.runtime.nodes = []

  // steps: number of steps completed
  let steps = 0

  let command = control.peek()

  // Push first node to be evaluated into context.
  // The typeguard is there to guarantee that we are pushing a node (which should always be the case)
  if (command !== undefined && isNode(command)) {
    context.runtime.nodes.unshift(command)
  }

  while (command !== undefined) {
    // Return to capture a snapshot of the control and stash after the target step count is reached
    if (!isPrelude && steps === envSteps) {
      yield { stash, control, steps }
      return
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

    if (!isPrelude && envChanging(command)) {
      // command is evaluated on the next step
      // Hence, next step will change the environment
      context.runtime.changepointSteps.push(steps + 1)
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
    } else if (isInstr(command)) {
      // Command is an instruction
      cmdEvaluators[command.instrType](command, context, control, stash, isPrelude)
    } else {
      // this is a scheme value
      schemeEval(command, context, control, stash, isPrelude)
    }

    // Push undefined into the stack if both control and stash is empty
    if (control.isEmpty() && stash.isEmpty()) {
      stash.push(undefined)
    }
    command = control.peek()

    steps += 1
    if (!isPrelude) {
      context.runtime.envStepsTotal = steps
    }

    yield { stash, control, steps }
  }
}

/**
 * Dictionary of functions which handle the logic for the response of the three registers of
 * the CSE machine to each ControlItem.
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
    // After execution of a program, the current environment might be a local one.
    // This can cause issues (for example, during execution of consecutive REPL programs)
    // This piece of code will reset the current environment to either a global one, a program one or a prelude one.
    while (
      currentEnvironment(context).name != 'global' &&
      currentEnvironment(context).name != 'programEnvironment' &&
      currentEnvironment(context).name != 'prelude'
    ) {
      popEnvironment(context)
    }

    // If the program has outer declarations:
    // - Create the program environment (if none exists yet), and
    // - Declare the functions and variables in the program environment.
    if (hasDeclarations(command) || hasImportDeclarations(command)) {
      if (currentEnvironment(context).name != 'programEnvironment') {
        const programEnv = createProgramEnvironment(context, isPrelude)
        pushEnvironment(context, programEnv)
      }
      const environment = currentEnvironment(context)
      evaluateImports(command as unknown as es.Program, context)
      declareFunctionsAndVariables(context, command, environment)
    }

    if (command.body.length == 1) {
      // If program only consists of one statement, unwrap outer block
      control.push(...handleSequence(command.body))
    } else {
      // Push block body as statement sequence
      const seq: StatementSequence = ast.statementSequence(command.body, command.loc)
      control.push(seq)
    }
  },

  BlockStatement: function (command: es.BlockStatement, context: Context, control: Control) {
    // To restore environment after block ends
    // If there is an env instruction on top of the stack, or if there are no declarations
    // we do not need to push another one
    // The no declarations case is handled at the transform stage, so no blockStatement node without declarations should end up here.
    const next = control.peek()

    // Push ENVIRONMENT instruction if needed - if next control stack item
    // exists and is not an environment instruction, OR the control only contains
    // environment indepedent items
    if (
      next &&
      !(isInstr(next) && next.instrType === InstrType.ENVIRONMENT) &&
      !control.canAvoidEnvInstr()
    ) {
      control.push(
        instr.envInstr(
          currentEnvironment(context),
          context.runtime.transformers as Transformers,
          command
        )
      )
    }

    const environment = createBlockEnvironment(context, 'blockEnvironment')
    declareFunctionsAndVariables(context, command, environment)
    pushEnvironment(context, environment)

    // Push block body as statement sequence
    const seq: StatementSequence = ast.statementSequence(command.body, command.loc)
    control.push(seq)
  },

  StatementSequence: function (
    command: StatementSequence,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    if (command.body.length == 1) {
      // If sequence only consists of one statement, evaluate it immediately
      const next = command.body[0]
      cmdEvaluators[next.type](next, context, control, stash, isPrelude)
    } else {
      // unpack and push individual nodes in body
      control.push(...handleSequence(command.body))
    }
    return
  },

  WhileStatement: function (command: es.WhileStatement, context: Context, control: Control) {
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
      control.push(
        ast.blockStatement(
          [
            init,
            ast.forStatement(
              ast.assignmentExpression(id, ast.identifier(id.name, command.loc), command.loc),
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

  IfStatement: function (command: es.IfStatement, context: Context, control: Control) {
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

  ContinueStatement: function (command: es.ContinueStatement, context: Context, control: Control) {
    control.push(instr.contInstr(command))
  },

  BreakStatement: function (command: es.BreakStatement, context: Context, control: Control) {
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

  SpreadElement: function (command: es.SpreadElement, context: Context, control: Control) {
    const arr = command.argument as es.ArrayExpression
    control.push(instr.spreadInstr(arr))
    control.push(arr)
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

  MemberExpression: function (command: es.MemberExpression, context: Context, control: Control) {
    control.push(instr.arrAccInstr(command))
    control.push(command.property)
    control.push(command.object)
  },

  ConditionalExpression: function (
    command: es.ConditionalExpression,
    context: Context,
    control: Control
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
    const closure: Closure = Closure.makeFromArrowFunction(
      command,
      currentEnvironment(context),
      currentTransformers(context),
      context,
      true,
      isPrelude
    )
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

  [InstrType.RESET]: function (command: Instr, context: Context, control: Control) {
    // Keep pushing reset instructions until marker is found.
    const cmdNext: ControlItem | undefined = control.pop()
    if (cmdNext && (!isInstr(cmdNext) || cmdNext.instrType !== InstrType.MARKER)) {
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
    if (command.declaration) {
      defineVariable(
        context,
        command.symbol,
        stash.peek(),
        command.constant,
        command.srcNode as es.VariableDeclaration
      )
    } else {
      setVariable(context, command.symbol, stash.peek(), command.srcNode as es.AssignmentExpression)
    }
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

    if (isApply(func)) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      // get the procedure from the arguments
      const proc = args[0]
      // get the last list from the arguments
      // (and it should be a list)
      const last = args[args.length - 1]
      if (!isList(last)) {
        handleRuntimeError(
          context,
          new errors.ExceptionError(new Error('Last argument of apply must be a list'))
        )
      }
      // get the rest of the arguments between the procedure and the last list
      const rest = args.slice(1, args.length - 1)
      // convert the last list to an array
      const lastAsArray = flattenList(last)
      // combine the rest and the last list
      const combined = [...rest, ...lastAsArray]

      // push the items back onto the stash
      stash.push(proc)
      stash.push(...combined)

      // prepare a function call for the procedure
      control.push(instr.appInstr(combined.length, command.srcNode))
      return
    }

    if (isEval(func)) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      // get the AST from the arguments
      const AST = args[0]

      // move it to the control
      control.push(AST)
      return
    }

    if (isCallWithCurrentContinuation(func)) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      // generate a continuation here
      const contControl = control.copy()
      const contStash = stash.copy()
      const contEnv = context.runtime.environments.slice()
      const contTransformers = currentTransformers(context)

      // at this point, the extra CALL instruction
      // has been removed from the control stack.
      // additionally, the single closure argument has been
      // removed (as the parameter of call/cc) from the stash
      // and additionally, call/cc itself has been removed from the stash.

      // as such, there is no further need to modify the
      // copied C, S, E and T!

      const continuation = new Continuation(
        context,
        contControl,
        contStash,
        contEnv,
        contTransformers
      )

      // Get the callee
      const cont_callee: Value = args[0]

      const dummyFCallExpression = makeDummyContCallExpression('f', 'cont')

      // Prepare a function call for the continuation-consuming function
      control.push(instr.appInstr(command.numOfArgs, dummyFCallExpression))

      // push the argument (the continuation caller) back onto the stash
      stash.push(cont_callee)

      // finally, push the continuation onto the stash
      stash.push(continuation)
      return
    }

    if (func instanceof Continuation) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      // get the C, S, E from the continuation
      const contControl = func.getControl()
      const contStash = func.getStash()
      const contEnv = func.getEnv()
      const contTransformers = func.getTransformers()

      // update the C, S, E of the current context
      control.setTo(contControl)
      stash.setTo(contStash)
      context.runtime.environments = contEnv
      setTransformers(context, contTransformers)

      // push the arguments back onto the stash
      stash.push(...args)
      return
    }

    if (func instanceof Closure) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(context, func, args, command.srcNode)

      const next = control.peek()

      // Push ENVIRONMENT instruction if needed - if next control stack item
      // exists and is not an environment instruction, OR the control only contains
      // environment indepedent items
      // if the current language is a scheme language, don't avoid the environment instruction
      // as schemers like using the REPL, and that always assumes that the environment is reset
      // to the main environment.
      if (
        (next &&
          !(isInstr(next) && next.instrType === InstrType.ENVIRONMENT) &&
          !control.canAvoidEnvInstr()) ||
        isSchemeLanguage(context)
      ) {
        control.push(
          instr.envInstr(currentEnvironment(context), currentTransformers(context), command.srcNode)
        )
      }

      // Create environment for function parameters if the function isn't nullary.
      // Name the environment if the function call expression is not anonymous
      if (args.length > 0) {
        const environment = createEnvironment(context, func, args, command.srcNode)
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

      // we need to update the transformers environment here.
      const newTransformers = new Transformers(func.transformers)
      setTransformers(context, newTransformers)
      return
    }

    // Value is a built-in function
    // Check for number of arguments mismatch error
    checkNumberOfArguments(context, func, args, command.srcNode)
    // Directly stash result of applying pre-built functions without the CSE machine.
    try {
      const result = func(...args)

      if (isStreamFn(func, result)) {
        // This is a special case for the `stream` built-in function, since it returns pairs
        // whose last element is a function. The CSE machine on the frontend will still draw
        // these functions like closures, and the tail of the "closures" will need to point
        // to where `stream` was called.
        //
        // TODO: remove this condition if `stream` becomes a pre-defined function
        Object.defineProperties(result[1], {
          environment: { value: currentEnvironment(context), writable: true }
        })
      }

      // Recursively adds `environment` and `id` properties to any arrays created,
      // and also adds them to the heap starting from the arrays that are more deeply nested.
      const attachEnvToResult = (value: any) => {
        // Built-in functions don't instantly create arrays with circular references, so
        // there is no need to keep track of visited arrays.
        if (isArray(value) && !isEnvArray(value)) {
          for (const item of value) {
            attachEnvToResult(item)
          }
          handleArrayCreation(context, value)
        }
      }
      attachEnvToResult(result)

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
    // restore transformers environment
    setTransformers(context, command.transformers)
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
      array.unshift(stash.pop())
    }
    handleArrayCreation(context, array)
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

    //Check if the index is legal
    const indexLegalError = rttc.checkoutofRange(command.srcNode, index, context.chapter)
    if (indexLegalError) {
      handleRuntimeError(context, indexLegalError)
    }

    // Check if left-hand side is array
    const LHSerror = rttc.checkArray(command.srcNode, array, context.chapter)
    if (LHSerror) {
      handleRuntimeError(context, LHSerror)
    }

    // Check if index is out-of-bounds with array, in which case, returns undefined as per spec
    if (index >= array.length) {
      stash.push(undefined)
    } else {
      stash.push(array[index])
    }
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

  [InstrType.SPREAD]: function (
    command: SpreadInstr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const array = stash.pop()

    // Check if right-hand side is array
    const error = rttc.checkArray(command.srcNode, array, context.chapter)
    if (error) {
      handleRuntimeError(context, error)
    }

    // spread array
    for (let i = 0; i < array.length; i++) {
      stash.push(array[i])
    }

    // update call instr above
    const cont = control.getStack()
    const size = control.size()
    for (let i = size - 1; i >= 0; i--) {
      // guaranteed at least one call instr above, because spread is not allowed inside arrays
      if ((cont[i] as AppInstr).instrType === InstrType.APPLICATION) {
        ;(cont[i] as AppInstr).numOfArgs += array.length - 1
        break // only the nearest call instruction above
      }
    }
  }
}
