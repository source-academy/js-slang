import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode } from '../types'
import { annotateProgram } from './annotator'
import * as es from 'estree'

// // main function that will infer a program
export function inferProgram(program: es.Program): TypeAnnotatedNode<es.Program> {
  function inferLiteral(literal: TypeAnnotatedNode<es.Literal>) {
    const valueOfLiteral = literal.value
    if (typeof valueOfLiteral === 'number') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'number'
      }
      literal.typability = 'Typed'
    }
    else if (typeof valueOfLiteral === 'boolean') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'boolean'
      }
      literal.typability = 'Typed'
    }
    else if (typeof valueOfLiteral === 'string') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'string'
      }
      literal.typability = 'Typed'
    }
    else if (typeof valueOfLiteral === 'undefined') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'undefined'
      }
      literal.typability = 'Typed'
    }
  }
  
  // function inferVariableDeclaration(variableDeclaration: TypeAnnotatedNode<es.VariableDeclaration>) {
  //   // get variableType
  //   const variableDeclarator = variableDeclaration.declarations[0]  // variableDeclarator node (todo: should we confirm its type?)
  //   const variableType = variableDeclarator.init.inferredType.name;
  //
  //   // declare
  //   variableDeclaration.inferredType = {
  //     kind: 'const',  // Source 1 only has const declaration (otherwise to play safe we could also use the 'kind' value in the VariableDeclaration node)
  //     name: variableType
  //   }
  //   variableDeclaration.typability = 'Typed'
  // }
  // function inferBinaryExpression(binaryExpression: TypeAnnotatedNode<es.BinaryExpression>) {
  //   // get result type of binary expression from type environment
  //   // const resultType = ...;
  //
  //   // declare
  //   binaryExpression.inferredType = {
  //     kind : 'primitive',
  //     name: resultType
  //   }
  //   binaryExpression.typability = 'Typed'
  // }
  // function inferFunctionDeclaration(functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration>) {
  //   // get argumentTypes
  //   var argumentTypes = [];
  //
  //   // get resultType
  //   const bodyNodes = functionDeclaration.body.body;
  //   var resultType;
  //   for (var i = 0; i < bodyNodes.length; i++) {
  //     if (typeof bodyNodes[i] === es.ReturnStatement) {
  //       resultType = bodyNodes[i].argument.inferredType;
  //     }
  //   }
  //
  //   // declare
  //   functionDeclaration.inferredType = {
  //     kind : 'function',
  //     argumentTypes : argumentTypes,
  //     resultType :  resultType
  //   }
  //   functionDeclaration.typability = 'Typed'
  // }
  
  // annotate program
  program = annotateProgram(program)
  
  // visit Literals and type check them
  ancestor(program as es.Node, {
    Literal: inferLiteral,
    VariableDeclaration: inferVariableDeclaration
    // BinaryExpression: inferBinaryExpression
    // FunctionDeclaration: inferFunctionDeclaration
  })
  
  // return the AST with annotated types
  return program
}
