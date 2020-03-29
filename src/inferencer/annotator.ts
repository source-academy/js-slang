import { ancestor } from 'acorn-walk/dist/walk'
import { TypeVariableAnnotatedNode } from '../types'
import * as es from 'estree'

let typeVariableId = 1
function notAnnotated(node: TypeVariableAnnotatedNode<es.Node>): boolean {
  return node.typeVariableId === undefined || node.typeVariableId === null
}

function annotateNode(node: TypeVariableAnnotatedNode<es.Node>, isPolymorphic?: boolean) {
  if (notAnnotated(node)) {
    node.typeVariableId = typeVariableId
    typeVariableId += 1
  }
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

  ancestor(program as es.Node, {
    Literal: annotateLiteral,
    VariableDeclarator: annotateConstantDeclaration,
    ExpressionStatement: annotateExpressionStatement,
    BinaryExpression: annotateBinaryExpression,
    LogicalExpression: annotateBinaryExpression,
    UnaryExpression: annotateUnaryExpression
  })

  return program
}
