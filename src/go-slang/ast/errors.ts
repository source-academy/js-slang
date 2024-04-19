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
  constructor(type: string) {
    super(`BadSpec ${type}`)
  }
}

export class BadStmtError extends Error {
  constructor() {
    super('BadStmt')
  }
}

export class UnableToDefineAssignmentError extends Error {
  constructor() {
    super("UnableToDefineAssignment")
  }
}