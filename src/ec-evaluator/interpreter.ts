/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 * and the legacy interpreter at '../interpreter/interpreter'
 */

/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { partition, uniqueId } from 'lodash'

import { UNKNOWN_LOCATION } from '../constants'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import Closure from '../interpreter/closure'
import { UndefinedImportError } from '../modules/errors'
import { loadModuleBundle, loadModuleTabs } from '../modules/moduleLoader'
import { ModuleFunctions } from '../modules/moduleTypes'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, ContiguousArrayElements, Result, Value } from '../types'
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
  ECEBreak,
  ECError,
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
  isAssmtInstr,
  isInstr,
  isNode,
  popEnvironment,
  pushEnvironment,
  reduceConditional,
  setVariable,
  Stack
} from './utils'

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
export function evaluate(program: es.Program, context: Context): Value {
  try {
    context.runtime.isRunning = true

    const nonImportNodes = evaluateImports(program, context, true, true)

    context.runtime.agenda = new Agenda({
      ...program,
      body: nonImportNodes
    })
    context.runtime.stash = new Stash()
    return runECEMachine(context, context.runtime.agenda, context.runtime.stash)
  } catch (error) {
    // console.error('ecerror:', error)
    return new ECError(error)
  } finally {
    context.runtime.isRunning = false
  }
}

/**
 * Function that is called when a user wishes to resume evaluation after
 * hitting a breakpoint.
 * This should only be called after the first 'evaluate' function has been called so that
 * context.runtime.agenda and context.runtime.stash are defined.
 * @param context The context to continue evaluating the program in.
 * @returns The result of running the ECE machine.
 */
export function resumeEvaluate(context: Context) {
  try {
    context.runtime.isRunning = true
    return runECEMachine(context, context.runtime.agenda!, context.runtime.stash!)
  } catch (error) {
    return new ECError(error)
  } finally {
    context.runtime.isRunning = false
  }
}

