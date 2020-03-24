import * as es from 'estree'

import { parse as sourceParse } from '../parser/parser'
import { libraryParserLanguage } from '../parser/syntaxBlacklist'
import { Context, Value } from '../types'
import { oneLine } from '../utils/formatters'
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

// sequences of expressions of length 1
// can be represented by the element itself,
// instead of constructing a sequence

function makeSequenceIfNeeded(exs: es.Node[]) {
  return exs.length === 1
    ? transform(exs[0])
    : vector_to_list(['sequence', vector_to_list(exs.map(transform))])
}

type ASTTransformers = Map<string, (node: es.Node) => Value>

let transformers: ASTTransformers
transformers = new Map([
  [
    'Program',
    (node: es.Node) => {
      node = node as es.Program
      return makeSequenceIfNeeded(node.body)
    }
  ],

  [
    'BlockStatement',
    (node: es.BlockStatement) => {
      return vector_to_list(['block', makeSequenceIfNeeded(node.body)])
    }
  ],

  [
    'ExpressionStatement',
    (node: es.ExpressionStatement) => {
      return transform(node.expression)
    }
  ],

  [
    'IfStatement',
    (node: es.IfStatement) => {
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
    (node: es.FunctionDeclaration) => {
      return vector_to_list([
        'constant_declaration',
        transform(node.id as es.Identifier),
        vector_to_list([
          'function_definition',
          vector_to_list(node.params.map(transform)),
          // body.body: strip away one layer of block:
          // The body of a function is the statement
          // inside the curly braces.
          makeSequenceIfNeeded(node.body.body)
        ])
      ])
    }
  ],

  [
    'VariableDeclaration',
    (node: es.VariableDeclaration) => {
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
    (node: es.ReturnStatement) => {
      return vector_to_list(['return_statement', transform(node.argument as es.Expression)])
    }
  ],

  [
    'CallExpression',
    (node: es.CallExpression) => {
      return vector_to_list([
        'application',
        transform(node.callee),
        vector_to_list(node.arguments.map(transform))
      ])
    }
  ],

  [
    'UnaryExpression',
    (node: es.UnaryExpression) => {
      return vector_to_list([
        'application',
        vector_to_list(['name', node.operator]),
        vector_to_list([transform(node.argument)])
      ])
    }
  ],

  [
    'BinaryExpression',
    (node: es.BinaryExpression) => {
      return vector_to_list([
        'application',
        vector_to_list(['name', node.operator]),
        vector_to_list([transform(node.left), transform(node.right)])
      ])
    }
  ],

  [
    'LogicalExpression',
    (node: es.LogicalExpression) => {
      return vector_to_list([
        'boolean_operation',
        vector_to_list(['name', node.operator]),
        vector_to_list([transform(node.left), transform(node.right)])
      ])
    }
  ],

  [
    'ConditionalExpression',
    (node: es.ConditionalExpression) => {
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
    (node: es.ArrowFunctionExpression) => {
      return vector_to_list([
        'function_definition',
        vector_to_list(node.params.map(transform)),
        node.body.type === 'BlockStatement'
          ? // body.body: strip away one layer of block:
            // The body of a function is the statement
            // inside the curly braces.
            makeSequenceIfNeeded(node.body.body)
          : vector_to_list(['return_statement', transform(node.body)])
      ])
    }
  ],

  [
    'Identifier',
    (node: es.Identifier) => {
      return vector_to_list(['name', node.name])
    }
  ],

  [
    'Literal',
    (node: es.Literal) => {
      return node.value
    }
  ],

  [
    'ArrayExpression',
    (node: es.ArrayExpression) => {
      return vector_to_list(['array_expression', vector_to_list(node.elements.map(transform))])
    }
  ],

  [
    'AssignmentExpression',
    (node: es.AssignmentExpression) => {
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
    (node: es.ForStatement) => {
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
    (node: es.WhileStatement) => {
      return vector_to_list(['while_loop', transform(node.test), transform(node.body)])
    }
  ],

  [
    'BreakStatement',
    (node: es.BreakStatement) => {
      return vector_to_list(['break_statement'])
    }
  ],

  [
    'ContinueStatement',
    (node: es.ContinueStatement) => {
      return vector_to_list(['continue_statement'])
    }
  ],

  [
    'ObjectExpression',
    (node: es.ObjectExpression) => {
      return vector_to_list(['object_expression', vector_to_list(node.properties.map(transform))])
    }
  ],

  [
    'MemberExpression',
    (node: es.MemberExpression) => {
      const key =
        node.property.type === 'Identifier'
          ? vector_to_list(['property', node.property.name])
          : transform(node.property)
      return vector_to_list(['object_access', transform(node.object), key])
    }
  ],

  [
    'Property',
    (node: es.Property) => {
      if (node.key.type === 'Literal') {
        return [node.key.value, transform(node.value)]
      } else if (node.key.type === 'Identifier') {
        return [vector_to_list(['property', node.key.name]), transform(node.value)]
      } else {
        unreachable()
        throw new ParseError('Invalid property key type')
      }
    }
  ],

  [
    'ImportDeclaration',
    (node: es.ImportDeclaration) => {
      return vector_to_list([
        'import_declaration',
        vector_to_list(node.specifiers.map(transform)),
        node.source.value
      ])
    }
  ],

  [
    'ImportSpecifier',
    (node: es.ImportSpecifier) => {
      return vector_to_list(['name', node.imported.name])
    }
  ],

  [
    'ClassDeclaration',
    (node: es.ClassDeclaration) => {
      return vector_to_list([
        'class_declaration',
        vector_to_list([
          'name',
          node.id === null ? null : node.id.name,
          node.superClass === null || node.superClass === undefined
            ? null
            : transform(node.superClass),
          node.body.body.map(transform)
        ])
      ])
    }
  ],

  [
    'NewExpression',
    (node: es.NewExpression) => {
      return vector_to_list([
        'new_expression',
        transform(node.callee),
        vector_to_list(node.arguments.map(transform))
      ])
    }
  ],

  [
    'MethodDefinition',
    (node: es.MethodDefinition) => {
      return vector_to_list([
        'method_definition',
        node.kind,
        transform(node.key),
        transform(node.value)
      ])
    }
  ],

  [
    'FunctionExpression',
    (node: es.FunctionExpression) => {
      return vector_to_list([
        'function_definition',
        vector_to_list(node.params.map(transform)),
        makeSequenceIfNeeded(node.body.body)
      ])
    }
  ],

  [
    'ThisExpression',
    (node: es.ThisExpression) => {
      return vector_to_list(['this_expression'])
    }
  ],

  [
    'Super',
    (node: es.Super) => {
      return vector_to_list(['super_expression'])
    }
  ],

  [
    'TryStatement',
    (node: es.TryStatement) => {
      return vector_to_list([
        'try_statement',
        transform(node.block),
        node.handler === null || node.handler === undefined
          ? null
          : vector_to_list(['name', (node.handler.param as es.Identifier).name]),
        node.handler === null || node.handler === undefined ? null : transform(node.handler.body)
      ])
    }
  ],
  [
    'ThrowStatement',
    (node: es.ThrowStatement) => {
      return vector_to_list(['throw_statement', transform(node.argument)])
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
  context.chapter = libraryParserLanguage
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
