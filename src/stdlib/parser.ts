import type es from 'estree';

import { parse as sourceParse } from '../parser/parser';
import { SourceParser } from '../parser/source';
import { libraryParserLanguage } from '../parser/source/syntax';
import type { Context, ContiguousArrayElements, Node, NodeTypeToNode, Value } from '../types';
import { getSourceVariableDeclaration } from '../utils/ast/helpers';
import { isDeclaration } from '../utils/ast/typeGuards';
import { oneLine } from '../utils/formatters';
import { RuntimeSourceError } from '../errors/base';
import { vector_to_list, type List } from './list';

class ParseError extends RuntimeSourceError<Node | undefined> {
  private readonly explanation: string;

  constructor(
    explanation: string,
    parseFuncName: string,
    node?: Node
  ) {
    super(node)
    this.explanation = `${parseFuncName}: ${explanation}`;
  }

  public override explain(): string {
    return this.explanation;
  }
}

function unreachable() {
  console.error(oneLine`
    UNREACHABLE CODE REACHED!
    Please file an issue at
    https://github.com/source-academy/js-slang/issues
    if you see this.
  `);
}

interface TransformerData {
  transform(node: Node): List;
  makeSequenceIfNeeded(exs: Node[]): List;
  makeBlockIfNeeded(exs: Node[]): List;
  funcName: string;
}

// sequences of expressions of length 1
// can be represented by the element itself,
// instead of constructing a sequence

// function makeSequenceIfNeeded(this: TransformerData, exs: Node[]): List {
//   return exs.length === 1
//     ? this.transform(exs[0])
//     : vector_to_list(['sequence', vector_to_list(exs.map(this.transform))]);
// }

// function makeBlockIfNeeded(this: TransformerData, exs: Node[]): List {
//   return hasDeclarationAtToplevel(exs)
//     ? vector_to_list(['block', makeSequenceIfNeeded.call(this ,exs)])
//     : makeSequenceIfNeeded.call(this, exs);
// }

// checks if sequence has declaration at toplevel
// (outside of any block)
function hasDeclarationAtToplevel(exs: Node[]) {
  return exs.some(isDeclaration);
}

type ParseTransformer<T extends Node> = (
  this: TransformerData,
  node: T
) => List;
type ASTTransformers = {
  [K in Node['type']]?: ParseTransformer<NodeTypeToNode<K>>;
};

