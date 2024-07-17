import * as es from 'estree'

import { Environment, Node } from '../types'
import Closure from './closure'

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
  BREAK_MARKER = 'BreakMarker'
}

interface BaseInstr {
  instrType: InstrType
  srcNode: Node
}

export interface WhileInstr extends BaseInstr {
  test: es.Expression
  body: es.Statement
}

export interface ForInstr extends BaseInstr {
  init: es.VariableDeclaration | es.Expression
  test: es.Expression
  update: es.Expression
  body: es.Statement
}

export interface AssmtInstr extends BaseInstr {
  symbol: string
  constant: boolean
  declaration: boolean
}

export interface UnOpInstr extends BaseInstr {
  symbol: es.UnaryOperator
}

export interface BinOpInstr extends BaseInstr {
  symbol: es.BinaryOperator
}

export interface AppInstr extends BaseInstr {
  numOfArgs: number
  srcNode: es.CallExpression
}

export interface BranchInstr extends BaseInstr {
  consequent: es.Expression | es.Statement
  alternate: es.Expression | es.Statement | null | undefined
}

export interface EnvInstr extends BaseInstr {
  env: Environment
}

export interface ArrLitInstr extends BaseInstr {
  arity: number
}

export type GenContInstr = BaseInstr

export interface ResumeContInstr extends BaseInstr {
  numOfArgs: number
}

export type Instr =
  | BaseInstr
  | WhileInstr
  | AssmtInstr
  | AppInstr
  | BranchInstr
  | EnvInstr
  | ArrLitInstr

export type ControlItem = (Node | Instr) & {
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
