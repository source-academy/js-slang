import * as es from 'estree'
import * as create from './utils/astCreator'

export function transform(node: es.Node) {
  const transformer = transformers[node.type]
  const transformed = transformer(node)
  if (
    transformed !== null &&
    transformed !== undefined &&
    typeof transformed === 'object' &&
    transformed.tag !== undefined
  ) {
    transformed.loc = node.loc
  }
  return transformed
}

/**
 * Clone and transform all nodes
 * TODO: to prep for future use to
 * get back line nos for error messages
 */
const transformers = Object.freeze({
  Program(program: es.Program) {
    return {
      type: 'Program',
      body: program.body.map(transform),
      sourceType: 'module'
    }
  },
  BlockStatement(block: es.BlockStatement) {
    return create.blockStatement(block.body.map(transform))
  },
  ExpressionStatement(node: es.ExpressionStatement) {
    return create.expressionStatement(transform(node.expression))
  },
  IfStatement(node: es.IfStatement) {
    return {
      type: 'IfStatement',
      test: transform(node.test),
      consequent: transform(node.consequent),
      alternate: node.alternate && transform(node.alternate)
    }
  },
  /**
   * Transform function declarations
   * function f(args...) {
   *  statements...
   * }
   * into
   * const f = (args...) {
   *  statements...
   * }
   *
   */
  FunctionDeclaration(node: es.FunctionDeclaration) {
    const { id, params, body } = node
    return create.constantDeclaration(
      (id as es.Identifier).name,
      transform(create.blockArrowFunction(params.map(transform), transform(body)))
    )
  },
  /**
   * Assumes that declarations are exactly (const | let) name = value;
   */
  VariableDeclaration(node: es.VariableDeclaration) {
    const { id, init } = node.declarations[0]
    return {
      type: 'VariableDeclaration',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: transform(id),
          init: transform(init!)
        }
      ],
      kind: node.kind
    }
  },
  ReturnStatement(node: es.ReturnStatement) {
    return create.returnStatement(transform(node.argument!))
  },
  CallExpression(node: es.CallExpression) {
    return create.callExpression(transform(node.callee), node.arguments.map(transform))
  },
  UnaryExpression(node: es.UnaryExpression) {
    return {
      type: 'UnaryExpression',
      operator: node.operator,
      prefix: node.prefix,
      argument: transform(node.argument)
    }
  },
  BinaryExpression(node: es.BinaryExpression) {
    return {
      type: 'BinaryExpression',
      operator: node.operator,
      left: transform(node.left),
      right: transform(node.right)
    }
  },
  LogicalExpression(node: es.LogicalExpression) {
    return {
      type: 'LogicalExpression',
      left: transform(node.left),
      operator: node.operator,
      right: transform(node.right)
    }
  },
  ConditionalExpression(node: es.ConditionalExpression) {
    return {
      type: 'ConditionalExpression',
      test: transform(node.test),
      consequent: transform(node.consequent),
      alternate: transform(node.alternate)
    }
  },
  ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
    if (node.expression) {
      return transform(
        create.blockArrowFunction(
          node.params as es.Identifier[],
          create.blockStatement([create.returnStatement(node.body as es.Expression)])
        )
      )
    } else {
      return {
        type: 'ArrowFunctionExpression',
        expression: false,
        generator: false,
        params: node.params.map(transform),
        body: transform(node.body)
      }
    }
  },
  Identifier(node: es.Identifier) {
    return create.identifier(node.name)
  },
  Literal(node: es.Literal) {
    return {
      type: 'Literal',
      value: node.value
    }
  },
  ArrayExpression(node: es.ArrayExpression) {
    return {
      type: 'ArrayExpression',
      elements: node.elements.map(transform)
    }
  },
  AssignmentExpression(node: es.AssignmentExpression) {
    return {
      type: 'AssignmentExpression',
      operator: node.operator,
      left: transform(node.left),
      right: transform(node.right)
    }
  },
  ForStatement(node: es.ForStatement) {
    return {
      type: 'ForStatement',
      init: node.init && transform(node.init),
      test: node.test && transform(node.test),
      update: node.update && transform(node.update),
      body: transform(node.body)
    }
  },
  WhileStatement(node: es.WhileStatement) {
    return {
      type: 'WhileStatement',
      test: transform(node.test),
      body: transform(node.body)
    }
  },
  BreakStatement(node: es.BreakStatement) {
    return {
      type: 'BreakStatement'
    }
  },
  ContinueStatement(node: es.ContinueStatement) {
    return {
      type: 'ContinueStatement'
    }
  },
  MemberExpression(node: es.MemberExpression) {
    return {
      type: 'MemberExpression',
      object: transform(node.object),
      property: transform(node.property),
      computed: node.computed
    }
  },
  ObjectExpression(node: es.ObjectExpression) {
    return {
      type: 'ObjectExpression',
      properties: node.properties.map(transform)
    }
  },
  Property(node: es.Property) {
    return {
      type: 'Property',
      method: node.method,
      shorthand: node.shorthand,
      computed: node.computed,
      key: transform(node.key),
      value: transform(node.value)
    }
  }
})
