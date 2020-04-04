import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode } from '../types'
import * as es from 'estree'

let typeVariableId = 1
function notAnnotated(node: TypeAnnotatedNode<es.Node>): boolean {
  return node.typeVariable === undefined
}

function annotateNode(node: TypeAnnotatedNode<es.Node>, isPolymorphic: boolean = false) {
  if (notAnnotated(node)) {
    node.typeVariable = {
      kind: 'variable',
      id: typeVariableId,
      isPolymorphic
    }
    node.typability = 'NotYetTyped'
    typeVariableId += 1
  }
}

// main function that will annotate an AST with type variables
export function annotateProgram(program: es.Program): es.Program {
  function annotateLiteral(literal: TypeAnnotatedNode<es.Literal>) {
    annotateNode(literal)
  }
  function annotateConstantDeclaration(declaration: TypeAnnotatedNode<es.VariableDeclarator>) {
    const id: TypeAnnotatedNode<es.Pattern> = declaration.id
    annotateNode(id)

    if (declaration.init !== null && declaration.init !== undefined) {
      const init: TypeAnnotatedNode<es.Expression> = declaration.init
      annotateNode(init)
    }
  }

  function annotateExpressionStatement(
    expressionStatement: TypeAnnotatedNode<es.ExpressionStatement>
  ) {
    const expression: TypeAnnotatedNode<es.Expression> = expressionStatement.expression
    annotateNode(expression)
  }

  function annotateBinaryExpression(
    binaryExpression: TypeAnnotatedNode<es.BinaryExpression | es.LogicalExpression>
  ) {
    const left: TypeAnnotatedNode<es.Expression> = binaryExpression.left
    const right: TypeAnnotatedNode<es.Expression> = binaryExpression.right

    annotateNode(left)
    annotateNode(right)
  }

  function annotateUnaryExpression(unaryExpression: TypeAnnotatedNode<es.UnaryExpression>) {
    const argument: TypeAnnotatedNode<es.Expression> = unaryExpression.argument
    annotateNode(argument)
  }

  function annotateFunctionDeclaration(
    functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration>
  ) {
    const params: TypeAnnotatedNode<es.Pattern>[] = functionDeclaration.params
    params.forEach(param => annotateNode(param, true))

    // TODO figure out what to do with the function body.
    const result: TypeAnnotatedNode<es.BlockStatement> = functionDeclaration.body
    annotateNode(result)
  }

  function annotateFunctionDefinitions(
    functionDefinition: TypeAnnotatedNode<es.ArrowFunctionExpression>
  ) {
    const params: TypeAnnotatedNode<es.Pattern>[] = functionDefinition.params
    params.forEach(param => annotateNode(param, true))

    // TODO figure out what to do with the function body.
    const result: TypeAnnotatedNode<es.Node> = functionDefinition.body
    annotateNode(result)
  }

  function annotateFunctionApplication(functionApplication: TypeAnnotatedNode<es.CallExpression>) {
    functionApplication.arguments.forEach(argument => annotateNode(argument, true))
  }

  ancestor(program as es.Node, {
    Literal: annotateLiteral,
    VariableDeclarator: annotateConstantDeclaration,
    ExpressionStatement: annotateExpressionStatement,
    BinaryExpression: annotateBinaryExpression,
    LogicalExpression: annotateBinaryExpression,
    UnaryExpression: annotateUnaryExpression,
    FunctionDeclaration: annotateFunctionDeclaration,
    ArrowFunctionExpression: annotateFunctionDefinitions,
    CallExpression: annotateFunctionApplication
  })

  return program
}
