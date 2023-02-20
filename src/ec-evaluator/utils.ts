import * as es from 'estree'

import {} from '../utils/astCreator'
import { popInstr } from './instrCreator'
import { AgendaItem, Instr } from './types'

/**
 * Stack is implemented for agenda and stash registers.
 */
interface IStack<T> {
  push(...items: T[]): void
  pop(): T | undefined
  peek(): T | undefined
  size(): number
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
    if (this.size() === 0) {
      return undefined
    }
    return this.storage[this.size() - 1]
  }

  public size(): number {
    return this.storage.length
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
 * Typeguard for esBlockStatement. To verify if a function body is a block statement.
 *
 * @param body the function body
 * @returns true if node is an esIdentifier, false otherwise.
 */
export const isExpressionBody = (
  body: es.BlockStatement | es.Expression
): body is es.Expression => {
  return body.type !== 'BlockStatement'
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
    if (valueProducing(command)) {
      valueProduced ? result.push(popInstr()) : (valueProduced = true)
    }
    result.push(command)
  }
  return result.reverse()
}

/**
 * To determine if an agenda item is value producing. JavaScript distinguishes valu producing
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
    (type !== 'BlockStatement' || command.body.some(valueProducing))
  )
}
