import type es from 'estree'

import {
  AllowedDeclarations,
  type BlockExpression,
  type FunctionDeclarationExpression,
  type Node,
  type StatementSequence
} from '../../types'

export const locationDummyNode = (line: number, column: number, source: string | null) =>
  literal('Dummy', { start: { line, column }, end: { line, column }, source })

export const identifier = (name: string, loc?: es.SourceLocation | null): es.Identifier => ({
  type: 'Identifier',
  name,
  loc
})

export const importDeclaration = (
  source: string,
  specifiers: es.ImportDeclaration['specifiers'],
  loc?: es.SourceLocation | null
): es.ImportDeclaration => ({
  type: 'ImportDeclaration',
  source: literal(source),
  specifiers,
  loc
})

export const importSpecifier = (
  importedName: string,
  localName: string,
  loc?: es.SourceLocation | null
): es.ImportSpecifier => ({
  type: 'ImportSpecifier',
  imported: identifier(importedName),
  local: identifier(localName),
  loc
})

export const importDefaultSpecifier = (
  localName: string,
  loc?: es.SourceLocation | null
): es.ImportDefaultSpecifier => ({
  type: 'ImportDefaultSpecifier',
  local: identifier(localName),
  loc
})

export const importNamespaceSpecifier = (
  localName: string,
  loc?: es.SourceLocation | null
): es.ImportNamespaceSpecifier => ({
  type: 'ImportNamespaceSpecifier',
  local: identifier(localName),
  loc
})

export const literal = (
  value: string | number | boolean | null,
  loc?: es.SourceLocation | null
): es.Literal => ({
  type: 'Literal',
  value,
  loc
})

export const memberExpression = (
  object: es.Expression,
  property: string | number
): es.MemberExpression => ({
  type: 'MemberExpression',
  object,
  computed: typeof property === 'number',
  optional: false,
  property: typeof property === 'number' ? literal(property) : identifier(property)
})

export const declaration = (
  name: string,
  kind: AllowedDeclarations,
  init: es.Expression,
  loc?: es.SourceLocation | null
) =>
  variableDeclaration(
    [
      {
        type: 'VariableDeclarator',
        id: identifier(name),
        init
      }
    ],
    kind,
    loc
  )

export const constantDeclaration = (
  name: string,
  init: es.Expression,
  loc?: es.SourceLocation | null
) => declaration(name, 'const', init, loc)

export const callExpression = (
  callee: es.Expression,
  args: (es.Expression | es.SpreadElement)[],
  loc?: es.SourceLocation | null
): es.CallExpression => ({
  type: 'CallExpression',
  callee,
  arguments: args,
  optional: false,
  loc
})

export const expressionStatement = (expression: es.Expression): es.ExpressionStatement => ({
  type: 'ExpressionStatement',
  expression
})

export const blockArrowFunction = (
  params: es.Identifier[],
  body: es.Statement[] | es.BlockStatement | es.Expression,
  loc?: es.SourceLocation | null
): es.ArrowFunctionExpression => ({
  type: 'ArrowFunctionExpression',
  expression: false,
  generator: false,
  params,
  body: Array.isArray(body) ? blockStatement(body) : body,
  loc
})

export const functionExpression = (
  params: es.Pattern[],
  body: es.Statement[] | es.BlockStatement,
  loc?: es.SourceLocation | null,
  id?: es.Identifier
): es.FunctionExpression => ({
  type: 'FunctionExpression',
  id: id ?? null,
  async: false,
  generator: false,
  params,
  body: Array.isArray(body) ? blockStatement(body) : body,
  loc
})

export const blockStatement = (
  body: es.Statement[],
  loc?: es.SourceLocation | null
): es.BlockStatement => ({
  type: 'BlockStatement',
  body,
  loc
})

export const statementSequence = (
  body: es.Statement[],
  loc?: es.SourceLocation | null
): StatementSequence => ({
  type: 'StatementSequence',
  body,
  loc
})

export const program = (body: es.Statement[]): es.Program => ({
  type: 'Program',
  sourceType: 'module',
  body
})

export const returnStatement = (
  argument: es.Expression,
  loc?: es.SourceLocation | null
): es.ReturnStatement => ({
  type: 'ReturnStatement',
  argument,
  loc
})

export const property = (key: string, value: es.Expression): es.Property => ({
  type: 'Property',
  method: false,
  shorthand: false,
  computed: false,
  key: identifier(key),
  value,
  kind: 'init'
})

export const objectExpression = (properties: es.Property[]): es.ObjectExpression => ({
  type: 'ObjectExpression',
  properties
})

export const mutateToCallExpression = (
  node: Node,
  callee: es.Expression,
  args: es.Expression[]
) => {
  node.type = 'CallExpression'
  node = node as es.CallExpression
  node.callee = callee
  node.arguments = args
}

export const mutateToAssignmentExpression = (
  node: Node,
  left: es.Pattern,
  right: es.Expression
) => {
  node.type = 'AssignmentExpression'
  node = node as es.AssignmentExpression
  node.operator = '='
  node.left = left
  node.right = right
}

