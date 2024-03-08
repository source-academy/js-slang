import * as es from 'estree'

import { Node, StatementSequence } from '../types'
import * as ast from './astCreator'
function hasDeclarations(node: es.BlockStatement): boolean {
  for (const statement of node.body) {
    if (statement.type === 'VariableDeclaration' || statement.type === 'FunctionDeclaration') {
      return true
    }
  }
  return false
}

type NodeTransformer = (node: Node) => Node

type ASTTransformers = Map<string, NodeTransformer>

const transformers: ASTTransformers = new Map<string, NodeTransformer>([
  [
    'Program',
    (node: es.Program) => {
      node.body.map(x => transform(x))
      return node
    }
  ],

  [
    'BlockStatement',
    (node: es.BlockStatement) => {
      node.body.map((x: Node) => transform(x))
      if (hasDeclarations(node)) {
        return node
      } else {
        return ast.statementSequence(node.body, node.loc)
      }
    }
  ],

  [
    'StatementSequence',
    (node: StatementSequence) => {
      node.body.map((x: Node) => transform(x))
      return node
    }
  ],

  [
    'ExpressionStatement',
    (node: es.ExpressionStatement) => {
      node.expression = transform(node.expression)
      return node
    }
  ],

  [
    'IfStatement',
    (node: es.IfStatement) => {
      node.test = transform(node.test)
      node.consequent = transform(node.consequent)
      if (node.alternate) {
        node.alternate = transform(node.alternate)
      }
      return node
    }
  ],

  [
    'FunctionDeclaration',
    (node: es.FunctionDeclaration) => {
      node.params.map((x: Node) => transform(x))
      node.body = transform(node.body)
      if (node.id) {
        node.id = transform(node.id)
      }
      return node
    }
  ],

  [
    'VariableDeclarator',
    (node: es.VariableDeclarator) => {
      node.id = transform(node.id)
      if (node.init) {
        node.init = transform(node.init)
      }
      return node
    }
  ],

  [
    'VariableDeclaration',
    (node: es.VariableDeclaration) => {
      node.declarations.map((x: Node) => transform(x))
      return node
    }
  ],

  [
    'ReturnStatement',
    (node: es.ReturnStatement) => {
      if (node.argument) {
        node.argument = transform(node.argument)
      }
      return node
    }
  ],

  [
    'CallExpression',
    (node: es.SimpleCallExpression) => {
      node.callee = transform(node.callee)
      node.arguments.map((x: Node) => transform(x))
      return node
    }
  ],

  [
    'UnaryExpression',
    (node: es.UnaryExpression) => {
      node.argument = transform(node.argument)
      return node
    }
  ],

  [
    'BinaryExpression',
    (node: es.BinaryExpression) => {
      node.left = transform(node.left)
      node.right = transform(node.right)
      return node
    }
  ],

  [
    'LogicalExpression',
    (node: es.LogicalExpression) => {
      node.left = transform(node.left)
      node.right = transform(node.right)
      return node
    }
  ],

  [
    'ConditionalExpression',
    (node: es.ConditionalExpression) => {
      node.test = transform(node.test)
      node.consequent = transform(node.consequent)
      node.alternate = transform(node.alternate)
      return node
    }
  ],

  [
    'ArrowFunctionExpression',
    (node: es.ArrowFunctionExpression) => {
      node.params.map((x: Node) => transform(x))
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'Identifier',
    (node: es.Identifier) => {
      return node
    }
  ],

  [
    'Literal',
    (node: es.Literal) => {
      return node
    }
  ],

  [
    'ArrayExpression',
    (node: es.ArrayExpression) => {
      node.elements.map((x: Node | null) => (x ? transform(x) : null))
      return node
    }
  ],

  [
    'AssignmentExpression',
    (node: es.AssignmentExpression) => {
      node.left = transform(node.left)
      node.right = transform(node.right)
      return node
    }
  ],

  [
    'ForStatement',
    (node: es.ForStatement) => {
      if (node.init) {
        node.init = transform(node.init)
      }
      if (node.test) {
        node.test = transform(node.test)
      }
      if (node.update) {
        node.update = transform(node.update)
      }
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'WhileStatement',
    (node: es.WhileStatement) => {
      node.test = transform(node.test)
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'BreakStatement',
    (node: es.BreakStatement) => {
      if (node.label) {
        node.label = transform(node.label)
      }
      return node
    }
  ],

  [
    'ContinueStatement',
    (node: es.ContinueStatement) => {
      if (node.label) {
        node.label = transform(node.label)
      }
      return node
    }
  ],

  [
    'ObjectExpression',
    (node: es.ObjectExpression) => {
      node.properties.map((x: Node) => transform(x))
      return node
    }
  ],

  [
    'MemberExpression',
    (node: es.MemberExpression) => {
      node.object = transform(node.object)
      node.property = transform(node.property)
      return node
    }
  ],

  [
    'Property',
    (node: es.Property) => {
      node.key = transform(node.key)
      node.value = transform(node.value)
      return node
    }
  ],

  [
    'ImportDeclaration',
    (node: es.ImportDeclaration) => {
      node.specifiers.map((x: Node) => transform(x))
      node.source = transform(node.source)
      return node
    }
  ],

  [
    'ImportSpecifier',
    (node: es.ImportSpecifier) => {
      node.local = transform(node.local)
      node.imported = transform(node.imported)
      return node
    }
  ],

  [
    'ImportDefaultSpecifier',
    (node: es.ImportDefaultSpecifier) => {
      node.local = transform(node.local)
      return node
    }
  ],

  [
    'ExportNamedDeclaration',
    (node: es.ExportNamedDeclaration) => {
      if (node.declaration) {
        node.declaration = transform(node.declaration)
      }
      node.specifiers.map((x: Node) => transform(x))
      if (node.source) {
        transform(node.source)
      }
      return node
    }
  ],

  [
    'ExportDefaultDeclaration',
    (node: es.ExportDefaultDeclaration) => {
      node.declaration = transform(node.declaration)
      return node
    }
  ],

  [
    'ExportSpecifier',
    (node: es.ExportSpecifier) => {
      node.local = transform(node.local)
      node.exported = transform(node.exported)
      return node
    }
  ],

  [
    'ClassDeclaration',
    (node: es.ClassDeclaration) => {
      if (node.id) {
        node.id = transform(node.id)
      }
      if (node.superClass) {
        node.superClass = transform(node.superClass)
      }
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'NewExpression',
    (node: es.NewExpression) => {
      node.arguments.map((x: Node) => transform(x))
      return node
    }
  ],

  [
    'MethodDefinition',
    (node: es.MethodDefinition) => {
      node.key = transform(node.key)
      node.value = transform(node.value)
      return node
    }
  ],

  [
    'FunctionExpression',
    (node: es.FunctionExpression) => {
      if (node.id) {
        node.id = transform(node.id)
      }
      node.params.map((x: Node) => transform(x))
      node.body = transform(node.body)
      return node
    }
  ],

  [
    'ThisExpression',
    (_node: es.ThisExpression) => {
      return _node
    }
  ],

  [
    'Super',
    (_node: es.Super) => {
      return _node
    }
  ],

  [
    'TryStatement',
    (node: es.TryStatement) => {
      node.block = transform(node.block)
      if (node.handler) {
        node.handler = transform(node.handler)
      }
      if (node.finalizer) {
        node.finalizer = transform(node.finalizer)
      }
      return node
    }
  ],
  [
    'ThrowStatement',
    (node: es.ThrowStatement) => {
      node.argument = transform(node.argument)
      return node
    }
  ],
  [
    'SpreadElement',
    (node: es.SpreadElement) => {
      node.argument = transform(node.argument)
      return node
    }
  ],
  [
    'RestElement',
    (node: es.RestElement) => {
      node.argument = transform(node.argument)
      return node
    }
  ]
])

export function transform<NodeType extends Node>(node: NodeType): NodeType {
  if (transformers.has(node.type)) {
    const transformer = transformers.get(node.type) as (n: NodeType) => NodeType
    const transformed = transformer(node)
    return transformed
  } else {
    return node
  }
}
