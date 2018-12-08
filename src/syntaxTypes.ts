const syntaxTypes: { [nodeName: string]: number } = {
  // Chapter 1
  Program: 1,
  ExpressionStatement: 1,
  IfStatement: 1,
  FunctionDeclaration: 1,
  VariableDeclaration: 1,
  ReturnStatement: 1,
  CallExpression: 1,
  UnaryExpression: 1,
  BinaryExpression: 1,
  LogicalExpression: 1,
  ConditionalExpression: 1,
  ArrowFunctionExpression: 1,
  Identifier: 1,
  Literal: 1,

  // Chapter 2

  // Chapter 3
  AssignmentExpression: 3,
  ForStatement: 3,
  WhileStatement: 3,
  BreakStatement: 3,
  ContinueStatement: 3,
  ArrayExpression: 3,
  MemberExpression: 3,
  Property: 3,

  // Disabled
  UpdateExpression: 100,
  NewExpression: 100,
  ObjectExpression: 100,

  // Disallowed Forever
  EmptyStatement: Infinity,
  ThisExpression: Infinity,
  FunctionExpression: Infinity,
  SwitchStatement: Infinity,
  DebuggerStatement: Infinity,
  WithStatement: Infinity,
  LabeledStatement: Infinity,
  SwitchCase: Infinity,
  ThrowStatement: Infinity,
  CatchClause: Infinity,
  DoWhileStatement: Infinity,
  ForInStatement: Infinity,
  SequenceExpression: Infinity
}

export default syntaxTypes
