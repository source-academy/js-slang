import * as es from 'estree'
import { isArray, isFunction } from 'lodash'

import { Context } from '..'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { Chapter, type Environment, type Node, type StatementSequence, type Value } from '../types'
import * as ast from '../utils/ast/astCreator'
import Heap from './heap'
import * as instr from './instrCreator'
import { Control } from './interpreter'
import {
  AppInstr,
  EnvArray,
  ControlItem,
  Instr,
  InstrType,
  BranchInstr,
  WhileInstr,
  ForInstr
} from './types'
import Closure from './closure'
import { Continuation, isCallWithCurrentContinuation } from './continuations'
import { isEval } from './scheme-macros'
import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import { is_number } from '../alt-langs/scheme/scm-slang/src/stdlib/core-math'

/**
 * Typeguard for commands to check if they are scheme values.
 *
 * @param command A ControlItem
 * @returns true if the ControlItem is a scheme value, false otherwise.
 */
export const isSchemeValue = (command: ControlItem): boolean => {
  return (
    command === null ||
    typeof command === 'string' ||
    typeof command === 'boolean' ||
    isArray(command) ||
    command instanceof _Symbol ||
    is_number(command)
  )
}

/**
 * Typeguard for Instr to distinguish between program statements and instructions.
 *
 * @param command A ControlItem
 * @returns true if the ControlItem is an instruction and false otherwise.
 */
export const isInstr = (command: ControlItem): command is Instr => {
  // this prevents us from reading properties of null
  if (isSchemeValue(command)) {
    return false
  }
  return (command as Instr).instrType !== undefined
}

/**
 * Typeguard for Node to distinguish between program statements and instructions.
 *
 * @param command A ControlItem
 * @returns true if the ControlItem is a Node or StatementSequence, false if it is an instruction.
 */
export const isNode = (command: ControlItem): command is Node => {
  // this prevents us from reading properties of null
  if (isSchemeValue(command)) {
    return false
  }
  return (command as Node).type !== undefined
}

/**
 * Typeguard for esIdentifier. To verify if a Node is an esIdentifier.
 *
 * @param node a Node
 * @returns true if node is an esIdentifier, false otherwise.
 */
export const isIdentifier = (node: Node): node is es.Identifier => {
  return (node as es.Identifier).name !== undefined
}

/**
 * Typeguard for esReturnStatement. To verify if a Node is an esReturnStatement.
 *
 * @param node a Node
 * @returns true if node is an esReturnStatement, false otherwise.
 */
export const isReturnStatement = (node: Node): node is es.ReturnStatement => {
  return (node as es.ReturnStatement).type == 'ReturnStatement'
}

/**
 * Typeguard for esIfStatement. To verify if a Node is an esIfStatement.
 *
 * @param node a Node
 * @returns true if node is an esIfStatement, false otherwise.
 */
export const isIfStatement = (node: Node): node is es.IfStatement => {
  return (node as es.IfStatement).type == 'IfStatement'
}

/**
 * Typeguard for esBlockStatement. To verify if a Node is a block statement.
 *
 * @param node a Node
 * @returns true if node is an esBlockStatement, false otherwise.
 */
export const isBlockStatement = (node: Node): node is es.BlockStatement => {
  return (node as es.BlockStatement).type == 'BlockStatement'
}

/**
 * Typeguard for StatementSequence. To verify if a ControlItem is a statement sequence.
 *
 * @param node a ControlItem
 * @returns true if node is a StatementSequence, false otherwise.
 */
export const isStatementSequence = (node: ControlItem): node is StatementSequence => {
  return (node as StatementSequence).type == 'StatementSequence'
}

/**
 * Typeguard for esRestElement. To verify if a Node is a block statement.
 *
 * @param node a Node
 * @returns true if node is an esRestElement, false otherwise.
 */
export const isRestElement = (node: Node): node is es.RestElement => {
  return (node as es.RestElement).type == 'RestElement'
}

