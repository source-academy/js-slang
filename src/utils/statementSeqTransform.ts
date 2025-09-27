import type es from 'estree'
import type { Node, NodeTypeToNode } from '../types'
import * as ast from './ast/astCreator'

function hasDeclarations(node: es.BlockStatement | es.Program): boolean {
  for (const statement of node.body) {
    if (statement.type === 'VariableDeclaration' || statement.type === 'FunctionDeclaration') {
      return true
    }
  }
  return false
}

function hasImportDeclarations(node: es.Program): boolean {
  for (const statement of node.body) {
    if (statement.type === 'ImportDeclaration') {
      return true
    }
  }
  return false
}

/**
 * Utility type for getting all the keys of a ControlItem that have values
 * that are assignable to Nodes
 */
type GetNodeKeys<T extends Node> = {
  [K in keyof T as T[K] extends Node | null | undefined ? K : never]: K
}
/**
 * Extracts all the keys of a ControlItem that have values that are assignable to Nodes
 * as a union
 */
type KeysOfNodeProperties<T extends Node> = GetNodeKeys<T>[keyof GetNodeKeys<T>]

type NodeTransformer<T extends Node> = 
  | KeysOfNodeProperties<T>
  | KeysOfNodeProperties<T>[]
  | ((node: T) => Node)

type NodeTransformers = {
  [K in Node['type']]?: NodeTransformer<NodeTypeToNode<K>>
}

const transformers: NodeTransformers = {
  ArrayExpression: node => {
    node.elements = node.elements.map(x => (x ? transform(x) : null))
    return node
  },
  ArrowFunctionExpression: node => {
    node.params = node.params.map(transform)
    node.body = transform(node.body)
    return node
  },
  AssignmentExpression: node => {
    node.left = transform(node.left)
    node.right = transform(node.right)
    return node
  },
  BinaryExpression: node => {
    node.left = transform(node.left)
    node.right = transform(node.right)
    return node
  },
  BlockStatement: node => {
    node.body = node.body.map(transform)
    if (hasDeclarations(node)) {
      return node
    } else {
      return ast.statementSequence(node.body, node.loc)
    }
  },
  BreakStatement: node => {
    if (node.label) {
      node.label = transform(node.label)
    }
    return node
  },
  CallExpression: node => {
    node.callee = transform(node.callee)
    node.arguments = node.arguments.map(transform)
    return node
  },
  ClassDeclaration: node => {
    if (node.id) {
      node.id = transform(node.id)
    }
    if (node.superClass) {
      node.superClass = transform(node.superClass)
    }
    node.body = transform(node.body)
    return node
  },
  ConditionalExpression: node => {
    node.test = transform(node.test)
    node.consequent = transform(node.consequent)
    node.alternate = transform(node.alternate)
    return node
  },
  ContinueStatement: node => {
    if (node.label) {
      node.label = transform(node.label)
    }
    return node
  },
  ExportDefaultDeclaration: node => {
    node.declaration = transform(node.declaration)
    return node
  },
  ExportNamedDeclaration: node => {
    if (node.declaration) {
      node.declaration = transform(node.declaration)
    }
    node.specifiers = node.specifiers.map(x => transform(x))
    if (node.source) {
      transform(node.source)
    }
    return node
  },
  ExportSpecifier: node => {
    node.local = transform(node.local)
    node.exported = transform(node.exported)
    return node
  },
  ExpressionStatement: node => {
    node.expression = transform(node.expression)
    return node
  },
  ForStatement: node => {
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
  },
  FunctionDeclaration: node => {
    node.params = node.params.map(x => transform(x))
    node.body = transform(node.body)
    if (node.id) {
      node.id = transform(node.id)
    }
    return node
  },
  FunctionExpression: node => {
    if (node.id) {
      node.id = transform(node.id)
    }
    node.params = node.params.map(x => transform(x))
    node.body = transform(node.body)
    return node
  },
  Identifier: node => node,
  IfStatement: node => {
    node.test = transform(node.test)
    node.consequent = transform(node.consequent)
    if (node.alternate) {
      node.alternate = transform(node.alternate)
    }
    return node
  },
  ImportDeclaration: node => {
    node.specifiers = node.specifiers.map(transform)
    node.source = transform(node.source)
    return node
  },
  ImportDefaultSpecifier: node => {
    node.local = transform(node.local)
    return node
  },
  ImportSpecifier: node => {
    node.local = transform(node.local)
    node.imported = transform(node.imported)
    return node
  },
  Literal: node => node,
  LogicalExpression: node => {
    node.left = transform(node.left)
    node.right = transform(node.right)
    return node
  },
  MemberExpression: node => {
    node.object = transform(node.object)
    node.property = transform(node.property)
    return node
  },
  MethodDefinition: node => {
    node.key = transform(node.key)
    node.value = transform(node.value)
    return node
  },
  NewExpression: node => {
    node.arguments = node.arguments.map(transform)
    return node
  },
  ObjectExpression: node => {
    node.properties = node.properties.map(transform)
    return node
  },
  Program: node => {
    if (hasDeclarations(node) || hasImportDeclarations(node)) {
      return node
    } else {
      return ast.statementSequence(node.body as es.Statement[], node.loc)
    }
  },
  Property: node => {
    node.key = transform(node.key)
    node.value = transform(node.value)
    return node
  },
  RestElement: node => {
    node.argument = transform(node.argument)
    return node
  },
  ReturnStatement: node => {
    if (node.argument) {
      node.argument = transform(node.argument)
    }
    return node
  },
  SpreadElement: node => {
    node.argument = transform(node.argument)
    return node
  },
  StatementSequence: node => {
    node.body = node.body.map(x => transform(x))
    return node
  },
  Super: node => node,
  ThisExpression: node => node,
  ThrowStatement: node => {
    node.argument = transform(node.argument)
    return node
  },
  TryStatement: node => {
    node.block = transform(node.block)
    if (node.handler) {
      node.handler = transform(node.handler)
    }
    if (node.finalizer) {
      node.finalizer = transform(node.finalizer)
    }
    return node
  },
  UnaryExpression: node => {
    node.argument = transform(node.argument)
    return node
  },
  VariableDeclarator: node => {
    node.id = transform(node.id)
    if (node.init) {
      node.init = transform(node.init)
    }
    return node
  },
  VariableDeclaration: node => {
    node.declarations = node.declarations.map(transform)
    return node
  },
  WhileStatement: node => {
    node.test = transform(node.test)
    node.body = transform(node.body)
    return node
  }
}

export function transform<NodeType extends Node>(node: NodeType): NodeType {
  if (!(node.type in transformers)) return node

  const transformer = transformers[node.type] as NodeTransformer<NodeType>;
  return transformer(node) as NodeType
}