export const mutateToExpressionStatement = (node: Node, expr: es.Expression) => {
  node.type = 'ExpressionStatement'
  node = node as es.ExpressionStatement
  node.expression = expr
}

export const mutateToReturnStatement = (node: Node, expr: es.Expression) => {
  node.type = 'ReturnStatement'
  node = node as es.ReturnStatement
  node.argument = expr
}

export const mutateToMemberExpression = (node: Node, obj: es.Expression, prop: es.Expression) => {
  node.type = 'MemberExpression'
  node = node as es.MemberExpression
  node.object = obj
  node.property = prop
  node.computed = false
}

export const logicalExpression = (
  operator: es.LogicalOperator,
  left: es.Expression,
  right: es.Expression,
  loc?: es.SourceLocation | null
): es.LogicalExpression => ({
  type: 'LogicalExpression',
  operator,
  left,
  right,
  loc
})

export const mutateToConditionalExpression = (
  node: Node,
  test: es.Expression,
  consequent: es.Expression,
  alternate: es.Expression
) => {
  node.type = 'ConditionalExpression'
  node = node as es.ConditionalExpression
  node.test = test
  node.consequent = consequent
  node.alternate = alternate
}

export const conditionalExpression = (
  test: es.Expression,
  consequent: es.Expression,
  alternate: es.Expression,
  loc?: es.SourceLocation | null
): es.ConditionalExpression => ({
  type: 'ConditionalExpression',
  test,
  consequent,
  alternate,
  loc
})

export const arrayExpression = (elements: es.Expression[]): es.ArrayExpression => ({
  type: 'ArrayExpression',
  elements
})

export const assignmentExpression = (
  left: es.Identifier | es.MemberExpression,
  right: es.Expression,
  loc?: es.SourceLocation | null
): es.AssignmentExpression => ({
  type: 'AssignmentExpression',
  operator: '=',
  left,
  right,
  loc
})

export const binaryExpression = (
  operator: es.BinaryOperator,
  left: es.Expression,
  right: es.Expression,
  loc?: es.SourceLocation | null
): es.BinaryExpression => ({
  type: 'BinaryExpression',
  operator,
  left,
  right,
  loc
})

export const unaryExpression = (
  operator: es.UnaryOperator,
  argument: es.Expression,
  loc?: es.SourceLocation | null
): es.UnaryExpression => ({
  type: 'UnaryExpression',
  operator,
  prefix: true,
  argument,
  loc
})

// primitive: undefined is a possible value
export const primitive = (value: any): es.Expression => {
  return value === undefined ? identifier('undefined') : literal(value)
}

export const functionDeclarationExpression = (
  id: es.Identifier,
  params: es.Pattern[],
  body: es.BlockStatement,
  loc?: es.SourceLocation | null
): FunctionDeclarationExpression => ({
  type: 'FunctionExpression',
  id,
  params,
  body,
  loc
})

export const functionDeclaration = (
  id: es.Identifier,
  params: es.Pattern[],
  body: es.BlockStatement,
  loc?: es.SourceLocation | null
): es.FunctionDeclaration => ({
  type: 'FunctionDeclaration',
  id,
  params,
  body,
  loc
})

export const blockExpression = (
  body: es.Statement[],
  loc?: es.SourceLocation | null
): BlockExpression => ({
  type: 'BlockExpression',
  body,
  loc
})

export const arrowFunctionExpression = (
  params: es.Pattern[],
  body: es.Expression | es.BlockStatement,
  loc?: es.SourceLocation | null
): es.ArrowFunctionExpression => ({
  type: 'ArrowFunctionExpression',
  expression: body.type !== 'BlockStatement',
  generator: false,
  params,
  body,
  loc
})

export const variableDeclaration = (
  declarations: es.VariableDeclarator[],
  kind: es.VariableDeclaration['kind'] = 'const',
  loc?: es.SourceLocation | null
): es.VariableDeclaration => ({
  type: 'VariableDeclaration',
  kind,
  declarations,
  loc
})

export const variableDeclarator = (
  id: es.Pattern,
  init: es.Expression,
  loc?: es.SourceLocation | null
): es.VariableDeclarator => ({
  type: 'VariableDeclarator',
  id,
  init,
  loc
})

export const ifStatement = (
  test: es.Expression,
  consequent: es.BlockStatement,
  alternate: es.Statement,
  loc?: es.SourceLocation | null
): es.IfStatement => ({
  type: 'IfStatement',
  test,
  consequent,
  alternate,
  loc
})

export const whileStatement = (
  body: es.BlockStatement,
  test: es.Expression,
  loc?: es.SourceLocation | null
): es.WhileStatement => ({
  type: 'WhileStatement',
  test,
  body,
  loc
})

export const forStatement = (
  init: es.VariableDeclaration | es.Expression,
  test: es.Expression,
  update: es.Expression,
  body: es.Statement,
  loc?: es.SourceLocation | null
): es.ForStatement => ({
  type: 'ForStatement',
  init,
  test,
  update,
  body,
  loc
})
