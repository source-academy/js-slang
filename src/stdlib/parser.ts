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

type ASTTransformers = Map<string, (node: es.Node) => Value>

function transformAssignment(node: es.AssignmentExpression): Value {
  if (node.operator !== "=") {
    throw new SyntaxError("Update statements not allowed >:(")
  }
  if (node.left.type === 'Identifier') {
    return ({
      tag: "assignment",
      name: transform(node.left as es.Identifier),
      value: transform(node.right),
      loc: node.loc
    })
  } else if (node.left.type === 'MemberExpression') {
    return ({
      tag: "property_assignment",
      object: transform(node.left as es.Expression),
      value: transform(node.right),
      loc: node.loc
    })
  } else {
    throw new SyntaxError("wat :C")
  }
}

let transformers: ASTTransformers
transformers = new Map([
  ["Program", (node: es.Node) => {
    node = <es.Program> node
    return vector_to_list(node.body.map(transform))
  }],
  ["BlockStatement", (node: es.Node) => {
    node = <es.BlockStatement> node
    return ({
      tag: "block",
      body: vector_to_list(node.body.map(transform))
  })}],
  ["ExpressionStatement", (node: es.Node) => {
    node = <es.ExpressionStatement> node
    if (node.expression.type === "AssignmentExpression") {
      return transformAssignment(node.expression);
    } else {
      return transform(node.expression)
    }
  }],
  ["IfStatement", (node: es.Node) => {
    node = <es.IfStatement> node
    return ({
      tag: "conditional_statement",
      predicate: transform(node.test),
      consequent: transform(node.consequent),
      alternative: transform(node.alternate as es.Statement)
  })}],
  ["FunctionDeclaration", (node: es.Node) => {
    node = <es.FunctionDeclaration> node
    return ({
      tag: "constant_declaration",
      name: transform(node.id as es.Identifier),
      value: (transformers.get("FunctionExpression") as Function)(node)
  })}],
  ["VariableDeclaration", (node: es.Node) => {
    node = <es.VariableDeclaration> node
    if (node.kind === 'let') {
      return vector_to_list(
        node.declarations.map(n => {
          return ({
            tag: "variable_declaration",
            name: transform(n.id),
            value: transform(n.init as es.Expression)
          })
        }))
    } else if (node.kind === 'const') {
      return vector_to_list(
        node.declarations.map(n => {
          return ({
            tag: "constant_declaration",
            name: transform(n.id),
            value: transform(n.init as es.Expression)
          })
        }))
    } else {
      throw new SyntaxError("bleugh")
    }
  }],
  ["ReturnStatement", (node: es.Node) => {
    node = <es.ReturnStatement> node
    return ({
      tag: "return_statement",
      expression: transform(node.argument as es.Expression)
  })}],
  ["CallExpression", (node: es.Node) => {
    node = <es.CallExpression> node
    return ({
      tag: "application",
      operator: transform(node.callee),
      operands: vector_to_list(node.arguments.map(transform))
  })}],
  ["UnaryExpression", (node: es.Node) => {
    node = <es.UnaryExpression> node
    let loc = <es.SourceLocation> node.loc
    return ({
      tag: "application",
      operator: {
        tag: "name",
        name: node.operator,
        loc: <es.SourceLocation> {
          start: loc.start,
          end: { line: loc.start.line, column: loc.start.column + 1 }
        }
      },
      operands: vector_to_list([
        transform(node.argument)
      ])
  })}],
  ["BinaryExpression", (node: es.Node) => {
    node = <es.BinaryExpression> node
    let loc = <es.SourceLocation> node.right.loc
    return ({
      tag: "application",
      operator: {
        tag: "name",
        name: node.operator,
        loc: <es.SourceLocation> {
          start: { line: loc.start.line, column: loc.start.column - 1 },
          end: { line: loc.start.line, column: loc.start.column }
        }
      },
      operands: vector_to_list([
        transform(node.left),
        transform(node.right)
      ])
  })}],
  ["LogicalExpression", (node: es.Node) => {
    node = <es.LogicalExpression> node
    let loc = <es.SourceLocation> node.right.loc
    return ({
      tag: "boolean_operation",
      operator: {
        tag: "name",
        name: node.operator,
        loc: <es.SourceLocation> {
          start: { line: loc.start.line, column: loc.start.column - 1 },
          end: { line: loc.start.line, column: loc.start.column }
        }
      },
      operands: vector_to_list([
        transform(node.left),
        transform(node.right)
      ])
  })}],
  ["ConditionalExpression", (node: es.Node) => {
    node = <es.ConditionalExpression> node
    return ({
      tag: "conditional_expression",
      predicate: transform(node.test),
      consequent: transform(node.consequent),
      alternative: transform(node.alternate)
  })}],
  ["FunctionExpression", (node: es.Node) => {
    node = <es.FunctionExpression> node
    return ({
      tag: "function_definition",
      parameters: vector_to_list(node.params.map(transform)),
      body: vector_to_list(node.body.body.map(transform))
  })}],
  ["ArrowFunctionExpression", (node: es.Node) => {
    node = <es.ArrowFunctionExpression> node
    return ({
      tag: "function_definition",
      parameters: vector_to_list(node.params.map(transform)),
      body: {
        tag: "return_statement",
        expression: transform(node.body as es.Expression),
        loc: node.body.loc
      }
  })}],
  ["Identifier", (node: es.Node) => {
    node = <es.Identifier> node
    return ({
      tag: "name",
      name: node.name
  })}],
  ["Literal", (node: es.Node) => {
    node = <es.Literal> node
    return node.value
  }],
  ["ArrayExpression", (node: es.Node) => {
    node = <es.ArrayExpression> node
    if (node.elements.length === 0) {
      return ({
        tag: "empty_list"
      })
    } else {
      return ({
        tag: "array_expression",
        elements: vector_to_list(node.elements.map(transform))
      })
    }
  }],
  ["AssignmentExpression", (node: es.Node) => {
    throw new SyntaxError("not allowed :/")
  }],
  ["ForStatement", (node: es.Node) => {
    node = <es.ForStatement> node
    let init = node.init as es.Node
    let initialiser: Value
    if (init.type === "AssignmentExpression") {
      initialiser = transformAssignment(init)
    } else {
      initialiser = transform(init)
    }
    let update = node.update as es.Node
    let finaliser: Value
    if (update.type === "AssignmentExpression") {
      finaliser = transformAssignment(update)
    } else {
      finaliser = transform(update)
    }
    return ({
      tag: "for_loop",
      initialiser: initialiser,
      predicate: transform(node.test as es.Expression),
      finaliser: finaliser,
      statements: transform(node.body)
  })}],
  ["WhileStatement", (node: es.Node) => {
    node = <es.WhileStatement> node
    return ({
      tag: "while_loop",
      predicate: transform(node.test),
      statements: transform(node.body)
  })}],
  ["BreakStatement", (node: es.Node) => {
    node = <es.BreakStatement> node
    return ({
      tag: "break_statement"
  })}],
  ["ContinueStatement", (node: es.Node) => {
    node = <es.ContinueStatement> node
    return ({
      tag: "continue_statement"
  })}],
  ["ThisExpression", (node: es.Node) => {
    node = <es.ThisExpression> node
    return ({
      tag: "name",
      name: "this"
  })}],
  ["ObjectExpression", (node: es.Node) => {
    node = <es.ObjectExpression> node
    return ({
      tag: "object_expression",
      pairs: vector_to_list(node.properties.map(transform))
  })}],
  ["MemberExpression", (node: es.Node) => {
    node = <es.MemberExpression> node
    return ({
      tag: "property_access",
      object: transform(node.object),
      property: transform(node.property)
  })}],
  ["Property", (node: es.Node) => {
    node = <es.Property> node
    if (node.key.type === 'Literal') {
      return [node.key.value, transform(node.value)];
    } else if (node.key.type === 'Identifier') {
      return [node.key.name, transform(node.value)];
    } else {
      throw new SyntaxError("blah")
    }
  }],
  ["UpdateExpression", (node: es.Node) => {
    node = <es.UpdateExpression> node
    throw new SyntaxError("not allowed :/")
  }],
  ["EmptyStatement", (node: es.Node) => {
    node = <es.EmptyStatement> node
    return []
  }]
])

function transform(node: es.Node) {
  if (transformers.has(node.type)) {
    let transformer = (transformers.get(node.type) as (n: es.Node) => Value)
    let transformed = transformer(node)
    // Attach location information
    if (transformed !== null && transformed !== undefined &&
      typeof transformed === 'object' && transformed.tag !== undefined) {
      transformed.loc = node.loc
    }
    return transformed
  } else {
    throw new SyntaxError("ugh, unknown type: " + node.type)
  }
}

export function parse(x: string): Value {
  const context = createContext(4)
  let program: es.Program | undefined
  program = sourceParse(x, context)
  if (program !== undefined) {
    return transform(program)
  } else {
    throw new SyntaxError("ugh");
  }
}
parse.__SOURCE__ = 'parse(program_string)'
