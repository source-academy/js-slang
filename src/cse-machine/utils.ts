import type es from 'estree'
import { isFunction } from 'lodash'

import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import { is_number } from '../alt-langs/scheme/scm-slang/src/stdlib/core-math'
import { RuntimeSourceError } from '../errors/errorBase'
import * as errors from '../errors/errors'
import { Chapter } from '../langs'
import type { Context, Environment, NodeTypeToNode, Value } from '../types'
import * as ast from '../utils/ast/astCreator'
import type { Node, StatementSequence } from '../utils/ast/node'
import { isDeclaration, isIdentifier, isImportDeclaration } from '../utils/ast/typeGuards'
import Closure from './closure'
import { Continuation, isCallWithCurrentContinuation } from './continuations'
import Heap from './heap'
import * as instr from './instrCreator'
import { isApply, isEval } from './scheme-macros'
import {
  InstrType,
  type AppInstr,
  type Control,
  type ControlItem,
  type EnvArray,
  type Instr,
  type InstrTypeToInstr,
  type Transformers
} from './types'

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
    Array.isArray(command) ||
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
  return 'instrType' in command
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
  return 'type' in command
}

/**
 * Typeguard for esReturnStatement. To verify if a Node is an esReturnStatement.
 *
 * @param node a Node
 * @returns true if node is an esReturnStatement, false otherwise.
 */
export const isReturnStatement = (node: Node): node is es.ReturnStatement => {
  return node.type === 'ReturnStatement'
}

/**
 * Typeguard for esIfStatement. To verify if a Node is an esIfStatement.
 *
 * @param node a Node
 * @returns true if node is an esIfStatement, false otherwise.
 */
export const isIfStatement = (node: Node): node is es.IfStatement => {
  return node.type === 'IfStatement'
}

/**
 * Typeguard for esBlockStatement. To verify if a Node is a block statement.
 *
 * @param node a Node
 * @returns true if node is an esBlockStatement, false otherwise.
 */
export const isBlockStatement = (node: Node): node is es.BlockStatement => {
  return node.type === 'BlockStatement'
}

/**
 * Typeguard for StatementSequence. To verify if a ControlItem is a statement sequence.
 *
 * @param node a ControlItem
 * @returns true if node is a StatementSequence, false otherwise.
 */
export const isStatementSequence = (node: ControlItem): node is StatementSequence => {
  return isNode(node) && node.type === 'StatementSequence'
}

/**
 * Typeguard for esRestElement. To verify if a Node is a block statement.
 *
 * @param node a Node
 * @returns true if node is an esRestElement, false otherwise.
 */
