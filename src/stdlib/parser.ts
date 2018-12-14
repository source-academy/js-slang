import { oneLine } from 'common-tags'
import * as es from 'estree'

import createContext from '../createContext'
import { parse as sourceParse } from '../parser'
import { Value } from '../types'
import { vector_to_list } from './list'

declare global {
  // tslint:disable-next-line:interface-name
  interface Function {
    __SOURCE__?: string
  }
}

class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

function unreachable() {
  // tslint:disable-next-line:no-console
  console.error(oneLine`
    UNREACHABLE CODE REACHED!
    Please file an issue at
    https://github.com/source-academy/js-slang/issues
    if you see this.
  `)
}

type ASTTransformers = Map<string, (node: es.Node) => Value>

let transformers: ASTTransformers
transformers = new Map([
  [
    'Program',
    (node: es.Node) => {
      node = node as es.Program
      return vector_to_list(node.body.map(transform))
    }
  ],

  [
    'BlockStatement',
    (node: es.Node) => {
      node = node as es.BlockStatement
      return {
        tag: 'block',
        body: vector_to_list(node.body.map(transform))
      }
    }
  ],

  [
    'ExpressionStatement',
    (node: es.Node) => {
      node = node as es.ExpressionStatement
      return transform(node.expression)
    }
  ],

  [
    'IfStatement',
    (node: es.Node) => {
      node = node as es.IfStatement
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
      node = node as es.FunctionDeclaration
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
      node = node as es.VariableDeclaration
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
      node = node as es.ReturnStatement
      return {
        tag: 'return_statement',
        expression: transform(node.argument as es.Expression)
      }
    }
  ],

  [
    'CallExpression',
    (node: es.Node) => {
      node = node as es.CallExpression
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
      node = node as es.UnaryExpression
      const loc = node.loc as es.SourceLocation
      return {
        tag: 'application',
        operator: {
          tag: 'name',
          name: node.operator,
          loc: {
            start: loc.start,
            end: { line: loc.start.line, column: loc.start.column + 1 }
          } as es.SourceLocation
        },
        operands: vector_to_list([transform(node.argument)])
      }
    }
  ],

  [
    'BinaryExpression',
    (node: es.Node) => {
      node = node as es.BinaryExpression
      const loc = node.right.loc as es.SourceLocation
      return {
        tag: 'application',
        operator: {
          tag: 'name',
          name: node.operator,
          loc: {
            start: { line: loc.start.line, column: loc.start.column - 1 },
            end: { line: loc.start.line, column: loc.start.column }
          } as es.SourceLocation
        },
        operands: vector_to_list([transform(node.left), transform(node.right)])
      }
    }
  ],

  [
    'LogicalExpression',
    (node: es.Node) => {
      node = node as es.LogicalExpression
      const loc = node.right.loc as es.SourceLocation
      return {
        tag: 'boolean_operation',
        operator: {
          tag: 'name',
          name: node.operator,
          loc: {
            start: { line: loc.start.line, column: loc.start.column - 1 },
            end: { line: loc.start.line, column: loc.start.column }
          } as es.SourceLocation
        },
        operands: vector_to_list([transform(node.left), transform(node.right)])
      }
    }
  ],

  [
    'ConditionalExpression',
    (node: es.Node) => {
      node = node as es.ConditionalExpression
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
      node = node as es.ArrowFunctionExpression
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
      node = node as es.Identifier
      return {
        tag: 'name',
        name: node.name
      }
    }
  ],

  [
    'Literal',
    (node: es.Node) => {
      node = node as es.Literal
      return node.value
    }
  ],

  [
    'ArrayExpression',
    (node: es.Node) => {
      node = node as es.ArrayExpression
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
      node = node as es.AssignmentExpression
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
      node = node as es.ForStatement
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
      node = node as es.WhileStatement
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
      node = node as es.BreakStatement
      return {
        tag: 'break_statement'
      }
    }
  ],

  [
    'ContinueStatement',
    (node: es.Node) => {
      node = node as es.ContinueStatement
      return {
        tag: 'continue_statement'
      }
    }
  ],

  [
    'ObjectExpression',
    (node: es.Node) => {
      node = node as es.ObjectExpression
      return {
        tag: 'object_expression',
        pairs: vector_to_list(node.properties.map(transform))
      }
    }
  ],

  [
    'MemberExpression',
    (node: es.Node) => {
      node = node as es.MemberExpression
      if (node.computed) {
        return {
          tag: 'property_access',
          object: transform(node.object),
          property: transform(node.property)
        }
      } else {
        const prop = node.property as es.Identifier
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
      node = node as es.Property
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
    const transformer = transformers.get(node.type) as (n: es.Node) => Value
    const transformed = transformer(node)
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
parse.__SOURCE__ = 'parse(program_string)'
