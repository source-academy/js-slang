import type es from 'estree'

import { parse as sourceParse } from '../parser/parser'
import { SourceParser } from '../parser/source'
import { libraryParserLanguage } from '../parser/source/syntax'
import type { Context, ContiguousArrayElements, Node, NodeTypeToNode, Value } from '../types'
import { oneLine } from '../utils/formatters'
import { getSourceVariableDeclaration } from '../utils/ast/helpers'
import { isDeclaration } from '../utils/ast/typeGuards'
import { vector_to_list, type List } from './list'

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

function makeSequenceIfNeeded(exs: Node[]): List {
  return exs.length === 1
    ? transform(exs[0])
    : vector_to_list(['sequence', vector_to_list(exs.map(transform))])
}

function makeBlockIfNeeded(exs: Node[]): List {
  return hasDeclarationAtToplevel(exs)
    ? vector_to_list(['block', makeSequenceIfNeeded(exs)])
    : makeSequenceIfNeeded(exs)
}

// checks if sequence has declaration at toplevel
// (outside of any block)
function hasDeclarationAtToplevel(exs: Node[]) {
  return exs.some(isDeclaration)
}

type ParseTransformer<T extends Node> = (node: T) => List
type ASTTransformers = {
  [K in Node['type']]?: ParseTransformer<NodeTypeToNode<K>>
}

