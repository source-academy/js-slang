import * as es from 'estree'

import { Context } from '..'
import { Environment } from '../types'
import { Agenda, Stash } from './interpreter'

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
  PUSH_UNDEFINED_IF_NEEDED = 'PushUndefinedIfNeeded',
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
}

export interface WhileInstr extends BaseInstr {
  test: es.Expression
  body: es.Statement
  srcNode: es.Node
}

export interface ForInstr extends BaseInstr {
  init: es.VariableDeclaration | es.Expression
  test: es.Expression
  update: es.Expression
  body: es.Statement
  srcNode: es.Node
}

export interface AssmtInstr extends BaseInstr {
  symbol: string
  constant: boolean
  declaration: boolean
  srcNode: es.Node
}

export interface UnOpInstr extends BaseInstr {
  symbol: es.UnaryOperator
  srcNode: es.Node
}

export interface BinOpInstr extends BaseInstr {
  symbol: es.BinaryOperator
  srcNode: es.Node
}

export interface AppInstr extends BaseInstr {
  numOfArgs: number
  srcNode: es.CallExpression
}

export interface BranchInstr extends BaseInstr {
  consequent: es.Expression | es.Statement
  alternate: es.Expression | es.Statement | null | undefined
  srcNode: es.Node
}

export interface EnvInstr extends BaseInstr {
  env: Environment
}

export interface ArrLitInstr extends BaseInstr {
  arity: number
}

export type Instr =
  | BaseInstr
  | WhileInstr
  | AssmtInstr
  | AppInstr
  | BranchInstr
  | EnvInstr
  | ArrLitInstr

export type AgendaItem = es.Node | Instr

export type CmdEvaluator = (
  command: AgendaItem,
  context: Context,
  agenda: Agenda,
  stash: Stash
) => void

// Special class that cannot be found on the stash so is safe to be used
// as an indicator of a breakpoint from running the ECE machine
export class ECEBreak {}

// Special value that cannot be found on the stash so is safe to be used
// as an indicator of an error from running the ECE machine
export class ECError {}
