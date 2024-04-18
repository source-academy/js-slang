export class BadExprError extends Error {
  constructor() {
    super('BadExpr')
  }
}

export class BadDeclError extends Error {
  constructor() {
    super('BadDecl')
  }
}

export class BadSpecError extends Error {
  constructor() {
    super('BadSpec')
  }
}

export class BadStmtError extends Error {
  constructor() {
    super('BadStmt')
  }
}