const transformers: ASTTransformers = {
  ArrayExpression: ({ elements }) =>
    vector_to_list([
      'array_expression',
      vector_to_list((elements as ContiguousArrayElements).map(transform))
    ]),
  ArrowFunctionExpression: node =>
    vector_to_list([
      'lambda_expression',
      vector_to_list(node.params.map(transform)),
      node.body.type === 'BlockStatement'
        ? // body.body: strip away one layer of block:
          // The body of a function is the statement
          // inside the curly braces.
          makeBlockIfNeeded(node.body.body)
        : vector_to_list(['return_statement', transform(node.body)])
    ]),
  AssignmentExpression: node => {
    if (node.left.type === 'Identifier') {
      return vector_to_list(['assignment', transform(node.left), transform(node.right)])
    } else if (node.left.type === 'MemberExpression') {
      return vector_to_list(['object_assignment', transform(node.left), transform(node.right)])
    } else {
      unreachable()
      throw new ParseError('Invalid assignment')
    }
  },
  BinaryExpression: node =>
    vector_to_list([
      'binary_operator_combination',
      node.operator,
      transform(node.left),
      transform(node.right)
    ]),
  BlockStatement: ({ body }) => makeBlockIfNeeded(body),
  BreakStatement: () => vector_to_list(['break_statement']),
  CallExpression: ({ callee, arguments: args }) =>
    vector_to_list(['application', transform(callee), vector_to_list(args.map(transform))]),
  ClassDeclaration: node => {
    return vector_to_list([
      'class_declaration',
      vector_to_list([
        'name',
        node.id?.name,
        !node.superClass ? null : transform(node.superClass),
        node.body.body.map(transform)
      ])
    ])
  },
  ConditionalExpression: node =>
    vector_to_list([
      'conditional_expression',
      transform(node.test),
      transform(node.consequent),
      transform(node.alternate)
    ]),
  ContinueStatement: () => vector_to_list(['continue_statement']),
  ExportDefaultDeclaration: node =>
    vector_to_list(['export_default_declaration', transform(node.declaration)]),
  ExportNamedDeclaration: ({ declaration, specifiers }) =>
    vector_to_list([
      'export_named_declaration',
      declaration ? transform(declaration) : specifiers.map(transform)
    ]),
  ExportSpecifier: node => vector_to_list(['name', node.exported.name]),
  ExpressionStatement: ({ expression }) => transform(expression),
  ForStatement: node =>
    vector_to_list([
      'for_loop',
      transform(node.init!),
      transform(node.test!),
      transform(node.update!),
      transform(node.body)
    ]),
  FunctionDeclaration: node =>
    vector_to_list([
      'function_declaration',
      transform(node.id!),
      vector_to_list(node.params.map(transform)),
      makeBlockIfNeeded(node.body.body)
    ]),
  FunctionExpression: ({ body: { body }, params }) =>
    vector_to_list([
      'lambda_expression',
      vector_to_list(params.map(transform)),
      makeBlockIfNeeded(body)
    ]),
  Identifier: ({ name }) => vector_to_list(['name', name]),
  IfStatement: node =>
    vector_to_list([
      'conditional_statement',
      transform(node.test),
      transform(node.consequent),
      node.alternate == null ? makeSequenceIfNeeded([]) : transform(node.alternate)
    ]),
  ImportDeclaration: node =>
    vector_to_list([
      'import_declaration',
      vector_to_list(node.specifiers.map(transform)),
      node.source.value
    ]),
  ImportDefaultSpecifier: () => vector_to_list(['default']),
  ImportSpecifier: node => vector_to_list(['name', node.imported.name]),
  Literal: ({ value }) => vector_to_list(['literal', value]),
  LogicalExpression: node =>
    vector_to_list([
      'logical_composition',
      node.operator,
      transform(node.left),
      transform(node.right)
    ]),
  MemberExpression: node => {
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
  },
  MethodDefinition: node =>
    vector_to_list([
      'method_definition',
      node.kind,
      node.static,
      transform(node.key),
      transform(node.value)
    ]),
  NewExpression: ({ callee, arguments: args }) =>
    vector_to_list(['new_expression', transform(callee), vector_to_list(args.map(transform))]),
  ObjectExpression: ({ properties }) =>
    vector_to_list(['object_expression', vector_to_list(properties.map(transform))]),
  Program: ({ body }) => makeSequenceIfNeeded(body),
  Property: node => {
    // identifiers before the ":" in literal objects are meant
    // as string, and represented by a "property" node in parse result
    return vector_to_list([
      'key_value_pair',
      node.key.type === 'Identifier'
        ? vector_to_list(['property', node.key.name])
        : transform(node.key),
      transform(node.value)
    ])
  },
  RestElement: ({ argument }) => vector_to_list(['rest_element', transform(argument)]),
  ReturnStatement: node => vector_to_list(['return_statement', transform(node.argument!)]),
  SpreadElement: ({ argument }) => vector_to_list(['spread_element', transform(argument)]),
  StatementSequence: ({ body }) => makeSequenceIfNeeded(body),
  Super: () => vector_to_list(['super_expression']),
  ThisExpression: () => vector_to_list(['this_expression']),
  ThrowStatement: ({ argument }) => vector_to_list(['throw_statement', transform(argument)]),
  TryStatement: node => {
    return vector_to_list([
      'try_statement',
      transform(node.block),
      !node.handler ? null : vector_to_list(['name', (node.handler.param as es.Identifier).name]),
      !node.handler ? null : transform(node.handler.body)
    ])
  },
  UnaryExpression: ({ operator, argument }) =>
    vector_to_list([
      'unary_operator_combination',
      operator === '-' ? '-unary' : operator,
      transform(argument)
    ]),
  VariableDeclaration: node => {
    const { id, init } = getSourceVariableDeclaration(node)

    if (node.kind === 'let') {
      return vector_to_list(['variable_declaration', transform(id), transform(init)])
    } else if (node.kind === 'const') {
      return vector_to_list(['constant_declaration', transform(id), transform(init)])
    } else {
      unreachable()
      throw new ParseError('Invalid declaration kind')
    }
  },
  WhileStatement: ({ test, body }) =>
    vector_to_list(['while_loop', transform(test), transform(body)])
}

/**
 * Converts the given Node to a Source Value (which will be a list
 * consisting of a string description followed by that node's components)
 */
function transform(node: Node) {
  if (!(node.type in transformers)) {
    unreachable()
    throw new ParseError('Cannot transform unknown type: ' + node.type)
  }

  const transformer = transformers[node.type] as ParseTransformer<Node>
  return transformer(node)
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