/**
 * Generate a unique id, for use in environments, arrays and closures.
 *
 * @param context the context used to provide the new unique id
 * @returns a unique id
 */
export const uniqueId = (context: Context): string => {
  return `${context.runtime.objectCount++}`
}

/**
 * Returns whether `item` is an array with `id` and `environment` properties already attached.
 */
export const isEnvArray = (item: any): item is EnvArray => {
  return (
    isArray(item) &&
    {}.hasOwnProperty.call(item, 'id') &&
    {}.hasOwnProperty.call(item, 'environment')
  )
}

/**
 * Returns whether `item` is a non-closure function that returns a stream.
 * If the function has been called already and we have the result, we can
 * pass it in here as a 2nd argument for stronger checking
 */
export const isStreamFn = (item: any, result?: any): result is [any, () => any] => {
  if (result == null || !isArray(result) || result.length !== 2) return false
  return (
    isFunction(item) &&
    !(item instanceof Closure) &&
    (item.name === 'stream' || {}.hasOwnProperty.call(item, 'environment'))
  )
}

/**
 * Adds the properties `id` and `environment` to the given array, and adds the array to the
 * current environment's heap. Adds the array to the heap of `envOverride` instead if it's defined.
 *
 * @param context the context used to provide the current environment and new unique id
 * @param array the array to attach properties to, and for addition to the heap
 */
export const handleArrayCreation = (
  context: Context,
  array: any[],
  envOverride?: Environment
): void => {
  const environment = envOverride ?? currentEnvironment(context)
  // Both id and environment are non-enumerable so iterating
  // through the array will not return these values
  Object.defineProperties(array, {
    id: { value: uniqueId(context) },
    // Make environment writable as there are cases on the frontend where
    // environments of objects need to be modified
    environment: { value: environment, writable: true }
  })
  environment.heap.add(array as EnvArray)
}

/**
 * A helper function for handling sequences of statements.
 * Statements must be pushed in reverse order, and each statement is separated by a pop
 * instruction so that only the result of the last statement remains on stash.
 * Value producing statements have an extra pop instruction.
 *
 * @param seq Array of statements.
 * @returns Array of commands to be pushed into control.
 */
export const handleSequence = (seq: es.Statement[]): ControlItem[] => {
  const result: ControlItem[] = []
  let valueProduced = false
  for (const command of seq) {
    if (!isImportDeclaration(command)) {
      if (valueProducing(command)) {
        // Value producing statements have an extra pop instruction
        if (valueProduced) {
          result.push(instr.popInstr(command))
        } else {
          valueProduced = true
        }
      }
      result.push(command)
    }
  }
  // Push statements in reverse order
  return result.reverse()
}

/**
 * This function is used for ConditionalExpressions and IfStatements, to create the sequence
 * of control items to be added.
 */
export const reduceConditional = (
  node: es.IfStatement | es.ConditionalExpression
): ControlItem[] => {
  return [instr.branchInstr(node.consequent, node.alternate, node), node.test]
}

/**
 * To determine if a control item is value producing. JavaScript distinguishes value producing
 * statements and non-value producing statements.
 * Refer to https://sourceacademy.nus.edu.sg/sicpjs/4.1.2 exercise 4.8.
 *
 * @param command Control item to determine if it is value producing.
 * @returns true if it is value producing, false otherwise.
 */
export const valueProducing = (command: Node): boolean => {
  const type = command.type
  return (
    type !== 'VariableDeclaration' &&
    type !== 'FunctionDeclaration' &&
    type !== 'ContinueStatement' &&
    type !== 'BreakStatement' &&
    type !== 'DebuggerStatement' &&
    (type !== 'BlockStatement' || command.body.some(valueProducing))
  )
}

/**
 * To determine if a control item changes the environment.
 * There is a change in the environment when
 *  1. pushEnvironment() is called when creating a new frame, if there are variable declarations.
 *     Called in Program, BlockStatement, and Application instructions.
 *  2. there is an assignment.
 *     Called in Assignment and Array Assignment instructions.
 *  3. a new object is created.
 *     Called in ExpressionStatement that contains an ArrowFunctionExpression, or an ArrowFunctionExpression
 *
 * @param command Control item to check against.
 * @returns true if it changes the environment, false otherwise.
 */
