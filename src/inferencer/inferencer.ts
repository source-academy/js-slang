import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode, Variable } from '../types'
import { annotateProgram } from './annotator'
import { primitiveMap } from './typeEnvironment'
import { updateTypeConstraints } from './constraintStore'
import * as es from 'estree'

// // main function that will infer a program
export function inferProgram(program: es.Program): TypeAnnotatedNode<es.Program> {
  function inferLiteral(literal: TypeAnnotatedNode<es.Literal>) {
    const valueOfLiteral = literal.value
    if (typeof valueOfLiteral === 'number') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'integer'
      }
      literal.typability = 'Typed'
    } else if (typeof valueOfLiteral === 'boolean') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'boolean'
      }
      literal.typability = 'Typed'
    } else if (typeof valueOfLiteral === 'string') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'string'
      }
      literal.typability = 'Typed'
    } else if (typeof valueOfLiteral === 'undefined') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'undefined'
      }
      literal.typability = 'Typed'
    }
  }

  function inferConstantDeclaration(
    constantDeclaration: TypeAnnotatedNode<es.VariableDeclaration>
  ) {
    // step 2. Update typeEnvironment
    // e.g. Given: const x^T1 = 1^T2, Set: Γ[ x ← T1 ]
    const lhs = constantDeclaration.declarations[0].id as TypeAnnotatedNode<es.Identifier>
    const lhsName = lhs.name
    const lhsVariableId = (lhs.typeVariable as Variable).id
    if (lhsName !== undefined && lhsVariableId !== undefined) {
      primitiveMap.set(lhsName, lhsVariableId)
    }

    // step 3. Update type constraints in constraintStore
    // e.g. Given: const x^T1 = 1^T2, Set: T1 = T2
    const rhs = constantDeclaration.declarations[0].init as TypeAnnotatedNode<es.Node> // use es.Node because rhs could be any value/expression
    const rhsVariableId = (rhs.typeVariable as Variable).id
    if (lhsVariableId !== undefined && rhsVariableId !== undefined) {
      updateTypeConstraints(lhsVariableId, rhsVariableId)
    }

    // if manage to pass step 3, means no type error

    // declare
    // not necessary since no one is dependent on constantDeclaration's inferredType??
    // plus not sure what to put in 'kind' and 'name' also
    // constantDeclaration.inferredType = {
    //   kind: 'variable',
    //   name: variableType
    // }
    // constantDeclaration.typability = 'Typed'
  }

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
    VariableDeclaration: inferConstantDeclaration // Source 1 only has constant declaration
    // BinaryExpression: inferBinaryExpression
    // FunctionDeclaration: inferFunctionDeclaration
  })

  // return the AST with annotated types
  return program
}
