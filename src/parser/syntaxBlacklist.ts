export const libraryParserLanguage = 100

const syntaxBlacklist: { [nodeName: string]: number } = {
  // List of all node types taken from
  // https://github.com/acornjs/acorn/blob/master/acorn-walk/src/index.js

  // Chapter 1
  Program: 1,
  BlockStatement: 1,
  ExpressionStatement: 1,
  IfStatement: 1,
  ReturnStatement: 1,
  FunctionDeclaration: 1,
  VariableDeclaration: 1,
  VariableDeclarator: 1,
  ArrowFunctionExpression: 1,
  UnaryExpression: 1,
  BinaryExpression: 1,
  LogicalExpression: 1,
  ConditionalExpression: 1,
  CallExpression: 1,
  Identifier: 1,
  Literal: 1,
  TemplateLiteral: 1,
  TemplateElement: 1,
  DebuggerStatement: 1,
  ImportDeclaration: 1,
  ImportSpecifier: 1,

  // Chapter 2
  ExportNamedDeclaration: 2,

  // Chapter 3
  BreakStatement: 3,
  ContinueStatement: 3,
  WhileStatement: 3,
  ForStatement: 3,
  MemberPattern: 3,
  ArrayExpression: 3,
  AssignmentExpression: 3,
  MemberExpression: 3,
  Property: 3,
  SpreadElement: 3,
  RestElement: 3,

  // we allow more features
  // in the library parser
  ObjectExpression: libraryParserLanguage,
  NewExpression: libraryParserLanguage,
  TryStatement: libraryParserLanguage,
  CatchClause: libraryParserLanguage,
  ThrowStatement: libraryParserLanguage,
  ThisExpression: libraryParserLanguage,
  Super: libraryParserLanguage,
  ClassDeclaration: libraryParserLanguage,
  ClassExpression: libraryParserLanguage,
  Class: libraryParserLanguage,
  ClassBody: libraryParserLanguage,
  MethodDefinition: libraryParserLanguage,
  FunctionExpression: libraryParserLanguage,
  ImportDefaultSpecifier: libraryParserLanguage,
  ExportDefaultDeclaration: libraryParserLanguage,

  // Disallowed forever
  UpdateExpression: Infinity,
  Statement: Infinity,
  EmptyStatement: Infinity,
  ParenthesizedExpression: Infinity,
  LabeledStatement: Infinity,
  WithStatement: Infinity,
  SwitchStatement: Infinity,
  SwitchCase: Infinity,
  YieldExpression: Infinity,
  AwaitExpression: Infinity,
  DoWhileStatement: Infinity,
  ForInStatement: Infinity,
  ForOfStatement: Infinity,
  ForInit: Infinity,
  Function: Infinity,
  Pattern: Infinity,
  VariablePattern: Infinity,
  ArrayPattern: Infinity,
  ObjectPattern: Infinity,
  Expression: Infinity,
  MetaProperty: Infinity,
  SequenceExpression: Infinity,
  AssignmentPattern: Infinity,
  ExportAllDeclaration: Infinity,
  ImportNamespaceSpecifier: Infinity,
  TaggedTemplateExpression: Infinity
}

export default syntaxBlacklist
