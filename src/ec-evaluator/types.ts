import * as es from 'estree'

import { Context } from '..'
import { Environment, Value } from '../types'
import { Agenda, Stash } from './interpreter'

export type AgendaItem = es.Node | IInstr

// Might have to change each InstrType to its own interface because different instrtypes have different
// additional properties that they require.
export interface IInstr {
  instrType: InstrTypes
  symbol?: string // for Assignment
  constant?: boolean // for Assignment
  declaration?: boolean // for Assignment
  numOfArgs?: number // for Application
  expr?: es.CallExpression // for Application error handling
  env?: Environment // For restoring environments
}

export enum InstrTypes {
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
  ARRAY_ASSIGNMENT = 'ArrayAssignment',
  MARKER = 'Marker'
}

export type cmdEvaluator = (
  command: AgendaItem,
  context: Context,
  agenda: Agenda,
  stash: Stash
) => Value

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
