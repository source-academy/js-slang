import * as es from 'estree'
import { AllowedDeclarations } from '../types'

export const identifier = (name: string): es.Identifier => ({
  type: 'Identifier',
  name
})

export const literal = (value: string | number | boolean): es.Literal => ({
  type: 'Literal',
  value
})

export const memberExpression = (object: es.Expression, propertyString: string): es.MemberExpression => ({
  type: 'MemberExpression',
  object,
  computed: false,
  property: identifier(propertyString)
})

export const declaration = (
  name: string,
  kind: AllowedDeclarations,
  init: es.Expression
): es.VariableDeclaration => ({
  type: 'VariableDeclaration',
  declarations: [
    {
      type: 'VariableDeclarator',
      id: identifier(name),
      init
    }
  ],
  kind
})

export const constantDeclaration = (name: string, init: es.Expression) =>
  declaration(name, 'const', init)

export const callExpression = (
  callee: es.Expression,
  args: es.Expression[]
): es.CallExpression => ({
  type: 'CallExpression',
  callee,
  arguments: args
})

export const expressionStatement = (expression: es.Expression): es.ExpressionStatement => ({
  type: 'ExpressionStatement',
  expression
})

export const blockArrowFunction = (
  params: es.Identifier[],
  body: es.Statement[] | es.BlockStatement
): es.ArrowFunctionExpression => ({
  type: 'ArrowFunctionExpression',
  expression: false,
  generator: false,
  params,
  body: Array.isArray(body) ? blockStatement(body) : body
})

export const blockStatement = (body: es.Statement[]): es.BlockStatement => ({
  type: 'BlockStatement',
  body
})

export const returnStatement = (argument: es.Expression): es.ReturnStatement => ({
  type: 'ReturnStatement',
  argument
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
