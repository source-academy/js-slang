export enum Tags {
  /**
   * Source §3 expressions
   */
  Lit = 'lit',
  Nam = 'nam',
  UnOp = 'unop',
  BinOp = 'binop',
  Log = 'log',
  CondExpr = 'cond_expr',
  App = 'app',
  Assmt = 'assmt',
  Lam = 'lam',
  Spread = 'spread',
  ArrLit = 'arr_lit',
  ArrAcc = 'arr_acc',
  ArrAssmt = 'arr_asmt',

  /**
   * Source §3 Statements
   */
  Import = 'import',
  Seq = 'seq',
  CondStmt = 'cond_stmt',
  Blk = 'blk',
  Let = 'let',
  Const = 'const',
  Ret = 'ret',
  Fun = 'fun',
  While = 'while',
  For = 'for',
  Prop = 'prop',

  /**
   * CSE machine instructions
   */
  ResetInstr = 'reset_i',
  WhileInstr = 'while_i',
  AssmtInstr = 'assmt_i',
  UnOpInstr = 'unop_i',
  BinOpInstr = 'binop_i',
  PopInstr = 'pop_i',
  AppInstr = 'app_i',
  BranchInstr = 'branch_i',
  EnvInstr = 'env_i',
  PushUndefInstr = 'push_undefined_if_needed_i',
  ArrLitInstr = 'arr_lit_i',
  ArrAccInstr = 'arr_acc_i',
  ArrAssmtInstr = 'arr_assmt_i'
}