function evaluateImports(
  program: es.Program,
  context: Context,
  loadTabs: boolean,
  checkImports: boolean
) {
  const [importNodes, otherNodes] = partition(
    program.body,
    ({ type }) => type === 'ImportDeclaration'
  ) as [es.ImportDeclaration[], es.Statement[]]

  const moduleFunctions: Record<string, ModuleFunctions> = {}

  try {
    for (const node of importNodes) {
      const moduleName = node.source.value
      if (typeof moduleName !== 'string') {
        throw new Error(`ImportDeclarations should have string sources, got ${moduleName}`)
      }

      if (!(moduleName in moduleFunctions)) {
        context.moduleContexts[moduleName] = {
          state: null,
          tabs: loadTabs ? loadModuleTabs(moduleName, node) : null
        }
        moduleFunctions[moduleName] = loadModuleBundle(moduleName, context, node)
      }

      const functions = moduleFunctions[moduleName]
      const environment = currentEnvironment(context)
      for (const spec of node.specifiers) {
        if (spec.type !== 'ImportSpecifier') {
          throw new Error(`Only ImportSpecifiers are supported, got: ${spec.type}`)
        }

        if (checkImports && !(spec.imported.name in functions)) {
          throw new UndefinedImportError(spec.imported.name, moduleName, node)
        }

        declareIdentifier(context, spec.local.name, node, environment)
        defineVariable(context, spec.local.name, functions[spec.imported.name], true, node)
      }
    }
  } catch (error) {
    // console.log(error)
    handleRuntimeError(context, error)
  }

  return otherNodes
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
      resolve({ status: 'suspended-ec-eval', context })
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
        return new ECEBreak()
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
    const environment = createBlockEnvironment(context, 'programEnvironment')
    // Push the environment only if it is non empty.
    if (declareFunctionsAndVariables(context, command, environment)) {
      pushEnvironment(context, environment)
    }

    // Push block body
    agenda.push(...handleSequence(command.body))
  },

  BlockStatement: function (command: es.BlockStatement, context: Context, agenda: Agenda) {
    // To restore environment after block ends
    agenda.push(instr.envInstr(currentEnvironment(context)))

    const environment = createBlockEnvironment(context, 'blockEnvironment')
    // Push the environment only if it is non empty.
    if (declareFunctionsAndVariables(context, command, environment)) {
      pushEnvironment(context, environment)
    }

    // Push block body
    agenda.push(...handleSequence(command.body))
  },

  WhileStatement: function (command: es.WhileStatement, context: Context, agenda: Agenda) {
    agenda.push(instr.breakMarkerInstr())
    agenda.push(instr.whileInstr(command.test, command.body, command))
    agenda.push(command.test)
    agenda.push(ast.identifier('undefined')) // Return undefined if there is no loop execution
  },

  ForStatement: function (command: es.ForStatement, context: Context, agenda: Agenda) {
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
      agenda.push(instr.breakMarkerInstr())
      agenda.push(instr.forInstr(init, test, update, command.body, command))
      agenda.push(test)
      agenda.push(instr.popInstr()) // Pop value from init assignment
      agenda.push(init)
      agenda.push(ast.identifier('undefined')) // Return undefined if there is no loop execution
    }
  },

  IfStatement: function (command: es.IfStatement, context: Context, agenda: Agenda, stash: Stash) {
    agenda.push(...reduceConditional(command))
  },

  ExpressionStatement: function (
    command: es.ExpressionStatement,
    context: Context,
    agenda: Agenda
  ) {
    agenda.push(command.expression)
  },

  DebuggerStatement: function (command: es.DebuggerStatement, context: Context) {
    context.runtime.break = true
  },

  VariableDeclaration: function (
    command: es.VariableDeclaration,
    context: Context,
    agenda: Agenda
  ) {
    const declaration: es.VariableDeclarator = command.declarations[0]
    const id = declaration.id as es.Identifier

    // Parser enforces initialisation during variable declaration
    const init = declaration.init!

    agenda.push(instr.popInstr())
    agenda.push(instr.assmtInstr(id.name, command.kind === 'const', true, command))
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

  ReturnStatement: function (command: es.ReturnStatement, context: Context, agenda: Agenda) {
    // Push return argument onto agenda as well as Reset Instruction to clear to ignore all statements after the return.
    agenda.push(instr.resetInstr())
    if (command.argument) {
      agenda.push(command.argument)
    }
  },

  ContinueStatement: function (
    command: es.ContinueStatement,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    agenda.push(instr.contInstr())
  },

  BreakStatement: function (
    command: es.BreakStatement,
    context: Context,
    agenda: Agenda,
    stash: Stash
  ) {
    agenda.push(instr.breakInstr())
  },
  ImportDeclaration: function () {
    throw new Error('Import Declarations should already have been removed.')
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
    agenda: Agenda
  ) {
    if (command.left.type === 'MemberExpression') {
      agenda.push(instr.arrAssmtInstr())
      agenda.push(command.right)
      agenda.push(command.left.property)
      agenda.push(command.left.object)
    } else if (command.left.type === 'Identifier') {
      const id = command.left
      agenda.push(instr.assmtInstr(id.name, false, false, command))
      agenda.push(command.right)
    }
  },

  ArrayExpression: function (command: es.ArrayExpression, context: Context, agenda: Agenda) {
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
    // Reuses the Closure data structure from legacy interpreter
    const closure: Closure = Closure.makeFromArrowFunction(
      command,
      currentEnvironment(context),
      context,
      true
    )
    const next = agenda.peek()
    if (!(next && isInstr(next) && isAssmtInstr(next))) {
      if (closure instanceof Closure) {
        Object.defineProperty(currentEnvironment(context).head, uniqueId(), {
          value: closure,
          writable: false,
          enumerable: true
        })
      }
    }
    stash.push(closure)
  },

  CallExpression: function (command: es.CallExpression, context: Context, agenda: Agenda) {
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
      agenda.push(instr.contMarkerInstr())
      agenda.push(instr.pushUndefIfNeededInstr()) // The loop returns undefined if the stash is empty
      agenda.push(command.body)
      agenda.push(instr.popInstr()) // Pop previous body value
    }
  },

  [InstrType.FOR]: function (command: ForInstr, context: Context, agenda: Agenda, stash: Stash) {
    const test = stash.pop()

    // Check if test condition is a boolean
    const error = rttc.checkIfStatement(command.srcNode, test, context.chapter)
    if (error) {
      handleRuntimeError(context, error)
    }

    if (test) {
      agenda.push(command)
      agenda.push(command.test)
      agenda.push(instr.popInstr()) // Pop value from update
      agenda.push(command.update)
      agenda.push(instr.contMarkerInstr())
      agenda.push(instr.pushUndefIfNeededInstr()) // The loop returns undefined if the stash is empty
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
    checkStackOverFlow(context, agenda)
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
      const environment = createEnvironment(func, args, command.srcNode)
      pushEnvironment(context, environment)
    } else if (typeof func === 'function') {
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
  },

  [InstrType.CONTINUE]: function (command: Instr, context: Context, agenda: Agenda, stash: Stash) {
    const next = agenda.pop() as AgendaItem
    if (isInstr(next) && next.instrType == InstrType.CONTINUE_MARKER) {
      // Encountered continue mark, stop popping
    } else if (isInstr(next) && next.instrType == InstrType.ENVIRONMENT) {
      agenda.push(command)
      agenda.push(next) // Let instruction evaluate to restore env
    } else {
      // Continue popping from agenda by pushing same instruction on agenda
      agenda.push(command)
    }
  },

  [InstrType.CONTINUE_MARKER]: function () {},

  [InstrType.BREAK]: function (command: Instr, context: Context, agenda: Agenda, stash: Stash) {
    const next = agenda.pop() as AgendaItem
    if (isInstr(next) && next.instrType == InstrType.BREAK_MARKER) {
      // Encountered break mark, stop popping
    } else if (isInstr(next) && next.instrType == InstrType.ENVIRONMENT) {
      agenda.push(command)
      agenda.push(next) // Let instruction evaluate to restore env
    } else {
      // Continue popping from agenda by pushing same instruction on agenda
      agenda.push(command)
    }
  },

  [InstrType.BREAK_MARKER]: function () {}
}
