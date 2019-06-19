import { oneLine } from 'common-tags'
import * as es from 'estree'

import { parse as sourceParse } from '../parser'
import { Context, Value } from '../types'
import { vector_to_list } from './list'

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
      return node.body.length === 1
        ? transform(node.body[0])
        : vector_to_list(['sequence', vector_to_list(node.body.map(transform))])
    }
  ],

  [
    'BlockStatement',
    (node: es.Node) => {
      node = node as es.BlockStatement
      return vector_to_list([
        'block',
        node.body.length === 1
          ? transform(node.body[0])
          : vector_to_list(['sequence', vector_to_list(node.body.map(transform))])
      ])
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
      return vector_to_list([
        'conditional_statement',
        transform(node.test),
        transform(node.consequent),
        transform(node.alternate as es.Statement)
      ])
    }
  ],

  [
    'FunctionDeclaration',
    (node: es.Node) => {
      node = node as es.FunctionDeclaration
      return vector_to_list([
        'constant_declaration',
        transform(node.id as es.Identifier),
        vector_to_list([
          'function_definition',
          vector_to_list(node.params.map(transform)),
          node.body.body.length === 1
            ? transform(node.body.body[0])
            : vector_to_list(['sequence', vector_to_list(node.body.body.map(transform))])
        ])
      ])
    }
  ],

  [
    'VariableDeclaration',
    (node: es.Node) => {
      node = node as es.VariableDeclaration
      if (node.kind === 'let') {
        return vector_to_list([
          'variable_declaration',
          transform(node.declarations[0].id),
          transform(node.declarations[0].init as es.Expression)
        ])
      } else if (node.kind === 'const') {
        return vector_to_list([
          'constant_declaration',
          transform(node.declarations[0].id),
          transform(node.declarations[0].init as es.Expression)
        ])
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
      return vector_to_list(['return_statement', transform(node.argument as es.Expression)])
    }
  ],

  [
    'CallExpression',
    (node: es.Node) => {
      node = node as es.CallExpression
      return vector_to_list([
        'application',
        transform(node.callee),
        vector_to_list(node.arguments.map(transform))
      ])
    }
  ],

  [
    'UnaryExpression',
    (node: es.Node) => {
      node = node as es.UnaryExpression
      const loc = node.loc as es.SourceLocation
      return vector_to_list([
        'application',
        vector_to_list([
          'name',
          node.operator,
          vector_to_list([
            vector_to_list([loc.start.line, loc.start.column]),
            vector_to_list([loc.start.line, loc.start.column + 1])
          ])
        ]),
        vector_to_list([transform(node.argument)])
      ])
    }
  ],

  [
    'BinaryExpression',
    (node: es.Node) => {
      node = node as es.BinaryExpression
      const loc = node.right.loc as es.SourceLocation
      return vector_to_list([
        'application',
        vector_to_list([
          'name',
          node.operator,
          vector_to_list([
            vector_to_list([loc.start.line, loc.start.column - 1]),
            vector_to_list([loc.start.line, loc.start.column])
          ])
        ]),
        vector_to_list([transform(node.left), transform(node.right)])
      ])
    }
  ],

  [
    'LogicalExpression',
    (node: es.Node) => {
      node = node as es.LogicalExpression
      const loc = node.right.loc as es.SourceLocation
      return vector_to_list([
        'boolean_operation',
        vector_to_list([
          'name',
          node.operator,
          vector_to_list([
            vector_to_list([loc.start.line, loc.start.column - 1]),
            vector_to_list([loc.start.line, loc.start.column])
          ])
        ]),
        vector_to_list([transform(node.left), transform(node.right)])
      ])
    }
  ],

  [
    'ConditionalExpression',
    (node: es.Node) => {
      node = node as es.ConditionalExpression
      return vector_to_list([
        'conditional_expression',
        transform(node.test),
        transform(node.consequent),
        transform(node.alternate)
      ])
    }
  ],

  [
    'ArrowFunctionExpression',
    (node: es.Node) => {
      node = node as es.ArrowFunctionExpression
      const loc = node.body.loc as es.SourceLocation
      const transformed_body = transform(node.body)
      return vector_to_list([
        'function_definition',
        vector_to_list(node.params.map(transform)),
	transformed_body[0] === 'block'
	? transformed_body
        : vector_to_list([
            'return_statement',
            transformed_body,
            vector_to_list([
              vector_to_list([loc.start.line, loc.start.column]),
              vector_to_list([loc.end.line, loc.end.column])
            ])
          ])
      ])
    }
  ],

  [
    'Identifier',
    (node: es.Node) => {
      node = node as es.Identifier
      return vector_to_list(['name', node.name])
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
      return vector_to_list(['array_expression', vector_to_list(node.elements.map(transform))])
    }
  ],

  [
    'AssignmentExpression',
    (node: es.Node) => {
      node = node as es.AssignmentExpression
      if (node.left.type === 'Identifier') {
        return vector_to_list([
          'assignment',
          transform(node.left as es.Identifier),
          transform(node.right)
        ])
      } else if (node.left.type === 'MemberExpression') {
        return vector_to_list([
          'array_assignment',
          transform(node.left as es.Expression),
          transform(node.right)
        ])
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
      return vector_to_list([
        'for_loop',
        transform(node.init as es.VariableDeclaration | es.Expression),
        transform(node.test as es.Expression),
        transform(node.update as es.Expression),
        transform(node.body)
      ])
    }
  ],

  [
    'WhileStatement',
    (node: es.Node) => {
      node = node as es.WhileStatement
      return vector_to_list(['while_loop', transform(node.test), transform(node.body)])
    }
  ],

  [
    'BreakStatement',
    (node: es.Node) => {
      node = node as es.BreakStatement
      return vector_to_list(['break_statement'])
    }
  ],

  [
    'ContinueStatement',
    (node: es.Node) => {
      node = node as es.ContinueStatement
      return vector_to_list(['continue_statement'])
    }
  ],

  [
    'ObjectExpression',
    (node: es.Node) => {
      node = node as es.ObjectExpression
      return vector_to_list(['object_expression', vector_to_list(node.properties.map(transform))])
    }
  ],

  [
    'MemberExpression',
    (node: es.Node) => {
      node = node as es.MemberExpression
      return vector_to_list(['array_access', transform(node.object), transform(node.property)])
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

export function parse(x: string, context: Context): Value {
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
