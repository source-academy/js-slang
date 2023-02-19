import * as es from 'estree'

import { Context } from '..'
import { Environment, Value } from '../types'
import { Agenda, Stash } from './interpreter'

export enum InstrType {
  RESET = 'Reset',
  WHILE = 'While',
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
  MARKER = 'Marker'
}

interface BaseInstr {
  instrType: InstrType
}

export interface WhileInstr extends BaseInstr {
  test: es.Expression
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
) => Value

// Special value that cannot be found on the stash so is safe to return
// as an indicator of a breakpoint from running the ECE machine
export interface Break {
  break: boolean
}

// Tags taken from MicroPython interpreter
// export enum Tags {
//   /**
//    * Source §3 expressions
//    */
//   Lit = 'lit',
//   Nam = 'nam',
//   UnOp = 'unop',
//   BinOp = 'binop',
//   Log = 'log',
//   CondExpr = 'cond_expr',
//   App = 'app',
//   Assmt = 'assmt',
//   Lam = 'lam',
//   Spread = 'spread',
//   ArrLit = 'arr_lit',
//   ArrAcc = 'arr_acc',
//   ArrAssmt = 'arr_asmt',

//   /**
//    * Source §3 Statements
//    */
//   Import = 'import',
//   Seq = 'seq',
//   CondStmt = 'cond_stmt',
//   Blk = 'blk',
//   Let = 'let',
//   Const = 'const',
//   Ret = 'ret',
//   Fun = 'fun',
//   While = 'while',
//   For = 'for',
//   Prop = 'prop',

//   /**
//    * CSE machine instructions
//    */
//   ResetInstr = 'reset_i',
//   WhileInstr = 'while_i',
//   AssmtInstr = 'assmt_i',
//   UnOpInstr = 'unop_i',
//   BinOpInstr = 'binop_i',
//   PopInstr = 'pop_i',
//   AppInstr = 'app_i',
//   BranchInstr = 'branch_i',
//   EnvInstr = 'env_i',
//   PushUndefInstr = 'push_undefined_if_needed_i',
//   ArrLitInstr = 'arr_lit_i',
//   ArrAccInstr = 'arr_acc_i',
//   ArrAssmtInstr = 'arr_assmt_i'
// }