const transformers: ASTTransformers = {
  ArrayExpression({ elements }) {
    return vector_to_list([
      'array_expression',
      vector_to_list((elements as ContiguousArrayElements).map(this.transform)),
    ])
  },
  ArrowFunctionExpression({ body, params }) {
    return vector_to_list([
      'lambda_expression',
      vector_to_list(params.map(this.transform)),
      body.type === 'BlockStatement'
        ? // body.body: strip away one layer of block:
          // The body of a function is the statement
          // inside the curly braces.
          this.makeBlockIfNeeded(body.body)
        : vector_to_list(['return_statement', this.transform(body)]),
    ])
  },
  AssignmentExpression(node) {
    if (node.left.type === 'Identifier') {
      return vector_to_list(['assignment', this.transform(node.left), this.transform(node.right)]);
    } else if (node.left.type === 'MemberExpression') {
      return vector_to_list(['object_assignment', this.transform(node.left), this.transform(node.right)]);
    } else {
      unreachable();
      throw new ParseError('Invalid assignment', this.funcName, node);
    }
  },
  BinaryExpression(node) {
    return vector_to_list([
      'binary_operator_combination',
      node.operator,
      this.transform(node.left),
      this.transform(node.right),
    ])
  },
  BlockStatement({ body }) { 
    return this.makeBlockIfNeeded(body)
  },
  BreakStatement: () => vector_to_list(['break_statement']),
  CallExpression({ callee, arguments: args }) {
    return vector_to_list(['application', this.transform(callee), vector_to_list(args.map(this.transform))])
  },
  ClassDeclaration(node) {
    return vector_to_list([
      'class_declaration',
      vector_to_list([
        'name',
        node.id?.name,
        !node.superClass ? null : this.transform(node.superClass),
        node.body.body.map(this.transform),
      ]),
    ]);
  },
  ConditionalExpression(node) {
    return vector_to_list([
      'conditional_expression',
      this.transform(node.test),
      this.transform(node.consequent),
      this.transform(node.alternate),
    ])
  },
  ContinueStatement: () => vector_to_list(['continue_statement']),
  ExportDefaultDeclaration(node) {
    return vector_to_list(['export_default_declaration', this.transform(node.declaration)]);
  },
  ExportNamedDeclaration({ declaration, specifiers }) {
    return vector_to_list([
      'export_named_declaration',
      declaration ? this.transform(declaration) : specifiers.map(this.transform),
    ]);
  },
  ExportSpecifier: node => vector_to_list(['name', node.exported.name]),
  ExpressionStatement({ expression }) {
    return this.transform(expression)
  },
  ForStatement(node) {
    return vector_to_list([
      'for_loop',
      this.transform(node.init!),
      this.transform(node.test!),
      this.transform(node.update!),
      this.transform(node.body),
    ])
  },
  FunctionDeclaration({ id, params, body }) {
    return vector_to_list([
      'function_declaration',
      this.transform(id!),
      vector_to_list(params.map(this.transform)),
      this.makeBlockIfNeeded(body.body),
    ])
  },
  FunctionExpression({ body: { body }, params }) {
    return vector_to_list([
      'lambda_expression',
      vector_to_list(params.map(this.transform)),
      this.makeBlockIfNeeded(body),
    ])
  },
  Identifier: ({ name }) => vector_to_list(['name', name]),
  IfStatement(node) {
    return vector_to_list([
      'conditional_statement',
      this.transform(node.test),
      this.transform(node.consequent),
      node.alternate == null ? this.makeSequenceIfNeeded([]) : this.transform(node.alternate),
    ])
  },
  ImportDeclaration(node) {
    return vector_to_list([
      'import_declaration',
      vector_to_list(node.specifiers.map(this.transform)),
      node.source.value,
    ])
  },
  ImportDefaultSpecifier: () => vector_to_list(['default']),
  ImportSpecifier: node => vector_to_list(['name', node.imported.name]),
  Literal: ({ value }) => vector_to_list(['literal', value]),
  LogicalExpression(node) {
    return vector_to_list([
      'logical_composition',
      node.operator,
      this.transform(node.left),
      this.transform(node.right),
    ])
  },
  MemberExpression(node) {
    // "computed" property of MemberExpression distinguishes
    // between dot access (not computed) and
    // a[...] (computed)
    // the key in dot access is meant as string, and
    // represented by a "property" node in parse result
    return vector_to_list([
      'object_access',
      this.transform(node.object),
      !node.computed && node.property.type === 'Identifier'
        ? vector_to_list(['property', node.property.name])
        : this.transform(node.property),
    ]);
  },
  MethodDefinition(node) {
    return vector_to_list([
      'method_definition',
      node.kind,
      node.static,
      this.transform(node.key),
      this.transform(node.value),
    ])
  },
  NewExpression({ callee, arguments: args }) {
    return vector_to_list(['new_expression', this.transform(callee), vector_to_list(args.map(this.transform))]);
  },
  ObjectExpression({ properties }) {
    return vector_to_list(['object_expression', vector_to_list(properties.map(this.transform))]);
  },
  Program({ body }) {
    return this.makeSequenceIfNeeded(body)
  },
  Property(node) {
    // identifiers before the ":" in literal objects are meant
    // as string, and represented by a "property" node in parse result
    return vector_to_list([
      'key_value_pair',
      node.key.type === 'Identifier'
        ? vector_to_list(['property', node.key.name])
        : this.transform(node.key),
      this.transform(node.value),
    ]);
  },
  RestElement({ argument }) {
    return vector_to_list(['rest_element', this.transform(argument)]);
  },
  ReturnStatement(node) {
    return vector_to_list(['return_statement', this.transform(node.argument!)]);
  },
  SpreadElement({ argument }) { 
    return vector_to_list(['spread_element', this.transform(argument)])
  },
  StatementSequence({ body }) {
    return this.makeSequenceIfNeeded(body);
  },
  Super: () => vector_to_list(['super_expression']),
  ThisExpression: () => vector_to_list(['this_expression']),
  ThrowStatement({ argument }) {
    return vector_to_list(['throw_statement', this.transform(argument)]);
  },
  TryStatement(node) {
    return vector_to_list([
      'try_statement',
      this.transform(node.block),
      !node.handler ? null : vector_to_list(['name', (node.handler.param as es.Identifier).name]),
      !node.handler ? null : this.transform(node.handler.body),
    ]);
  },
  UnaryExpression({ operator, argument }) {
    return vector_to_list([
      'unary_operator_combination',
      operator === '-' ? '-unary' : operator,
      this.transform(argument),
    ])
  },
  VariableDeclaration(node) {
    const { id, init } = getSourceVariableDeclaration(node);

    if (node.kind === 'let') {
      return vector_to_list(['variable_declaration', this.transform(id), this.transform(init)]);
    } else if (node.kind === 'const') {
      return vector_to_list(['constant_declaration', this.transform(id), this.transform(init)]);
    } else {
      unreachable();
      throw new ParseError(`Invalid declaration kind for VariableDeclaration: ${node.kind}`, this.funcName, node);
    }
  },
  WhileStatement({ test, body }) {
    return vector_to_list(['while_loop', this.transform(test), this.transform(body)]);
  },
};

export function parse(x: string, context: Context): Value {
  context.chapter = libraryParserLanguage;
  const program = sourceParse(x, context);
  if (context.errors.length > 0) {
    throw new ParseError(context.errors[0].explain(),  parse.name);
  }

  function transform(node: Node) {
    if (!(node.type in transformers)) {
      unreachable();
      throw new ParseError(`Cannot transform unknown node type: ${node.type}`, parse.name, node);
    }

    const transformer = transformers[node.type] as ParseTransformer<Node>;
    return transformer.call({
      funcName: parse.name,
      transform,
      makeBlockIfNeeded,
      makeSequenceIfNeeded
    }, node);
  }

  function makeSequenceIfNeeded(exs: Node[]): List {
    return exs.length === 1
      ? transform(exs[0])
      : vector_to_list(['sequence', vector_to_list(exs.map(transform))]);
  }

  function makeBlockIfNeeded(exs: Node[]): List {
    return hasDeclarationAtToplevel(exs)
      ? vector_to_list(['block', makeSequenceIfNeeded(exs)])
      : makeSequenceIfNeeded(exs);
  }

  if (program) {
    return transform(program);
  } else {
    unreachable();
    throw new ParseError('Invalid parse', parse.name);
  }
}

/**
 * A wrapper around the Source Parser's `tokenize` function. Set `asRuntime` to `true`
 * if the function is meant to be called from Source code.
 */
export function tokenize(x: string, context: Context, asRuntime?: boolean): Value {
  try {
    const tokensArr = SourceParser.tokenize(x, context).map(tok => x.substring(tok.start, tok.end));
    return vector_to_list(tokensArr);
  } catch (error) {
    if (asRuntime) {
      throw new ParseError(error.message, tokenize.name);
    }

    throw error;
  }
}