export const envChanging = (command: ControlItem): boolean => {
  if (isNode(command)) {
    const type = command.type
    return (
      type === 'Program' ||
      type === 'BlockStatement' ||
      type === 'ArrowFunctionExpression' ||
      (type === 'ExpressionStatement' && command.expression.type === 'ArrowFunctionExpression')
    )
  } else if (isInstr(command)) {
    const type = command.instrType
    return (
      type === InstrType.ENVIRONMENT ||
      type === InstrType.ARRAY_LITERAL ||
      type === InstrType.ASSIGNMENT ||
      type === InstrType.ARRAY_ASSIGNMENT ||
      (type === InstrType.APPLICATION && (command as AppInstr).numOfArgs > 0)
    )
  } else {
    // TODO deal with scheme control items
    // for now, as per the CSE machine paper,
    // we decide to ignore environment optimizations
    // for scheme control items :P
    return true
  }
}

/**
 * To determine if the function is simple.
 * Simple functions contain a single return statement.
 *
 * @param node The function to check against.
 * @returns true if the function is simple, false otherwise.
 */
export const isSimpleFunction = (node: any) => {
  if (node.body.type !== 'BlockStatement' && node.body.type !== 'StatementSequence') {
    return true
  } else {
    const block = node.body
    return block.body.length === 1 && block.body[0].type === 'ReturnStatement'
  }
}

/**
 * Environments
 */

export const currentEnvironment = (context: Context) => context.runtime.environments[0]

export const createEnvironment = (
  context: Context,
  closure: Closure,
  args: Value[],
  callExpression: es.CallExpression
): Environment => {
  const environment: Environment = {
    name: isIdentifier(callExpression.callee)
      ? callExpression.callee.name
      : closure.declaredName ?? closure.functionName,
    tail: closure.environment,
    head: {},
    heap: new Heap(),
    id: uniqueId(context),
    callExpression: {
      ...callExpression,
      arguments: args.map(ast.primitive)
    }
  }
  closure.node.params.forEach((param, index) => {
    if (isRestElement(param)) {
      const array = args.slice(index)
      handleArrayCreation(context, array, environment)
      environment.head[(param.argument as es.Identifier).name] = array
    } else {
      environment.head[(param as es.Identifier).name] = args[index]
    }
  })
  return environment
}

export const popEnvironment = (context: Context) => context.runtime.environments.shift()

export const pushEnvironment = (context: Context, environment: Environment) => {
  context.runtime.environments.unshift(environment)
  context.runtime.environmentTree.insert(environment)
}

export const createBlockEnvironment = (
  context: Context,
  name = 'blockEnvironment'
): Environment => {
  return {
    name,
    tail: currentEnvironment(context),
    head: {},
    heap: new Heap(),
    id: uniqueId(context)
  }
}

export const createProgramEnvironment = (context: Context, isPrelude: boolean): Environment => {
  return createBlockEnvironment(context, isPrelude ? 'prelude' : 'programEnvironment')
}

/**
 * Variables
 */

const UNASSIGNED_CONST = Symbol('const declaration')
const UNASSIGNED_LET = Symbol('let declaration')

export function declareIdentifier(
  context: Context,
  name: string,
  node: Node,
  environment: Environment,
  constant: boolean = false
) {
  if (environment.head.hasOwnProperty(name)) {
    const descriptors = Object.getOwnPropertyDescriptors(environment.head)

    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(node, name, descriptors[name].writable)
    )
  }
  environment.head[name] = constant ? UNASSIGNED_CONST : UNASSIGNED_LET
  return environment
}

