import * as es from 'estree'
import { uniqueId } from 'lodash'

import { Context } from '..'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import Closure from '../interpreter/closure'
import { Environment, Frame, Value } from '../types'
import * as ast from '../utils/astCreator'
import * as instr from './instrCreator'
import { Agenda } from './interpreter'
import { AgendaItem, AppInstr, AssmtInstr, Instr, InstrType } from './types'

/**
 * Stack is implemented for agenda and stash registers.
 */
interface IStack<T> {
  push(...items: T[]): void
  pop(): T | undefined
  peek(): T | undefined
  size(): number
  isEmpty(): boolean
  getStack(): T[]
}

export class Stack<T> implements IStack<T> {
  // Bottom of the array is at index 0
  private storage: T[] = []

  public constructor() {}

  public push(...items: T[]): void {
    for (const item of items) {
      this.storage.push(item)
    }
  }

  public pop(): T | undefined {
    return this.storage.pop()
  }

  public peek(): T | undefined {
    if (this.isEmpty()) {
      return undefined
    }
    return this.storage[this.size() - 1]
  }

  public size(): number {
    return this.storage.length
  }

  public isEmpty(): boolean {
    return this.size() == 0
  }

  public getStack(): T[] {
    // return a copy of the stack's contents
    return [...this.storage]
  }

  public some(predicate: (value: T) => boolean): boolean {
    return this.storage.some(predicate)
  }
}

/**
 * Typeguard for Instr to distinguish between program statements and instructions.
 *
 * @param command An AgendaItem
 * @returns true if the AgendaItem is an instruction and false otherwise.
 */
export const isInstr = (command: AgendaItem): command is Instr => {
  return (command as Instr).instrType !== undefined
}

/**
 * Typeguard for esNode to distinguish between program statements and instructions.
 *
 * @param command An AgendaItem
 * @returns true if the AgendaItem is an esNode and false if it is an instruction.
 */
export const isNode = (command: AgendaItem): command is es.Node => {
  return (command as es.Node).type !== undefined
}

/**
 * Typeguard for esIdentifier. To verify if an esNode is an esIdentifier.
 *
 * @param node an esNode
 * @returns true if node is an esIdentifier, false otherwise.
 */
export const isIdentifier = (node: es.Node): node is es.Identifier => {
  return (node as es.Identifier).name !== undefined
}

/**
 * Typeguard for esReturnStatement. To verify if an esNode is an esReturnStatement.
 *
 * @param node an esNode
 * @returns true if node is an esReturnStatement, false otherwise.
 */
export const isReturnStatement = (node: es.Node): node is es.ReturnStatement => {
  return (node as es.ReturnStatement).type == 'ReturnStatement'
}

/**
 * Typeguard for esIfStatement. To verify if an esNode is an esIfStatement.
 *
 * @param node an esNode
 * @returns true if node is an esIfStatement, false otherwise.
 */
export const isIfStatement = (node: es.Node): node is es.IfStatement => {
  return (node as es.IfStatement).type == 'IfStatement'
}

/**
 * Typeguard for esBlockStatement. To verify if an esNode is a block statement.
 *
 * @param node an esNode
 * @returns true if node is an esBlockStatement, false otherwise.
 */
export const isBlockStatement = (node: es.Node): node is es.BlockStatement => {
  return (node as es.BlockStatement).type == 'BlockStatement'
}

/**
 * Typeguard for esRestElement. To verify if an esNode is a block statement.
 *
 * @param node an esNode
 * @returns true if node is an esRestElement, false otherwise.
 */
export const isRestElement = (node: es.Node): node is es.RestElement => {
  return (node as es.RestElement).type == 'RestElement'
}

/**
 * Typeguard for AssmtInstr. To verify if an instruction is an assignment instruction.
 *
 * @param instr an instruction
 * @returns true if instr is an AssmtInstr, false otherwise.
 */
export const isAssmtInstr = (instr: Instr): instr is AssmtInstr => {
  return instr.instrType === InstrType.ASSIGNMENT
}

/**
 * A helper function for handling sequences of statements.
 * Statements must be pushed in reverse order, and each statement is separated by a pop
 * instruction so that only the result of the last statement remains on stash.
 * Value producing statements have an extra pop instruction.
 *
 * @param seq Array of statements.
 * @returns Array of commands to be pushed into agenda.
 */
