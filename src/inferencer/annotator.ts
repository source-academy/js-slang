import { ancestor } from 'acorn-walk/dist/walk'
import { TypeVariableAnnotatedNode } from '../types'
import * as es from 'estree'

let typeVariableId = 1
function notAnnotated(node: TypeVariableAnnotatedNode<es.Node>): boolean {
  return node.typeVariableId === undefined || node.typeVariableId === null
}

function annotateNode(node: TypeVariableAnnotatedNode<es.Node>, isPolymorphic: boolean = false) {
  if (notAnnotated(node)) {
    node.typeVariableId = typeVariableId
    typeVariableId += 1
  }
  node.isPolymorphic = isPolymorphic
}

// main function that will annotate an AST with type variables
export function annotateProgram(program: es.Program): es.Program {
  function annotateLiteral(literal: TypeVariableAnnotatedNode<es.Literal>) {
    annotateNode(literal)
  }
  function annotateConstantDeclaration(
    declaration: TypeVariableAnnotatedNode<es.VariableDeclarator>
  ) {
    const id: TypeVariableAnnotatedNode<es.Pattern> = declaration.id
    annotateNode(id)

    if (declaration.init !== null && declaration.init !== undefined) {
      const init: TypeVariableAnnotatedNode<es.Expression> = declaration.init
      annotateNode(init)
    }
  }

  function annotateExpressionStatement(
    expressionStatement: TypeVariableAnnotatedNode<es.ExpressionStatement>
  ) {
    const expression: TypeVariableAnnotatedNode<es.Expression> = expressionStatement.expression
    annotateNode(expression)
  }

  function annotateBinaryExpression(
    binaryExpression: TypeVariableAnnotatedNode<es.BinaryExpression | es.LogicalExpression>
  ) {
    const left: TypeVariableAnnotatedNode<es.Expression> = binaryExpression.left
    const right: TypeVariableAnnotatedNode<es.Expression> = binaryExpression.right

    annotateNode(left)
    annotateNode(right)
  }

  function annotateUnaryExpression(unaryExpression: TypeVariableAnnotatedNode<es.UnaryExpression>) {
    const argument: TypeVariableAnnotatedNode<es.Expression> = unaryExpression.argument
    annotateNode(argument)
  }

  function annotateFunctionDeclaration(
    functionDeclaration: TypeVariableAnnotatedNode<es.FunctionDeclaration>
  ) {
    const params: TypeVariableAnnotatedNode<es.Pattern>[] = functionDeclaration.params
    params.forEach(param => annotateNode(param, true))

    // TODO figure out what to do with the function body.
    const result: TypeVariableAnnotatedNode<es.BlockStatement> = functionDeclaration.body
    annotateNode(result)
  }

  function annotateFunctionDefinitions(
    functionDefinition: TypeVariableAnnotatedNode<es.ArrowFunctionExpression>
  ) {
    const params: TypeVariableAnnotatedNode<es.Pattern>[] = functionDefinition.params
    params.forEach(param => annotateNode(param, true))

    // TODO figure out what to do with the function body.
    const result: TypeVariableAnnotatedNode<es.Node> = functionDefinition.body
    annotateNode(result)
  }

  function annotateFunctionApplication(
    functionApplication: TypeVariableAnnotatedNode<es.CallExpression>
  ) {
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