function declareVariables(
  context: Context,
  node: es.VariableDeclaration,
  environment: Environment
) {
  for (const declaration of node.declarations) {
    // Retrieve declaration type from node
    const constant = node.kind === 'const'
    declareIdentifier(context, (declaration.id as es.Identifier).name, node, environment, constant)
  }
}

export function declareFunctionsAndVariables(
  context: Context,
  node: es.BlockStatement,
  environment: Environment
) {
  for (const statement of node.body) {
    switch (statement.type) {
      case 'VariableDeclaration':
        declareVariables(context, statement, environment)
        break
      case 'FunctionDeclaration':
        // FunctionDeclaration is always of type constant
        declareIdentifier(
          context,
          (statement.id as es.Identifier).name,
          statement,
          environment,
          true
        )
        break
    }
  }
}

export function hasDeclarations(node: es.BlockStatement): boolean {
  for (const statement of node.body) {
    if (statement.type === 'VariableDeclaration' || statement.type === 'FunctionDeclaration') {
      return true
    }
  }
  return false
}

export function hasImportDeclarations(node: es.BlockStatement): boolean {
  for (const statement of (node as unknown as es.Program).body) {
    if (statement.type === 'ImportDeclaration') {
      return true
    }
  }
  return false
}

function isImportDeclaration(node: Node): boolean {
  return node.type === 'ImportDeclaration'
}

export function defineVariable(
  context: Context,
  name: string,
  value: Value,
  constant = false,
  node: es.VariableDeclaration | es.ImportDeclaration
) {
  const environment = currentEnvironment(context)

  // we disable this check for full scheme due to the inability to scan for variables before usage
  if (
    environment.head[name] !== UNASSIGNED_CONST &&
    environment.head[name] !== UNASSIGNED_LET &&
    context.chapter !== Chapter.FULL_SCHEME
  ) {
    return handleRuntimeError(context, new errors.VariableRedeclaration(node, name, !constant))
  }

  if (constant && value instanceof Closure) {
    value.declaredName = name
  }

  Object.defineProperty(environment.head, name, {
    value,
    writable: !constant,
    enumerable: true
  })

  return environment
}

