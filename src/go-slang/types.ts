export enum NodeType {
  ExpressionStatement = 'ExpressionStatement',
  Literal = 'Literal',
  UnaryExpression = 'UnaryExpression',
  BinaryExpression = 'BinaryExpression'
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

export type UnaryOperator = '+' | '-'

export interface UnaryExpression extends Node {
  type: NodeType.UnaryExpression
  operator: UnaryOperator
  argument: Expression
}

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '|'
  | '^'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='

export interface BinaryExpression extends Node {
  type: NodeType.BinaryExpression
  operator: BinaryOperator
  left: Expression
  right: Expression
}

export enum CommandType {
  UnaryOp = 'UnaryOp',
  BinaryOp = 'BinaryOp'
}

export interface Command {
  type: CommandType
}

export interface UnaryOp extends Command {
  type: CommandType.UnaryOp
  operator: UnaryOperator
}

export interface BinaryOp extends Command {
  type: CommandType.BinaryOp
  operator: BinaryOperator
}

export type Instruction = ExpressionStatement | Expression | UnaryOp | BinaryOp
