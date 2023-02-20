/**
 * Utility functions for creating the various agenda instructions.
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
  Instr,
  InstrType,
  UnOpInstr,
  WhileInstr
} from './types'

export const resetInstr = (): Instr => ({
  instrType: InstrType.RESET
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

export const popInstr = (): Instr => ({ instrType: InstrType.POP })

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

export const envInstr = (env: Environment): EnvInstr => ({
  instrType: InstrType.ENVIRONMENT,
  env
})

export const pushUndefIfNeededInstr = (): Instr => ({
  instrType: InstrType.PUSH_UNDEFINED_IF_NEEDED
})

export const arrLitInstr = (arity: number): ArrLitInstr => ({
  instrType: InstrType.ARRAY_LITERAL,
  arity
})

export const arrAccInstr = (): Instr => ({
  instrType: InstrType.ARRAY_ACCESS
})

export const arrAssmtInstr = (): Instr => ({
  instrType: InstrType.ARRAY_ASSIGNMENT
})

export const markerInstr = (): Instr => ({
  instrType: InstrType.MARKER
})

export const contInstr = (): Instr => ({
  instrType: InstrType.CONTINUE
})

export const contMarkerInstr = (): Instr => ({
  instrType: InstrType.CONTINUE_MARKER
})

export const breakInstr = (): Instr => ({
  instrType: InstrType.BREAK
})

export const breakMarkerInstr = (): Instr => ({
  instrType: InstrType.BREAK_MARKER
})

// export const breakMarkerInstr = (): IInstr => ({ instrType: InstrTypes.BREAK_MARKER })
