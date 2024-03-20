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
  GenContInstr,
  Instr,
  InstrType,
  ResumeContInstr,
  UnOpInstr,
  WhileInstr
} from './types'

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
  srcNode: Node
): ForInstr => ({
  instrType: InstrType.FOR,
  init,
  test,
  update,
  body,
  srcNode
})

export const assmtInstr = (
  symbol: string,
  constant: boolean,
  declaration: boolean,
  srcNode: Node
): AssmtInstr => ({
  instrType: InstrType.ASSIGNMENT,
  symbol,
  constant,
  declaration,
  srcNode
})

export const unOpInstr = (symbol: es.UnaryOperator, srcNode: Node): UnOpInstr => ({
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

export const envInstr = (env: Environment, srcNode: Node): EnvInstr => ({
  instrType: InstrType.ENVIRONMENT,
  env,
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

export const genContInstr = (srcNode: Node): GenContInstr => ({
  instrType: InstrType.GENERATE_CONT,
  srcNode
})

export const resumeContInstr = (numOfArgs: number, srcNode: es.Node): ResumeContInstr => ({
  numOfArgs: numOfArgs,
  instrType: InstrType.RESUME_CONT,
  srcNode
})
