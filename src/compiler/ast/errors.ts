class BadExprError extends Error {
    constructor(start : Pos.Pos) {
        super(`BadExpr at offset ${start}`);
    }
}

class BadDeclError extends Error {
    constructor(start : Pos.Pos) {
        super(`BadDecl at offset ${start}`);
    }
}

class BadSpecError extends Error {
    constructor(start : Pos.Pos) {
        super(`BadSpec at offset ${start}`);
    }
}

class BadStmtError extends Error {
    constructor(start : Pos.Pos) {
        super(`BadStmt at offset ${start}`);
    }
}