import * as es from 'estree'

import { BlockExpression } from '../types'

const DUMMY_STRING = '__DUMMY__'
const DUMMY_UNARY_OPERATOR = '!'
const DUMMY_LOGICAL_OPERATOR = '||'
const DUMMY_BINARY_OPERATOR = '+'

export const dummyLocation = (): es.SourceLocation => ({
  start: { line: -1, column: -1 },
  end: { line: -1, column: -1 }
})

export const dummyIdentifier = (): es.Identifier => ({
  type: 'Identifier',
  name: DUMMY_STRING
})

export const dummyLiteral = (): es.Literal => ({
  type: 'Literal',
  value: DUMMY_STRING,
  loc: dummyLocation()
})

export const dummyExpression = (): es.Expression => dummyLiteral() as es.Expression

export const dummyCallExpression = (): es.CallExpression => ({
  type: 'CallExpression',
  callee: dummyExpression(),
  arguments: [],
  loc: dummyLocation(),
  optional: false
})

export const dummyExpressionStatement = (): es.ExpressionStatement => ({
  type: 'ExpressionStatement',
  expression: dummyExpression(),
  loc: dummyLocation()
})

export const dummyStatement = (): es.Statement => dummyExpressionStatement() as es.Statement

export const dummyBlockStatement = (): es.BlockStatement => ({
  type: 'BlockStatement',
  body: [],
  loc: dummyLocation()
})

export const dummyArrowFunctionExpression = (): es.ArrowFunctionExpression => ({
  type: 'ArrowFunctionExpression',
  expression: false,
  generator: false,
  params: [],
  body: dummyBlockStatement(),
  loc: dummyLocation()
})

export const dummyProgram = (): es.Program => ({
  type: 'Program',
  body: [],
  loc: dummyLocation(),
  sourceType: 'module'
})

export const dummyReturnStatement = (): es.ReturnStatement => ({
  type: 'ReturnStatement',
  argument: dummyExpression(),
  loc: dummyLocation()
})

/*
export const property = (): es.Property => ({
  type: 'Property',
  method: false,
  shorthand: false,
  computed: false,
  key: dummyIdentifier(),
  value: dummyExpression(),
  kind: 'init'
})

export const objectExpression = (properties: es.Property[]): es.ObjectExpression => ({
  type: 'ObjectExpression',
  properties
})

export const mutateToCallExpression = (
  node: es.Node,
  callee: es.Expression,
  args: es.Expression[]
) => {
  node.type = 'CallExpression'
  node = node as es.CallExpression
  node.callee = callee
  node.arguments = args
}
*/

export const dummyLogicalExpression = (): es.LogicalExpression => ({
  type: 'LogicalExpression',
  operator: DUMMY_LOGICAL_OPERATOR,
  left: dummyExpression(),
  right: dummyExpression(),
  loc: dummyLocation()
})

export const dummyConditionalExpression = (): es.ConditionalExpression => ({
  type: 'ConditionalExpression',
  test: dummyExpression(),
  consequent: dummyExpression(),
  alternate: dummyExpression(),
  loc: dummyLocation()
})

export const dummyArrayExpression = (): es.ArrayExpression => ({
  type: 'ArrayExpression',
  elements: []
})

export const dummyBinaryExpression = (): es.BinaryExpression => ({
  type: 'BinaryExpression',
  operator: DUMMY_BINARY_OPERATOR,
  left: dummyExpression(),
  right: dummyExpression(),
  loc: dummyLocation()
})

export const dummyUnaryExpression = (): es.UnaryExpression => ({
  type: 'UnaryExpression',
  operator: DUMMY_UNARY_OPERATOR,
  prefix: true,
  argument: dummyExpression(),
  loc: dummyLocation()
})

// primitive: undefined is a possible value
export const dummyPrimitive = (): es.Expression => dummyLiteral()

export const dummyFunctionExpression = (): es.FunctionExpression => ({
  type: 'FunctionExpression',
  id: dummyIdentifier(),
  params: [],
  body: dummyBlockStatement(),
  loc: dummyLocation()
})

export const dummyFunctionDeclaration = (): es.FunctionDeclaration => ({
  type: 'FunctionDeclaration',
  id: dummyIdentifier(),
  params: [],
  body: dummyBlockStatement(),
  loc: dummyLocation()
})

export const dummyBlockExpression = (): BlockExpression => ({
  type: 'BlockExpression',
  body: [],
  loc: dummyLocation()
})

export const dummyVariableDeclarator = (): es.VariableDeclarator => ({
  type: 'VariableDeclarator',
  id: dummyIdentifier(),
  init: dummyExpression(),
  loc: dummyLocation()
})
