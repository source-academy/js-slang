/**
 * Utility functions for creating the various control instructions.
 */

import * as es from 'estree'

import { Environment, Node } from '../types'
import {
  AppInstr,
  ArrLitInstr,
  AssmtInstr,
  BinOpInstr,
  BranchInstr,
  EnvInstr,
  ForInstr,
  Instr,
  InstrType,
  UnOpInstr,
  WhileInstr,
  type DeclAssmtInstr,
  type RegularAssmtInstr
} from './types'
import { Transformers } from './interpreter'

export const resetInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.RESET,
  srcNode
})

export const whileInstr = (test: es.Expression, body: es.Statement, srcNode: Node): WhileInstr => ({
  instrType: InstrType.WHILE,
  test,
  body,
  srcNode
})

export const forInstr = (
  init: es.VariableDeclaration | es.Expression,
  test: es.Expression,
  update: es.Expression,
  body: es.Statement,
  srcNode: es.ForStatement
): ForInstr => ({
  instrType: InstrType.FOR,
  init,
  test,
  update,
  body,
  srcNode
})

export function assmtInstr(symbol: string, srcNode: es.VariableDeclaration): DeclAssmtInstr
export function assmtInstr(symbol: string, srcNode: es.AssignmentExpression): RegularAssmtInstr
export function assmtInstr(
  symbol: string,
  srcNode: es.VariableDeclaration | es.AssignmentExpression
): AssmtInstr {
  if (srcNode.type === 'VariableDeclaration') {
    return {
      instrType: InstrType.ASSIGNMENT,
      symbol,
      constant: srcNode.kind === 'const',
      declaration: true,
      srcNode
    }
  }

  return {
    instrType: InstrType.ASSIGNMENT,
    symbol,
    declaration: false,
    srcNode
  }
}

export const unOpInstr = (symbol: es.UnaryOperator, srcNode: es.UnaryExpression): UnOpInstr => ({
  instrType: InstrType.UNARY_OP,
  symbol,
  srcNode
})

export const binOpInstr = (symbol: es.BinaryOperator, srcNode: Node): BinOpInstr => ({
  instrType: InstrType.BINARY_OP,
  symbol,
  srcNode
})

export const popInstr = (srcNode: Node): Instr => ({ instrType: InstrType.POP, srcNode })

export const appInstr = (numOfArgs: number, srcNode: es.CallExpression): AppInstr => ({
  instrType: InstrType.APPLICATION,
  numOfArgs,
  srcNode
})

export const branchInstr = (
  consequent: es.Expression | es.Statement,
  alternate: es.Expression | es.Statement | null | undefined,
  srcNode: Node
): BranchInstr => ({
  instrType: InstrType.BRANCH,
  consequent,
  alternate,
  srcNode
})

export const envInstr = (
  env: Environment,
  transformers: Transformers,
  srcNode: Node
): EnvInstr => ({
  instrType: InstrType.ENVIRONMENT,
  env,
  transformers,
  srcNode
})

export const arrLitInstr = (arity: number, srcNode: Node): ArrLitInstr => ({
  instrType: InstrType.ARRAY_LITERAL,
  arity,
  srcNode
})

export const arrAccInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.ARRAY_ACCESS,
  srcNode
})

export const arrAssmtInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.ARRAY_ASSIGNMENT,
  srcNode
})

export const markerInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.MARKER,
  srcNode
})

export const contInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.CONTINUE,
  srcNode
})

export const contMarkerInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.CONTINUE_MARKER,
  srcNode
})

export const breakInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.BREAK,
  srcNode
})

export const breakMarkerInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.BREAK_MARKER,
  srcNode
})

export const spreadInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.SPREAD,
  srcNode
})
