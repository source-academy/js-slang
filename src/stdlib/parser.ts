import * as es from 'estree'

import { parse as sourceParse } from '../parser/parser'
import { SourceParser } from '../parser/source'
import { libraryParserLanguage } from '../parser/source/syntax'
import { Context, ContiguousArrayElements, Value } from '../types'
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

function makeBlockIfNeeded(exs: es.Node[]) {
  return hasDeclarationAtToplevel(exs)
    ? vector_to_list(['block', makeSequenceIfNeeded(exs)])
    : makeSequenceIfNeeded(exs)
}

// checks if sequence has declaration at toplevel
// (outside of any block)
function hasDeclarationAtToplevel(exs: es.Node[]) {
  return exs.reduce(
    (b, ex) => b || ex.type === 'VariableDeclaration' || ex.type === 'FunctionDeclaration',
    false
  )
}

type ASTTransformers = Map<string, (node: es.Node) => Value>

const transformers: ASTTransformers = new Map([
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
      return makeBlockIfNeeded(node.body)
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
        node.alternate === null
          ? makeSequenceIfNeeded([])
          : transform(node.alternate as es.Statement)
      ])
    }
  ],

  [
    'FunctionDeclaration',
    (node: es.FunctionDeclaration) => {
      return vector_to_list([
        'function_declaration',
        transform(node.id as es.Identifier),
        vector_to_list(node.params.map(transform)),
        makeBlockIfNeeded(node.body.body)
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
        'unary_operator_combination',
        node.operator === '-' ? '-unary' : node.operator,
        transform(node.argument)
      ])
    }
  ],

  [
    'BinaryExpression',
    (node: es.BinaryExpression) => {
      return vector_to_list([
        'binary_operator_combination',
        node.operator,
        transform(node.left),
        transform(node.right)
      ])
    }
  ],

  [
    'LogicalExpression',
    (node: es.LogicalExpression) => {
      return vector_to_list([
        'logical_composition',
        node.operator,
        transform(node.left),
        transform(node.right)
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
        'lambda_expression',
        vector_to_list(node.params.map(transform)),
        node.body.type === 'BlockStatement'
          ? // body.body: strip away one layer of block:
            // The body of a function is the statement
            // inside the curly braces.
            makeBlockIfNeeded(node.body.body)
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
      return vector_to_list(['literal', node.value])
    }
  ],

  [
    'ArrayExpression',
    (node: es.ArrayExpression) => {
      return vector_to_list([
        'array_expression',
        vector_to_list((node.elements as ContiguousArrayElements).map(transform))
      ])
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
          'object_assignment',
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
    (_node: es.BreakStatement) => {
      return vector_to_list(['break_statement'])
    }
  ],

  [
    'ContinueStatement',
    (_node: es.ContinueStatement) => {
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
      // "computed" property of MemberExpression distinguishes
      // between dot access (not computed) and
      // a[...] (computed)
      // the key in dot access is meant as string, and
      // represented by a "property" node in parse result
      return vector_to_list([
        'object_access',
        transform(node.object),
        !node.computed && node.property.type === 'Identifier'
          ? vector_to_list(['property', node.property.name])
          : transform(node.property)
      ])
    }
  ],

  [
    'Property',
    (node: es.Property) => {
      // identifiers before the ":" in literal objects are meant
      // as string, and represented by a "property" node in parse result
      return vector_to_list([
        'key_value_pair',
        node.key.type === 'Identifier'
          ? vector_to_list(['property', node.key.name])
          : transform(node.key),
        transform(node.value)
      ])
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
    'ImportDefaultSpecifier',
    (_node: es.ImportDefaultSpecifier) => {
      return vector_to_list(['default'])
    }
  ],

  [
    'ExportNamedDeclaration',
    (node: es.ExportNamedDeclaration) => {
      return vector_to_list([
        'export_named_declaration',
        node.declaration ? transform(node.declaration) : node.specifiers.map(transform)
      ])
    }
  ],

  [
    'ExportDefaultDeclaration',
    (node: es.ExportDefaultDeclaration) => {
      return vector_to_list(['export_default_declaration', transform(node.declaration)])
    }
  ],

  [
    'ExportSpecifier',
    (node: es.ExportSpecifier) => {
      return vector_to_list(['name', node.exported.name])
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
        node.static,
        transform(node.key),
        transform(node.value)
      ])
    }
  ],

  [
    'FunctionExpression',
    (node: es.FunctionExpression) => {
      return vector_to_list([
        'lambda_expression',
        vector_to_list(node.params.map(transform)),
        makeBlockIfNeeded(node.body.body)
      ])
    }
  ],

  [
    'ThisExpression',
    (_node: es.ThisExpression) => {
      return vector_to_list(['this_expression'])
    }
  ],

  [
    'Super',
    (_node: es.Super) => {
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
  ],
  [
    'SpreadElement',
    (node: es.SpreadElement) => {
      return vector_to_list(['spread_element', transform(node.argument)])
    }
  ],
  [
    'RestElement',
    (node: es.RestElement) => {
      return vector_to_list(['rest_element', transform(node.argument)])
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
  context.chapter = libraryParserLanguage
  const program = sourceParse(x, context)
  if (context.errors.length > 0) {
    throw new ParseError(context.errors[0].explain())
  }

  if (program) {
    return transform(program)
  } else {
    unreachable()
    throw new ParseError('Invalid parse')
  }
}

export function tokenize(x: string, context: Context): Value {
  const tokensArr = SourceParser.tokenize(x, context).map(tok => x.substring(tok.start, tok.end))
  return vector_to_list(tokensArr)
}
