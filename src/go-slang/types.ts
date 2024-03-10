export enum NodeType {
    ExpressionStatement = "ExpressionStatement",
    Literal = "Literal",
    UnaryExpression = "UnaryExpression",
    BinaryExpression = "BinaryExpression",
}

// NOTE: right now, the only type of source file is an expression statement
export type SourceFile = ExpressionStatement

type Expression = Literal | UnaryExpression | BinaryExpression

export interface Node {
    type: NodeType 
}

export interface ExpressionStatement extends Node {
    type: NodeType.ExpressionStatement
    expression: Expression
}

export interface Literal extends Node {
    type: NodeType.Literal
    value: any
}

export interface UnaryExpression extends Node {
    type: NodeType.UnaryExpression
    operator: string
    argument: Expression
}

export interface BinaryExpression extends Node {
    type: NodeType.BinaryExpression
    operator: string
    left: Expression
    right: Expression
}
