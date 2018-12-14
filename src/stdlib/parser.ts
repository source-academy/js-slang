import * as es from 'estree'

import createContext from '../createContext'
import { parse as sourceParse } from '../parser'
import { Value } from '../types'
import { vector_to_list } from './list'

class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

function unreachable() {
  console.error(
    'UNREACHABLE CODE REACHED! Please file an issue at https://github.com/source-academy/js-slang/issues if you see this.'
  )
}

type ASTTransformers = Map<string, (node: es.Node) => Value>

let transformers: ASTTransformers
transformers = new Map([
  [
    'Program',
    (node: es.Node) => {
      node = <es.Program>node
      return vector_to_list(node.body.map(transform))
    }
  ],

  [
    'BlockStatement',
    (node: es.Node) => {
      node = <es.BlockStatement>node
      return {
        tag: 'block',
        body: vector_to_list(node.body.map(transform))
      }
    }
  ],

  [
    'ExpressionStatement',
    (node: es.Node) => {
      node = <es.ExpressionStatement>node
      return transform(node.expression)
    }
  ],

  [
    'IfStatement',
    (node: es.Node) => {
      node = <es.IfStatement>node
      return {
        tag: 'conditional_statement',
        predicate: transform(node.test),
        consequent: transform(node.consequent),
        alternative: transform(node.alternate as es.Statement)
      }
    }
  ],

  [
    'FunctionDeclaration',
    (node: es.Node) => {
      node = <es.FunctionDeclaration>node
      return {
        tag: 'constant_declaration',
        name: transform(node.id as es.Identifier),
        value: {
          tag: 'function_definition',
          parameters: vector_to_list(node.params.map(transform)),
          body: vector_to_list(node.body.body.map(transform))
        }
      }
    }
  ],

  [
    'VariableDeclaration',
    (node: es.Node) => {
      node = <es.VariableDeclaration>node
      if (node.kind === 'let') {
        return {
          tag: 'variable_declaration',
          name: transform(node.declarations[0].id),
          value: transform(node.declarations[0].init as es.Expression)
        }
      } else if (node.kind === 'const') {
        return {
          tag: 'constant_declaration',
          name: transform(node.declarations[0].id),
          value: transform(node.declarations[0].init as es.Expression)
        }
      } else {
        unreachable()
        throw new ParseError('Invalid declaration kind')
      }
    }
  ],

  [
    'ReturnStatement',
    (node: es.Node) => {
      node = <es.ReturnStatement>node
      return {
        tag: 'return_statement',
        expression: transform(node.argument as es.Expression)
      }
    }
  ],

  [
    'CallExpression',
    (node: es.Node) => {
      node = <es.CallExpression>node
      return {
        tag: 'application',
        operator: transform(node.callee),
        operands: vector_to_list(node.arguments.map(transform))
      }
    }
  ],

  [
    'UnaryExpression',
    (node: es.Node) => {
      node = <es.UnaryExpression>node
      let loc = <es.SourceLocation>node.loc
      return {
        tag: 'application',
        operator: {
          tag: 'name',
          name: node.operator,
          loc: <es.SourceLocation>{
            start: loc.start,
            end: { line: loc.start.line, column: loc.start.column + 1 }
          }
        },
        operands: vector_to_list([transform(node.argument)])
      }
    }
  ],

  [
    'BinaryExpression',
    (node: es.Node) => {
      node = <es.BinaryExpression>node
      let loc = <es.SourceLocation>node.right.loc
      return {
        tag: 'application',
        operator: {
          tag: 'name',
          name: node.operator,
          loc: <es.SourceLocation>{
            start: { line: loc.start.line, column: loc.start.column - 1 },
            end: { line: loc.start.line, column: loc.start.column }
          }
        },
        operands: vector_to_list([transform(node.left), transform(node.right)])
      }
    }
  ],

  [
    'LogicalExpression',
    (node: es.Node) => {
      node = <es.LogicalExpression>node
      let loc = <es.SourceLocation>node.right.loc
      return {
        tag: 'boolean_operation',
        operator: {
          tag: 'name',
          name: node.operator,
          loc: <es.SourceLocation>{
            start: { line: loc.start.line, column: loc.start.column - 1 },
            end: { line: loc.start.line, column: loc.start.column }
          }
        },
        operands: vector_to_list([transform(node.left), transform(node.right)])
      }
    }
  ],

  [
    'ConditionalExpression',
    (node: es.Node) => {
      node = <es.ConditionalExpression>node
      return {
        tag: 'conditional_expression',
        predicate: transform(node.test),
        consequent: transform(node.consequent),
        alternative: transform(node.alternate)
      }
    }
  ],

  [
    'ArrowFunctionExpression',
    (node: es.Node) => {
      node = <es.ArrowFunctionExpression>node
      return {
        tag: 'function_definition',
        parameters: vector_to_list(node.params.map(transform)),
        body: {
          tag: 'return_statement',
          expression: transform(node.body as es.Expression),
          loc: node.body.loc
        }
      }
    }
  ],

  [
    'Identifier',
    (node: es.Node) => {
      node = <es.Identifier>node
      return {
        tag: 'name',
        name: node.name
      }
    }
  ],

  [
    'Literal',
    (node: es.Node) => {
      node = <es.Literal>node
      return node.value
    }
  ],

  [
    'ArrayExpression',
    (node: es.Node) => {
      node = <es.ArrayExpression>node
      if (node.elements.length === 0) {
        return {
          tag: 'empty_list'
        }
      } else {
        return {
          tag: 'array_expression',
          elements: vector_to_list(node.elements.map(transform))
        }
      }
    }
  ],

  [
    'AssignmentExpression',
    (node: es.Node) => {
      node = <es.AssignmentExpression>node
      if (node.operator !== '=') {
        unreachable()
        throw new ParseError(`{node.operator} assignments are not allowed. Use = instead`)
      }
      if (node.left.type === 'Identifier') {
        return {
          tag: 'assignment',
          name: transform(node.left as es.Identifier),
          value: transform(node.right)
        }
      } else if (node.left.type === 'MemberExpression') {
        return {
          tag: 'property_assignment',
          object: transform(node.left as es.Expression),
          value: transform(node.right)
        }
      } else {
        unreachable()
        throw new ParseError('Invalid assignment')
      }
    }
  ],

  [
    'ForStatement',
    (node: es.Node) => {
      node = <es.ForStatement>node
      return {
        tag: 'for_loop',
        initialiser: transform(node.init as es.VariableDeclaration | es.Expression),
        predicate: transform(node.test as es.Expression),
        finaliser: transform(node.update as es.Expression),
        statements: transform(node.body)
      }
    }
  ],

  [
    'WhileStatement',
    (node: es.Node) => {
      node = <es.WhileStatement>node
      return {
        tag: 'while_loop',
        predicate: transform(node.test),
        statements: transform(node.body)
      }
    }
  ],

  [
    'BreakStatement',
    (node: es.Node) => {
      node = <es.BreakStatement>node
      return {
        tag: 'break_statement'
      }
    }
  ],

  [
    'ContinueStatement',
    (node: es.Node) => {
      node = <es.ContinueStatement>node
      return {
        tag: 'continue_statement'
      }
    }
  ],

  [
    'ObjectExpression',
    (node: es.Node) => {
      node = <es.ObjectExpression>node
      return {
        tag: 'object_expression',
        pairs: vector_to_list(node.properties.map(transform))
      }
    }
  ],

  [
    'MemberExpression',
    (node: es.Node) => {
      node = <es.MemberExpression>node
      if (node.computed) {
        return {
          tag: 'property_access',
          object: transform(node.object),
          property: transform(node.property)
        }
      } else {
        const prop = <es.Identifier>node.property
        return {
          tag: 'property_access',
          object: transform(node.object),
          property: prop.name
        }
      }
    }
  ],

  [
    'Property',
    (node: es.Node) => {
      node = <es.Property>node
      if (node.key.type === 'Literal') {
        return [node.key.value, transform(node.value)]
      } else if (node.key.type === 'Identifier') {
        return [node.key.name, transform(node.value)]
      } else {
        unreachable()
        throw new ParseError('Invalid property key type')
      }
    }
  ]
])

function transform(node: es.Node) {
  if (transformers.has(node.type)) {
    let transformer = transformers.get(node.type) as (n: es.Node) => Value
    let transformed = transformer(node)
    // Attach location information
    if (
      transformed !== null &&
      transformed !== undefined &&
      typeof transformed === 'object' &&
      transformed.tag !== undefined
    ) {
      transformed.loc = node.loc
    }
    return transformed
  } else {
    unreachable()
    throw new ParseError('Cannot transform unknown type: ' + node.type)
  }
}

export function parse(x: string): Value {
  const context = createContext(100)
  let program
  program = sourceParse(x, context)
  if (context.errors.length > 0) {
    throw new ParseError(context.errors[0].explain())
  }

  if (program !== undefined) {
    return transform(program)
  } else {
    unreachable()
    throw new ParseError('Invalid parse')
  }
}
