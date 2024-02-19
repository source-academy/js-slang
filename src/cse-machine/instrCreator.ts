/**
 * Utility functions for creating the various control instructions.
 */

import * as es from 'estree'

import { Environment } from '../types'
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

export const resetInstr = (srcNode: es.Node): Instr => ({
  instrType: InstrType.RESET,
  srcNode
})

export const whileInstr = (
  test: es.Expression,
  body: es.Statement,
  srcNode: es.Node
): WhileInstr => ({
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
  srcNode: es.Node
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
  srcNode: es.Node
): AssmtInstr => ({
  instrType: InstrType.ASSIGNMENT,
  symbol,
  constant,
  declaration,
  srcNode
})

export const unOpInstr = (symbol: es.UnaryOperator, srcNode: es.Node): UnOpInstr => ({
  instrType: InstrType.UNARY_OP,
  symbol,
  srcNode
})

export const binOpInstr = (symbol: es.BinaryOperator, srcNode: es.Node): BinOpInstr => ({
  instrType: InstrType.BINARY_OP,
  symbol,
  srcNode
})

export const popInstr = (srcNode: es.Node): Instr => ({ instrType: InstrType.POP, srcNode })

export const appInstr = (numOfArgs: number, srcNode: es.CallExpression): AppInstr => ({
  instrType: InstrType.APPLICATION,
  numOfArgs,
  srcNode
})

export const branchInstr = (
  consequent: es.Expression | es.Statement,
  alternate: es.Expression | es.Statement | null | undefined,
  srcNode: es.Node
): BranchInstr => ({
  instrType: InstrType.BRANCH,
  consequent,
  alternate,
  srcNode
})

export const envInstr = (env: Environment, srcNode: es.Node): EnvInstr => ({
  instrType: InstrType.ENVIRONMENT,
  env,
  srcNode
})

export const arrLitInstr = (arity: number, srcNode: es.Node): ArrLitInstr => ({
  instrType: InstrType.ARRAY_LITERAL,
  arity,
  srcNode
})

export const arrAccInstr = (srcNode: es.Node): Instr => ({
  instrType: InstrType.ARRAY_ACCESS,
  srcNode
})

export const arrAssmtInstr = (srcNode: es.Node): Instr => ({
  instrType: InstrType.ARRAY_ASSIGNMENT,
  srcNode
})

export const markerInstr = (srcNode: es.Node): Instr => ({
  instrType: InstrType.MARKER,
  srcNode
})

export const contInstr = (srcNode: es.Node): Instr => ({
  instrType: InstrType.CONTINUE,
  srcNode
})

export const contMarkerInstr = (srcNode: es.Node): Instr => ({
  instrType: InstrType.CONTINUE_MARKER,
  srcNode
})

export const breakInstr = (srcNode: es.Node): Instr => ({
  instrType: InstrType.BREAK,
  srcNode
})

export const breakMarkerInstr = (srcNode: es.Node): Instr => ({
  instrType: InstrType.BREAK_MARKER,
  srcNode
})

export const genContInstr = (srcNode: es.Node): GenContInstr => ({
  instrType: InstrType.GENERATE_CONT,
  srcNode
})

export const resumeContInstr = (srcNode: es.Node): ResumeContInstr => ({
  instrType: InstrType.RESUME_CONT,
  srcNode
})
