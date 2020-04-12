import { ancestor } from 'acorn-walk/dist/walk'
import { TypeAnnotatedNode, Primitive, Variable } from '../types'
import { annotateProgram } from './annotator'
import { primitiveMap, updateTypeEnvironment, isOverLoaded } from './typeEnvironment'
import { constraintStore, updateTypeConstraints } from './constraintStore'
import * as es from 'estree'
import { printTypeAnnotation, printTypeEnvironment } from '../utils/inferencerUtils'

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
    console.log('-- Processing: ' + lhsName + '^' + lhsVariableId)
    const rhsTypeEnvValue = primitiveMap.get(lhsName)
    if (lhsVariableId !== undefined && rhsTypeEnvValue !== undefined) {
      console.log('-- Adding constraint: ' + lhsVariableId + ' = ' + rhsTypeEnvValue)
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

  function inferUnaryExpression(unaryExpression: TypeAnnotatedNode<es.UnaryExpression>) {
    // get data about unary expression from type environment
    const operator = unaryExpression.operator
    // retrieves function type of unary '-'
    const typeOfOperator = isOverLoaded(operator)
      ? primitiveMap.get(operator).types[1]
      : primitiveMap.get(operator).types[0]
    const operatorArgType = typeOfOperator.argumentTypes[0]
    const operatorResultType = typeOfOperator.resultType

    // get data about arguments
    const argument = unaryExpression.argument as TypeAnnotatedNode<es.UnaryExpression>
    const argumentTypeVariable = (argument.typeVariable as Variable).id
    const resultTypeVariable = (unaryExpression.typeVariable as Variable).id

    if (operatorArgType !== undefined && argumentTypeVariable !== undefined) {
      updateTypeConstraints(argumentTypeVariable, operatorArgType)
    }

    if (operatorResultType !== undefined && resultTypeVariable !== undefined) {
      updateTypeConstraints(resultTypeVariable, operatorResultType)
    }
  }

  function inferBinaryExpression(binaryExpression: TypeAnnotatedNode<es.BinaryExpression>) {
    // Given operator, get arg and result types of binary expression from type env
    const operator = binaryExpression.operator
    // retrieves function type of binary '-'
    const typeEnvObj = isOverLoaded(operator)
      ? primitiveMap.get(operator).types[1]
      : primitiveMap.get(operator).types[0]
    const argType1 = typeEnvObj.argumentTypes[0]
    const argType2 = typeEnvObj.argumentTypes[2]
    const resultType = typeEnvObj.resultType

    // Todo
    // Note special cases: + (and -?) and others?

    // Update type constraints in constraintStore
    // e.g. Given: (x^T1 * 1^T2)^T3, Set: T1 = number, T2 = number, T3 = number
    const arg1 = binaryExpression.left as TypeAnnotatedNode<es.Node> // can be identifier or literal or something else?
    const arg1VariableId = (arg1.typeVariable as Variable).id
    const arg2 = binaryExpression.right as TypeAnnotatedNode<es.Node> // can be identifier or literal or something else?
    const arg2VariableId = (arg2.typeVariable as Variable).id
    const resultVariableId = (binaryExpression.typeVariable as Variable).id

    if (arg1VariableId !== undefined && argType1 !== undefined) {
      updateTypeConstraints(arg1VariableId, argType1)
    }

    if (arg2VariableId !== undefined && argType2 !== undefined) {
      updateTypeConstraints(arg2VariableId, argType2)
    }

    if (resultVariableId !== undefined && resultType !== undefined) {
      updateTypeConstraints(resultVariableId, resultType)
    }

    // declare
    // binaryExpression.inferredType = {
    //   kind : 'primitive',
    //   name: resultType
    // }
    // binaryExpression.typability = 'Typed'
  }

  function inferConditionalExpressions(conditionalExpression: TypeAnnotatedNode<es.ConditionalExpression>) {
    const test = conditionalExpression.test as TypeAnnotatedNode<es.Expression>
    const consequent = conditionalExpression.consequent as TypeAnnotatedNode<es.Expression>
    const alternate = conditionalExpression.alternate as TypeAnnotatedNode<es.Expression>

    // check that the type of the test expression is boolean
    const testTypeVariable = (test.typeVariable as Variable).id
    if (testTypeVariable !== undefined) {
      updateTypeConstraints(testTypeVariable, {
        kind: "primitive",
        name: "boolean",
      })
    }

    // check that the types of the test expressions are the same
    const consequentTypeVariable = (consequent.typeVariable as Variable).id
    const alternateTypeVariable = (alternate.typeVariable as Variable).id

    if (consequentTypeVariable !== undefined && alternateTypeVariable !== undefined) {
      updateTypeConstraints(consequentTypeVariable, alternateTypeVariable)
    }
  }

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
    VariableDeclaration: inferConstantDeclaration, // Source 1 only has constant declaration
    BinaryExpression: inferBinaryExpression,
    ConditionalExpression: inferConditionalExpressions,
    UnaryExpression: inferUnaryExpression,
    // FunctionDeclaration: inferFunctionDeclaration
  })

  // for Debugging output
  printTypeAnnotation(program)
  // printTypeConstraints(constraintStore)
  printTypeEnvironment(primitiveMap)
  // return the AST with annotated types
  return program
}
