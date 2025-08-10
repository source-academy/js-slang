import * as es from 'estree'

import { Environment, Node } from '../types'
import Closure from './closure'
import { SchemeControlItems } from './scheme-macros'
import { Transformers } from './transformers'

export enum InstrType {
  RESET = 'Reset',
  WHILE = 'While',
  FOR = 'For',
  ASSIGNMENT = 'Assignment',
  UNARY_OP = 'UnaryOperation',
  BINARY_OP = 'BinaryOperation',
  POP = 'Pop',
  APPLICATION = 'Application',
  BRANCH = 'Branch',
  ENVIRONMENT = 'Environment',
  ARRAY_LITERAL = 'ArrayLiteral',
  ARRAY_ACCESS = 'ArrayAccess',
  ARRAY_ASSIGNMENT = 'ArrayAssignment',
  ARRAY_LENGTH = 'ArrayLength',
  MARKER = 'Marker',
  CONTINUE = 'Continue',
  CONTINUE_MARKER = 'ContinueMarker',
  BREAK = 'Break',
  BREAK_MARKER = 'BreakMarker',
  SPREAD = 'Spread'
}

interface BaseInstr<T extends InstrType = InstrType, U extends Node = Node> {
  instrType: T
  srcNode: U
  isEnvDependent?: boolean
}

export interface WhileInstr extends BaseInstr<InstrType.WHILE> {
  test: es.Expression
  body: es.Statement
}

export interface ForInstr extends BaseInstr<InstrType.FOR> {
  init: es.VariableDeclaration | es.Expression
  test: es.Expression
  update: es.Expression
  body: es.Statement
}

export interface AssmtInstr extends BaseInstr<InstrType.ASSIGNMENT> {
  symbol: string
  constant: boolean
  declaration: boolean
}

export interface UnOpInstr extends BaseInstr<InstrType.UNARY_OP> {
  symbol: es.UnaryOperator
}

export interface BinOpInstr extends BaseInstr<InstrType.BINARY_OP> {
  symbol: es.BinaryOperator
}

export interface AppInstr extends BaseInstr<InstrType.APPLICATION, es.CallExpression> {
  numOfArgs: number
  srcNode: es.CallExpression
}

export interface BranchInstr extends BaseInstr<InstrType.BRANCH> {
  consequent: es.Expression | es.Statement
  alternate: es.Expression | es.Statement | null | undefined
}

export interface EnvInstr extends BaseInstr<InstrType.ENVIRONMENT> {
  env: Environment
  transformers: Transformers
}

export interface ArrLitInstr extends BaseInstr<InstrType.ARRAY_LITERAL> {
  arity: number
}

export interface SpreadInstr extends BaseInstr<InstrType.SPREAD> {
  symbol: es.SpreadElement
}

export type Instr =
  | AppInstr
  | ArrLitInstr
  | AssmtInstr
  | BaseInstr
  | BranchInstr
  | BinOpInstr
  | EnvInstr
  | ForInstr
  | SpreadInstr
  | UnOpInstr
  | WhileInstr

export type ControlItem = (Node | Instr | SchemeControlItems) & {
  isEnvDependent?: boolean
}

// Every array also has the properties `id` and `environment` for use in the frontend CSE Machine
export type EnvArray = any[] & {
  readonly id: string
  environment: Environment
}

// Objects in the heap can only store arrays or closures
export type HeapObject = EnvArray | Closure

// Special class that cannot be found on the stash so is safe to be used
// as an indicator of a breakpoint from running the CSE machine
export class CSEBreak {}

// Special value that cannot be found on the stash so is safe to be used
// as an indicator of an error from running the CSE machine
export class CseError {
  constructor(public readonly error: any) {}
}