export const isRestElement = (node: Node): node is es.RestElement => {
  return node.type == 'RestElement'
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
    Array.isArray(item) &&
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
  if (result == null || !Array.isArray(result) || result.length !== 2) return false
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
export const handleSequence = (seq: es.Program['body']): ControlItem[] => {
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

// TODO: This type guard does not seem to be doing what it thinks its doing
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
 * Transformers
 */
export const currentTransformers = (context: Context) =>
  context.runtime.transformers as Transformers

export const setTransformers = (context: Context, transformers: Transformers) => {
  context.runtime.transformers = transformers
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
      : (closure.declaredName ?? closure.functionName),
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
  if (Object.hasOwnProperty.call(environment.head, name)) {
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
  node: es.BlockStatement | es.Program,
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

export function hasDeclarations(node: es.Program | es.BlockStatement): boolean {
  return node.body.some(isDeclaration)
}

export function hasImportDeclarations(node: es.Program | es.BlockStatement): boolean {
  return node.body.some(isImportDeclaration)
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
    if (Object.hasOwnProperty.call(environment.head, name)) {
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
    if (Object.hasOwnProperty.call(environment.head, name)) {
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
  } else if (isApply(callee)) {
    // apply should have at least two arguments
    if (args.length < 2) {
      return handleRuntimeError(
        context,
        new errors.InvalidNumberOfArguments(exp, 2, args.length, false)
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
      hasReturn = hasReturn && hasReturnStatementIf(statement.alternate)
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
      hasReturn = hasReturn || hasReturnStatementIf(statement)
    } else if (isBlockStatement(statement) || isStatementSequence(statement)) {
      hasReturn = hasReturn && hasReturnStatement(statement)
    }
  }
  return hasReturn
}

/**
 * Recursively checks whether a block OR any of its child blocks has the specified node type
 */
function nodeVisitor(node: Node, type: Node['type']): boolean {
  switch (node.type) {
    case 'IfStatement': {
      const { consequent, alternate } = node
      return nodeVisitor(consequent, type) || (!!alternate && nodeVisitor(alternate, type))
    }
    case 'Program':
    case 'BlockStatement':
    case 'StatementSequence':
      return node.body.some(each => nodeVisitor(each, type))
    default:
      return node.type === type
  }
}

/**
 * Checks whether a block OR any of its child blocks has a `break` statement.
 * @param body The block to be checked
 * @return `true` if there is a `break` statement, else `false`.
 */
export function hasBreakStatement(block: es.BlockStatement | StatementSequence) {
  return nodeVisitor(block, 'BreakStatement')
}

/**
 * Checks whether a block OR any of its child blocks has a `continue` statement.
 * @return `true` if there is a `continue` statement, else `false`.
 */
export function hasContinueStatement(node: es.BlockStatement | StatementSequence) {
  return nodeVisitor(node, 'ContinueStatement')
}

type TypeOrArray<T> = T | T[]

/**
 * Utility type that extracts all the keys of a ControlItem type that is assignable to
 * a Node
 */
type KeysThatContainNodes<T extends ControlItem> = {
  [K in keyof T as T[K] extends Node | null | undefined ? K : never]: K
}

/**
 * Extracts all the keys of a ControlItem type that are assignable to Nodes as a union
 */
type NodeNames<T extends ControlItem> = TypeOrArray<
  KeysThatContainNodes<T>[keyof KeysThatContainNodes<T>]
>

/**
 * A specification for how to determine if a ControlItem is env dependent or not:\
 * - If a boolean is specified, that is used directly
 * - If a single string is provided, the property by that name is indexed and its value is checked
 * - If an array of strings is provided, the properties by those names are indexed and their values are checked
 * - If a function is provided, the function is called with the ControlItem as its first parameter
 */
type NodeEnvCalculator<T extends ControlItem> = boolean | NodeNames<T> | ((node: T) => boolean)

type NodeEnvCalculators = {
  [K in Node['type']]?: NodeEnvCalculator<NodeTypeToNode<K>>
} & {
  [K in InstrType]?: NodeEnvCalculator<InstrTypeToInstr<K>>
}

const calculators: NodeEnvCalculators = {
  ArrayExpression: ({ elements }) => elements.some(isEnvDependent),
  ArrowFunctionExpression: true,
  AssignmentExpression: ['left', 'right'],
  BinaryExpression: ['left', 'right'],
  BlockStatement: ({ body }) => body.some(isEnvDependent),
  BreakStatement: false,
  CallExpression: ({ callee, arguments: args }) =>
    isEnvDependent(callee) || args.some(isEnvDependent),
  ConditionalExpression: ['alternate', 'consequent', 'test'],
  ContinueStatement: false,
  DebuggerStatement: false,
  ExpressionStatement: 'expression',
  ForStatement: ['body', 'init', 'test', 'update'],
  FunctionDeclaration: true,
  Identifier: true,
  IfStatement: ['alternate', 'consequent', 'test'],
  ImportDeclaration: ({ specifiers }) => specifiers.some(isEnvDependent),
  ImportDefaultSpecifier: true,
  ImportSpecifier: true,
  Literal: false,
  LogicalExpression: ['left', 'right'],
  MemberExpression: ['object', 'property'],
  Program: ({ body }) => body.some(isEnvDependent),
  ReturnStatement: 'argument',
  StatementSequence: ({ body }) => body.some(isEnvDependent),
  UnaryExpression: 'argument',
  VariableDeclaration: true,
  WhileStatement: ['body', 'test'],

  [InstrType.APPLICATION]: true,
  [InstrType.ARRAY_ACCESS]: false,
  [InstrType.ARRAY_ASSIGNMENT]: false,
  [InstrType.ARRAY_LITERAL]: true,
  [InstrType.ASSIGNMENT]: true,
  [InstrType.BINARY_OP]: false,
  [InstrType.BRANCH]: ['consequent', 'alternate'],
  [InstrType.BREAK_MARKER]: false,
  [InstrType.CONTINUE]: false,
  [InstrType.CONTINUE_MARKER]: false,
  [InstrType.ENVIRONMENT]: false,
  [InstrType.FOR]: ['body', 'init', 'test', 'update'],
  [InstrType.MARKER]: false,
  [InstrType.POP]: false,
  [InstrType.RESET]: false,
  [InstrType.SPREAD]: false,
  [InstrType.UNARY_OP]: false,
  [InstrType.WHILE]: ['body', 'test']
}

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
  if (Array.isArray(item)) {
    return true
  }

  // If result is already calculated, return it
  if (item.isEnvDependent !== undefined) {
    return item.isEnvDependent
  }

  let setter
  if (isNode(item)) {
    setter = calculators[item.type]
  } else if (isInstr(item)) {
    setter = calculators[item.instrType]
  }

  switch (typeof setter) {
    case 'boolean': {
      item.isEnvDependent = setter
      break
    }
    case 'undefined': {
      item.isEnvDependent = false
      break
    }
    case 'string': {
      // @ts-expect-error Trying to index an arbitrary node with an arbitrary indexer
      item.isEnvDependent = isEnvDependent(item[setter])
      break
    }
    case 'function': {
      // @ts-expect-error Type of setter's parameter gets narrowed to `never`
      item.isEnvDependent = setter(item)
      break
    }
    default: {
      if (!Array.isArray(setter)) {
        throw new Error(`Invalid setter value: ${setter}`)
      }

      // @ts-expect-error Trying to index an arbitrary node with an arbitrary indexer
      item.isEnvDependent = setter.some(each => isEnvDependent(item[each]))
      break
    }
  }

  return item.isEnvDependent
}