export const handleSequence = (seq: es.Statement[]): AgendaItem[] => {
  const result: AgendaItem[] = []
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
 * of agenda items to be added.
 */
export const reduceConditional = (
  node: es.IfStatement | es.ConditionalExpression
): AgendaItem[] => {
  return [instr.branchInstr(node.consequent, node.alternate, node), node.test]
}

/**
 * To determine if an agenda item is value producing. JavaScript distinguishes value producing
 * statements and non-value producing statements.
 * Refer to https://sourceacademy.nus.edu.sg/sicpjs/4.1.2 exercise 4.8.
 *
 * @param command Agenda item to determine if it is value producing.
 * @returns true if it is value producing, false otherwise.
 */
export const valueProducing = (command: es.Node): boolean => {
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
 * To determine if an agenda item changes the environment.
 * There is a change in the environment when
 *  1. pushEnvironment() is called when creating a new frame, if there are variable declarations.
 *     Called in Program, BlockStatement, and Application instructions.
 *  2. there is an assignment.
 *     Called in Assignment and Array Assignment instructions.
 *
 * @param command Agenda item to check against.
 * @returns true if it changes the environment, false otherwise.
 */
export const envChanging = (command: AgendaItem): boolean => {
  if (isNode(command)) {
    const type = command.type
    return type === 'Program' || (type === 'BlockStatement' && hasDeclarations(command))
  } else {
    const type = command.instrType
    return (
      type === InstrType.ASSIGNMENT ||
      type === InstrType.ARRAY_ASSIGNMENT ||
      (type === InstrType.APPLICATION && (command as AppInstr).numOfArgs > 0)
    )
  }
}

/**
 * To determine if the function is simple.
 * Simple functions contain a single return statement.
 *
 * @param node The function to check against.
 * @returns true if the function is simple, false otherwise.
 */
export const isSimpleFunction = (node: es.Function) => {
  if (node.body.type !== 'BlockStatement') {
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
  closure: Closure,
  args: Value[],
  callExpression: es.CallExpression
): Environment => {
  const environment: Environment = {
    name: isIdentifier(callExpression.callee) ? callExpression.callee.name : closure.functionName,
    tail: closure.environment,
    head: {},
    id: uniqueId(),
    callExpression: {
      ...callExpression,
      arguments: args.map(ast.primitive)
    }
  }
  closure.node.params.forEach((param, index) => {
    if (isRestElement(param)) {
      environment.head[(param.argument as es.Identifier).name] = args.slice(index)
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

/**
 * Variables
 */

const DECLARED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement block scope')

export function declareIdentifier(
  context: Context,
  name: string,
  node: es.Node,
  environment: Environment
) {
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

function declareVariables(
  context: Context,
  node: es.VariableDeclaration,
  environment: Environment
) {
  for (const declaration of node.declarations) {
    declareIdentifier(context, (declaration.id as es.Identifier).name, node, environment)
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
        declareIdentifier(context, (statement.id as es.Identifier).name, statement, environment)
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

function isImportDeclaration(node: es.Node): boolean {
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

export const getVariable = (context: Context, name: string, node: es.Identifier) => {
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

export const setVariable = (
  context: Context,
  name: string,
  value: any,
  node: es.AssignmentExpression
) => {
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
 * The current limit is set to be an agenda size of 1.0 x 10^5, if the agenda
 * flows beyond this limit an error is thrown.
 * This corresponds to about 10mb of space according to tests ran.
 */
export const checkStackOverFlow = (context: Context, agenda: Agenda) => {
  if (agenda.size() > 100000) {
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
 * Checks whether a function body returns in every possible branch.
 * Returns true if every branch has a return statement, else returns false.
 * @param body The function body to be checked
 */
export const hasReturnStatement = (body: es.Statement): boolean => {
  if (!isBlockStatement(body)) return isReturnStatement(body)
  for (const statement of body.body) {
    if (isReturnStatement(statement)) {
      return true
    }
    if (isIfStatement(statement)) {
      const consequent = hasReturnStatement(statement.consequent)
      if (!consequent) {
        return false
      }
      if (statement.alternate) {
        return hasReturnStatement(statement.alternate)
      }
    }
  }
  return false
}

export const hasBreakStatement = (block: es.BlockStatement): boolean => {
  let hasBreak = false
  for (const statement of block.body) {
    if (statement.type === 'BreakStatement') {
      hasBreak = true
    } else if (statement.type === 'IfStatement') {
      // Parser enforces that if/else have braces (block statement)
      hasBreak = hasBreak || hasBreakStatement(statement.consequent as es.BlockStatement)
      if (statement.alternate) {
        hasBreak = hasBreak || hasBreakStatement(statement.alternate as es.BlockStatement)
      }
    }
  }
  return hasBreak
}

export const hasContinueStatement = (block: es.BlockStatement): boolean => {
  let hasContinue = false
  for (const statement of block.body) {
    if (statement.type === 'ContinueStatement') {
      hasContinue = true
    } else if (statement.type === 'IfStatement') {
      // Parser enforces that if/else have braces (block statement)
      hasContinue = hasContinue || hasContinueStatement(statement.consequent as es.BlockStatement)
      if (statement.alternate) {
        hasContinue = hasContinue || hasContinueStatement(statement.alternate as es.BlockStatement)
      }
    }
  }
  return hasContinue
}
