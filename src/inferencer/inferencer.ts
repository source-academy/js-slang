import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode, Primitive, Variable } from '../types'
import { annotateProgram } from './annotator'
import { primitiveMap, updateTypeEnvironment } from './typeEnvironment'
import { constraintStore, updateTypeConstraints } from './constraintStore'
import * as es from 'estree'
import { printTypeConstraints, printTypeEnvironment } from '../utils/inferencerUtils'

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

      // e.g. Given: 1^T2, Set: T2 = number
      addTypeConstraintForLiteralPrimitive(literal)

    } else if (typeof valueOfLiteral === 'boolean') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'boolean'
      }
      literal.typability = 'Typed'

      // e.g. Given: true^T2, Set: T2 = boolean
      addTypeConstraintForLiteralPrimitive(literal)

    } else if (typeof valueOfLiteral === 'string') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'string'
      }
      literal.typability = 'Typed'

      // e.g. Given: 'hi'^T2, Set: T2 = string
      addTypeConstraintForLiteralPrimitive(literal)

    } else if (typeof valueOfLiteral === 'undefined') {
      // declare
      literal.inferredType = {
        kind: 'primitive',
        name: 'undefined'
      }
      literal.typability = 'Typed'

      addTypeConstraintForLiteralPrimitive(literal) // todo: undefined gives an object in type environment, handle properly

    }
  }

  function inferIdentifier(identifier: TypeAnnotatedNode<es.Identifier>) {
    // Update type constraints in constraintStore
    // e.g. Given: x^T2, Set: T2 = Γ[x]
    const lhsVariableId = (identifier.typeVariable as Variable).id
    const lhsName = identifier.name
    const rhsTypeEnvValue = primitiveMap.get(lhsName)
    if (lhsVariableId !== undefined && rhsTypeEnvValue !== undefined) {
      updateTypeConstraints(lhsVariableId, rhsTypeEnvValue)
    }

    // declare 
    // - not necessary since it itself is 'not a type'? e.g. 'x;' -> there's no type to x? - TBC
    // identifier.inferredType = {
    //   kind: '??',
    //   type: '??'
    // }
    // literal.typability = 'Typed'
  }

  function inferConstantDeclaration(
    constantDeclaration: TypeAnnotatedNode<es.VariableDeclaration>
  ) {
    // Update type constraints in constraintStore
    // e.g. Given: const x^T1 = 1^T2, Set: T1 = T2
    const lhs = constantDeclaration.declarations[0].id as TypeAnnotatedNode<es.Identifier>
    const lhsVariableId = (lhs.typeVariable as Variable).id

    const rhs = constantDeclaration.declarations[0].init as TypeAnnotatedNode<es.Node> // use es.Node because rhs could be any value/expression
    const rhsVariableId = (rhs.typeVariable as Variable).id

    if (lhsVariableId !== undefined && rhsVariableId !== undefined) {
      updateTypeConstraints(lhsVariableId, rhsVariableId)
    }

    // if manage to pass step 3, means no type error

    // declare 
    // - not necessary since no one is dependent on constantDeclaration's inferredType?? - TBC
    // - plus not sure what to put in 'kind' and 'name' also
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

  function addTypeConstraintForLiteralPrimitive(literal: TypeAnnotatedNode<es.Literal>) {
    // Update type constraints in constraintStore
    // e.g. Given: 1^T2, Set: T2 = number
    const lhsVariableId = (literal.typeVariable as Variable).id
    const rhsType = (literal.inferredType as Primitive).name
    
    if (lhsVariableId !== undefined && rhsType !== undefined) {
      updateTypeConstraints(lhsVariableId, rhsType)
    }
  }

  /////////////////////////////////
  // Main flow
  /////////////////////////////////

  // Step 1. Annotate program
  program = annotateProgram(program)

  // Step 2. Update type environment
  updateTypeEnvironment(program)

  // Step 3. Update and solve type constraints
  ancestor(program as es.Node, {
    Literal: inferLiteral,
    Identifier: inferIdentifier,
    VariableDeclaration: inferConstantDeclaration // Source 1 only has constant declaration
    // BinaryExpression: inferBinaryExpression
    // FunctionDeclaration: inferFunctionDeclaration
  })

  // for Debugging output
  printTypeConstraints(constraintStore)
  printTypeEnvironment(primitiveMap)
  // return the AST with annotated types
  return program
}
