import type es from 'estree'
import type { Node, NodeTypeToNode } from '../types'
import * as ast from './ast/astCreator'
import { hasNoDeclarations } from './ast/helpers'

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
  AssignmentExpression: ['left', 'right'],
  BinaryExpression: ['left', 'right'],
  BlockStatement: node => {
    node.body = node.body.map(transform)
    if (hasNoDeclarations(node.body)) {
      return ast.statementSequence(node.body, node.loc)
    } else {
      return node
    }
  },
  BreakStatement: 'label',
  CallExpression: node => {
    node.callee = transform(node.callee)
    node.arguments = node.arguments.map(transform)
    return node
  },
  ClassDeclaration: ['body', 'id', 'superClass'],
  ConditionalExpression: ['alternate', 'consequent', 'test'],
  ContinueStatement: 'label',
  ExportDefaultDeclaration: 'declaration',
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
  ExportSpecifier: ['exported', 'local'],
  ExpressionStatement: 'expression',
  ForStatement: ['body', 'init', 'test', 'update'],
  FunctionDeclaration: node => {
    node.params = node.params.map(transform)
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
    node.params = node.params.map(transform)
    node.body = transform(node.body)
    return node
  },
  IfStatement: ['alternate', 'consequent', 'test'],
  ImportDeclaration: node => {
    node.specifiers = node.specifiers.map(transform)
    node.source = transform(node.source)
    return node
  },
  ImportDefaultSpecifier: 'local',
  ImportSpecifier: ['imported', 'local'],
  LogicalExpression: ['left', 'right'],
  MemberExpression: ['object', 'property'],
  MethodDefinition: ['key', 'value'],
  NewExpression: node => {
    node.arguments = node.arguments.map(transform)
    return node
  },
  ObjectExpression: node => {
    node.properties = node.properties.map(transform)
    return node
  },
  Program: node => {
    if (!hasNoDeclarations(node.body) && !hasImportDeclarations(node)) {
      return ast.statementSequence(node.body as es.Statement[], node.loc)
    } else {
      return node
    }
  },
  Property: ['key', 'value'],
  RestElement: 'argument',
  ReturnStatement: 'argument',
  SpreadElement: 'argument',
  StatementSequence: node => {
    node.body = node.body.map(transform)
    return node
  },
  ThrowStatement: 'argument',
  TryStatement: ['block', 'finalizer', 'handler'],
  UnaryExpression: 'argument',
  VariableDeclarator: ['id', 'init'],
  VariableDeclaration: node => {
    node.declarations = node.declarations.map(transform)
    return node
  },
  WhileStatement: ['body', 'test']
}

export function transform<NodeType extends Node>(node: NodeType): NodeType {
  const transformer = transformers[node.type]

  switch (typeof transformer) {
    case 'undefined':
      return node
    case 'function':
      // @ts-expect-error Node type gets narrowed to never
      return transformer(node) as NodeType
  }

  const properties = typeof transformer === 'string' ? [transformer] : transformer
  for (const prop of properties) {
    // @ts-expect-error Weird typescript shennenigans going on here don't mind this
    node[prop!] = transform(node[prop])
  }

  return node
}