export const getVariable = (context: Context, name: string, node: es.Identifier) => {
  let environment: Environment | null = currentEnvironment(context)
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (
        environment.head[name] === UNASSIGNED_CONST ||
        environment.head[name] === UNASSIGNED_LET
      ) {
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

export const setVariable = (
  context: Context,
  name: string,
  value: any,
  node: es.AssignmentExpression
) => {
  let environment: Environment | null = currentEnvironment(context)
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (
        environment.head[name] === UNASSIGNED_CONST ||
        environment.head[name] === UNASSIGNED_LET
      ) {
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

export const handleRuntimeError = (context: Context, error: RuntimeSourceError) => {
  context.errors.push(error)
  throw error
}

export const checkNumberOfArguments = (
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
  } else if (isCallWithCurrentContinuation(callee)) {
    // call/cc should have a single argument
    if (args.length !== 1) {
      return handleRuntimeError(
        context,
        new errors.InvalidNumberOfArguments(exp, 1, args.length, false)
      )
    }
    return undefined
  } else if (isEval(callee)) {
    // eval should have a single argument
    if (args.length !== 1) {
      return handleRuntimeError(
        context,
        new errors.InvalidNumberOfArguments(exp, 1, args.length, false)
      )
    }
    return undefined
  } else if (callee instanceof Continuation) {
    // Continuations have variadic arguments,
    // and so we can let it pass
    // TODO: in future, if we can somehow check the number of arguments
    // expected by the continuation, we can add a check here.
    return undefined
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

/**
 * This function can be used to check for a stack overflow.
 * The current limit is set to be a control size of 1.0 x 10^5, if the control
 * flows beyond this limit an error is thrown.
 * This corresponds to about 10mb of space according to tests ran.
 */
export const checkStackOverFlow = (context: Context, control: Control) => {
  if (control.size() > 100000) {
    const stacks: es.CallExpression[] = []
    let counter = 0
    for (
      let i = 0;
      counter < errors.MaximumStackLimitExceeded.MAX_CALLS_TO_SHOW &&
      i < context.runtime.environments.length;
      i++
    ) {
      if (context.runtime.environments[i].callExpression) {
        stacks.unshift(context.runtime.environments[i].callExpression!)
        counter++
      }
    }
    handleRuntimeError(
      context,
      new errors.MaximumStackLimitExceeded(context.runtime.nodes[0], stacks)
    )
  }
}

/**
 * Checks whether an `if` statement returns in every possible branch.
 * @param body The `if` statement to be checked
 * @return `true` if every branch has a return statement, else `false`.
 */
export const hasReturnStatementIf = (statement: es.IfStatement): boolean => {
  let hasReturn = true
  // Parser enforces that if/else have braces (block statement)
  hasReturn = hasReturn && hasReturnStatement(statement.consequent as es.BlockStatement)
  if (statement.alternate) {
    if (isIfStatement(statement.alternate)) {
      hasReturn = hasReturn && hasReturnStatementIf(statement.alternate as es.IfStatement)
    } else if (isBlockStatement(statement.alternate) || isStatementSequence(statement.alternate)) {
      hasReturn = hasReturn && hasReturnStatement(statement.alternate)
    }
  }
  return hasReturn
}

/**
 * Checks whether a block returns in every possible branch.
 * @param body The block to be checked
 * @return `true` if every branch has a return statement, else `false`.
 */
export const hasReturnStatement = (block: es.BlockStatement | StatementSequence): boolean => {
  let hasReturn = false
  for (const statement of block.body) {
    if (isReturnStatement(statement)) {
      hasReturn = true
    } else if (isIfStatement(statement)) {
      // Parser enforces that if/else have braces (block statement)
      hasReturn = hasReturn || hasReturnStatementIf(statement as es.IfStatement)
    } else if (isBlockStatement(statement) || isStatementSequence(statement)) {
      hasReturn = hasReturn && hasReturnStatement(statement)
    }
  }
  return hasReturn
}

export const hasBreakStatementIf = (statement: es.IfStatement): boolean => {
  let hasBreak = false
  // Parser enforces that if/else have braces (block statement)
  hasBreak = hasBreak || hasBreakStatement(statement.consequent as es.BlockStatement)
  if (statement.alternate) {
    if (isIfStatement(statement.alternate)) {
      hasBreak = hasBreak || hasBreakStatementIf(statement.alternate)
    } else if (isBlockStatement(statement.alternate) || isStatementSequence(statement.alternate)) {
      hasBreak = hasBreak || hasBreakStatement(statement.alternate)
    }
  }
  return hasBreak
}

/**
 * Checks whether a block OR any of its child blocks has a `break` statement.
 * @param body The block to be checked
 * @return `true` if there is a `break` statement, else `false`.
 */
export const hasBreakStatement = (block: es.BlockStatement | StatementSequence): boolean => {
  let hasBreak = false
  for (const statement of block.body) {
    if (statement.type === 'BreakStatement') {
      hasBreak = true
    } else if (isIfStatement(statement)) {
      // Parser enforces that if/else have braces (block statement)
      hasBreak = hasBreak || hasBreakStatementIf(statement as es.IfStatement)
    } else if (isBlockStatement(statement) || isStatementSequence(statement)) {
      hasBreak = hasBreak || hasBreakStatement(statement)
    }
  }
  return hasBreak
}

export const hasContinueStatementIf = (statement: es.IfStatement): boolean => {
  let hasContinue = false
  // Parser enforces that if/else have braces (block statement)
  hasContinue = hasContinue || hasContinueStatement(statement.consequent as es.BlockStatement)
  if (statement.alternate) {
    if (isIfStatement(statement.alternate)) {
      hasContinue = hasContinue || hasContinueStatementIf(statement.alternate)
    } else if (isBlockStatement(statement.alternate) || isStatementSequence(statement.alternate)) {
      hasContinue = hasContinue || hasContinueStatement(statement.alternate)
    }
  }
  return hasContinue
}

/**
 * Checks whether a block OR any of its child blocks has a `continue` statement.
 * @param body The block to be checked
 * @return `true` if there is a `continue` statement, else `false`.
 */
export const hasContinueStatement = (block: es.BlockStatement | StatementSequence): boolean => {
  let hasContinue = false
  for (const statement of block.body) {
    if (statement.type === 'ContinueStatement') {
      hasContinue = true
    } else if (isIfStatement(statement)) {
      // Parser enforces that if/else have braces (block statement)
      hasContinue = hasContinue || hasContinueStatementIf(statement as es.IfStatement)
    } else if (isBlockStatement(statement) || isStatementSequence(statement)) {
      hasContinue = hasContinue || hasContinueStatement(statement)
    }
  }
  return hasContinue
}

type PropertySetter = Map<string, Transformer>
type Transformer = (item: ControlItem) => ControlItem

const setToTrue = (item: ControlItem): ControlItem => {
  item.isEnvDependent = true
  return item
}

const setToFalse = (item: ControlItem): ControlItem => {
  item.isEnvDependent = false
  return item
}

const propertySetter: PropertySetter = new Map<string, Transformer>([
  [
    'Program',
    (node: Node) => {
      node = node as es.Program
      node.isEnvDependent = node.body.some(elem => isEnvDependent(elem))
      return node
    }
  ],
  ['Literal', setToFalse],
  ['ImportDeclaration', setToFalse],
  ['BreakStatement', setToFalse],
  ['ContinueStatement', setToFalse],
  ['DebuggerStatement', setToFalse],
  ['VariableDeclaration', setToTrue],
  ['FunctionDeclaration', setToTrue],
  ['ArrowFunctionExpression', setToTrue],
  ['Identifier', setToTrue],
  [
    'LogicalExpression',
    (node: Node) => {
      node = node as es.LogicalExpression
      node.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right)
      return node
    }
  ],
  [
    'BinaryExpression',
    (node: Node) => {
      node = node as es.BinaryExpression
      node.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right)
      return node
    }
  ],
  [
    'UnaryExpression',
    (node: Node) => {
      node = node as es.UnaryExpression
      node.isEnvDependent = isEnvDependent(node.argument)
      return node
    }
  ],
  [
    'ConditionalExpression',
    (node: Node) => {
      node = node as es.ConditionalExpression
      node.isEnvDependent =
        isEnvDependent(node.consequent) ||
        isEnvDependent(node.alternate) ||
        isEnvDependent(node.test)
      return node
    }
  ],
  [
    'MemberExpression',
    (node: Node) => {
      node = node as es.MemberExpression
      node.isEnvDependent = isEnvDependent(node.property) || isEnvDependent(node.object)
      return node
    }
  ],
  [
    'ArrayExpression',
    (node: Node) => {
      node = node as es.ArrayExpression
      node.isEnvDependent = node.elements.some(elem => isEnvDependent(elem))
      return node
    }
  ],
  [
    'AssignmentExpression',
    (node: Node) => {
      node = node as es.AssignmentExpression
      node.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right)
      return node
    }
  ],
  [
    'ReturnStatement',
    (node: Node) => {
      node = node as es.ReturnStatement
      node.isEnvDependent = isEnvDependent(node.argument)
      return node
    }
  ],
  [
    'CallExpression',
    (node: Node) => {
      node = node as es.CallExpression
      node.isEnvDependent =
        isEnvDependent(node.callee) || node.arguments.some(arg => isEnvDependent(arg))
      return node
    }
  ],
  [
    'ExpressionStatement',
    (node: Node) => {
      node = node as es.ExpressionStatement
      node.isEnvDependent = isEnvDependent(node.expression)
      return node
    }
  ],
  [
    'IfStatement',
    (node: Node) => {
      node = node as es.IfStatement
      node.isEnvDependent =
        isEnvDependent(node.test) ||
        isEnvDependent(node.consequent) ||
        isEnvDependent(node.alternate)
      return node
    }
  ],
  [
    'ForStatement',
    (node: Node) => {
      node = node as es.ForStatement
      node.isEnvDependent =
        isEnvDependent(node.body) ||
        isEnvDependent(node.init) ||
        isEnvDependent(node.test) ||
        isEnvDependent(node.update)
      return node
    }
  ],
  [
    'WhileStatement',
    (node: Node) => {
      node = node as es.WhileStatement
      node.isEnvDependent = isEnvDependent(node.body) || isEnvDependent(node.test)
      return node
    }
  ],
  [
    'BlockStatement',
    (node: Node) => {
      node = node as es.BlockStatement
      node.isEnvDependent = node.body.some(stm => isEnvDependent(stm))
      return node
    }
  ],
  [
    'StatementSequence',
    (node: Node) => {
      node = node as StatementSequence
      node.isEnvDependent = node.body.some(stm => isEnvDependent(stm))
      return node
    }
  ],

  [
    'ImportDeclaration',
    (node: Node) => {
      node = node as es.ImportDeclaration
      node.isEnvDependent = node.specifiers.some(x => isEnvDependent(x))
      return node
    }
  ],

  ['ImportSpecifier', setToTrue],

  ['ImportDefaultSpecifier', setToTrue],

  //Instruction
  [InstrType.RESET, setToFalse],
  [InstrType.UNARY_OP, setToFalse],
  [InstrType.BINARY_OP, setToFalse],
  [InstrType.POP, setToFalse],
  [InstrType.ARRAY_ACCESS, setToFalse],
  [InstrType.ARRAY_ASSIGNMENT, setToFalse],
  [InstrType.CONTINUE, setToFalse],
  [InstrType.CONTINUE_MARKER, setToFalse],
  [InstrType.BREAK_MARKER, setToFalse],
  [InstrType.MARKER, setToFalse],
  [InstrType.ENVIRONMENT, setToFalse],
  [InstrType.APPLICATION, setToTrue],
  [InstrType.ASSIGNMENT, setToTrue],
  [InstrType.ARRAY_LITERAL, setToTrue],
  [
    InstrType.WHILE,
    (instr: WhileInstr) => {
      instr.isEnvDependent = isEnvDependent(instr.test) || isEnvDependent(instr.body)
      return instr
    }
  ],
  [
    InstrType.FOR,
    (instr: ForInstr) => {
      instr.isEnvDependent =
        isEnvDependent(instr.init) ||
        isEnvDependent(instr.test) ||
        isEnvDependent(instr.update) ||
        isEnvDependent(instr.body)
      return instr
    }
  ],
  [
    InstrType.BRANCH,
    (instr: BranchInstr) => {
      instr.isEnvDependent = isEnvDependent(instr.consequent) || isEnvDependent(instr.alternate)
      return instr
    }
  ]
])

/**
 * Checks whether the evaluation of the given control item depends on the current environment.
 * The item is also considered environment dependent if its evaluation introduces
 * environment dependent items
 * @param item The control item to be checked
 * @return `true` if the item is environment depedent, else `false`.
 */

export function isEnvDependent(item: ControlItem | null | undefined): boolean {
  if (item === null || item === undefined) {
    return false
  }

  // Scheme primitives are not environment dependent.
  if (typeof item === 'string' || typeof item === 'boolean') {
    return false
  }

  // Scheme symbols represent identifiers, which are environment dependent.
  if (item instanceof _Symbol) {
    return true
  }

  // We assume no optimisations for scheme lists.
  if (isArray(item)) {
    return true
  }

  // If result is already calculated, return it
  if (item.isEnvDependent !== undefined) {
    return item.isEnvDependent
  }

  const setter = isNode(item)
    ? propertySetter.get(item.type)
    : isInstr(item)
    ? propertySetter.get(item.instrType)
    : undefined

  if (setter) {
    return setter(item)?.isEnvDependent ?? false
  }

  return false
}
