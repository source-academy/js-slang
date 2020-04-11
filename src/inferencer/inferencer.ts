import { ancestor } from 'acorn-walk/dist/walk'
import {
  TypeAnnotatedNode,
  Type,
  Primitive,
  Variable,
  FunctionType,
  isTypeVariable,
  isFunctionType
} from '../types'
import { annotateProgram, fresh } from './annotator'
import { primitiveMap, updateTypeEnvironment } from './typeEnvironment'
import { updateTypeConstraints, constraintStore } from './constraintStore'
import * as es from 'estree'
import {
  printTypeAnnotation,
  printTypeConstraints,
  printTypeEnvironment
} from '../utils/inferencerUtils'

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
    const idenTypeVariable = identifier.typeVariable as Variable

    const idenName = identifier.name
    const idenTypeEnvType = primitiveMap.get(idenName).types[0] // Type obj

    if (idenTypeVariable !== undefined && idenTypeEnvType !== undefined) {
      const result = updateTypeConstraints(idenTypeVariable, idenTypeEnvType)
      if (result === -1) {
        displayErrorAndTerminate(
          'WARNING: There should not be a type error here in `inferIdentifier()` - pls debug',
          identifier.loc
        )
      }
    }

    // declare - Todo: do I need to declare? TBC
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
    const iden = constantDeclaration.declarations[0].id as TypeAnnotatedNode<es.Identifier>
    const idenTypeVariable = iden.typeVariable as Variable

    const value = constantDeclaration.declarations[0].init as TypeAnnotatedNode<es.Node> // use es.Node because rhs could be any value/expression
    const valueTypeVariable = value.typeVariable as Variable

    if (idenTypeVariable !== undefined && valueTypeVariable !== undefined) {
      const result = updateTypeConstraints(idenTypeVariable, valueTypeVariable)
      if (result === -1) {
        displayErrorAndTerminate(
          'WARNING: There should not be a type error here in `inferConstantDeclaration()` - pls debug',
          constantDeclaration.loc
        )
      }
    }

    // if manage to pass step 3, means no type error

    // declare - Todo: do I need to declare? TBC
    // - not necessary since no one is dependent on constantDeclaration's inferredType?? - TBC
    // - plus not sure what to put in 'kind' and 'name' also
    // constantDeclaration.inferredType = {
    //   kind: 'variable',
    //   name: variableType
    // }
    // constantDeclaration.typability = 'Typed'
  }

  function inferBinaryExpression(binaryExpression: TypeAnnotatedNode<es.BinaryExpression>) {
    // Given operator, get arg and result types of binary expression from type env
    const primitiveMapTypes = primitiveMap.get(binaryExpression.operator).types
    let functionType

    // Only take the one for BinaryExpression where num params = 2 (e.g. in the case of overloaded '-')
    for (const type of primitiveMapTypes) {
      if (type.parameterTypes && type.parameterTypes.length === 2) {
        functionType = type
      }
    }

    // Additional logic for polymorphic case
    // E.g. `A1, A1 -> A1`
    // Becomes `A10, A10 -> A10` after generating fresh type variables
    if (functionType.isPolymorphic) {
      const tmpMap = new Map() // tracks old TVariable, new TVariable
      replaceTypeVariablesWithFreshTypeVariables(functionType, tmpMap)
    }

    const param1Type = functionType.parameterTypes[0]
    const param2Type = functionType.parameterTypes[1]
    const returnType = functionType.returnType

    // Update type constraints in constraintStore
    // e.g. Given: (x^T1 * 1^T2)^T3, Set: T1 = number, T2 = number, T3 = number
    const param1 = binaryExpression.left as TypeAnnotatedNode<es.Node> // can be identifier or literal or something else?
    const param1TypeVariable = param1.typeVariable as Variable

    const param2 = binaryExpression.right as TypeAnnotatedNode<es.Node> // can be identifier or literal or something else?
    const param2TypeVariable = param2.typeVariable as Variable

    const resultTypeVariable = binaryExpression.typeVariable as Variable

    if (param1TypeVariable !== undefined && param1Type !== undefined) {
      const result = updateTypeConstraints(param1TypeVariable, param1Type)
      if (result !== undefined && result.constraintRhs) {
        if (!functionType.isPolymorphic)
          displayErrorAndTerminate(
            'Expecting type `' +
              param1Type.name +
              '` but got `' +
              result.constraintRhs.name +
              '` instead',
            param1.loc
          )
        else displayErrorAndTerminate('Polymorphic type error, error msg TBC', param1.loc)
      }
    }

    if (param2TypeVariable !== undefined && param2Type !== undefined) {
      const result = updateTypeConstraints(param2TypeVariable, param2Type)
      if (result !== undefined && result.constraintRhs) {
        if (!functionType.isPolymorphic)
          displayErrorAndTerminate(
            'Expecting type `' +
              param2Type.name +
              '` but got `' +
              result.constraintRhs.name +
              '` instead',
            param2.loc
          )
        else displayErrorAndTerminate('Polymorphic type error, error msg TBC', param2.loc)
      }
    }

    if (resultTypeVariable !== undefined && returnType !== undefined) {
      const result = updateTypeConstraints(resultTypeVariable, returnType)
      if (result !== undefined && result.constraintRhs) {
        if (!functionType.isPolymorphic)
          displayErrorAndTerminate(
            'Expecting type `' +
              returnType.name +
              '` but got `' +
              result.constraintRhs.name +
              '` instead',
            binaryExpression.loc
          )
        else displayErrorAndTerminate('Polymorphic type error, error msg TBC', binaryExpression.loc)
      }
    }

    // declare - Todo: do I need to declare? TBC
    // binaryExpression.inferredType = {
    //   kind : 'primitive',
    //   name: resultType
    // }
    // binaryExpression.typability = 'Typed'
  }

  function inferConditionalExpressions(
    conditionalExpression: TypeAnnotatedNode<es.ConditionalExpression>
  ) {
    const test = conditionalExpression.test as TypeAnnotatedNode<es.Expression>
    const consequent = conditionalExpression.consequent as TypeAnnotatedNode<es.Expression>
    const alternate = conditionalExpression.alternate as TypeAnnotatedNode<es.Expression>

    // check that the type of the test expression is boolean
    // const testTypeVariable = (test.typeVariable as Variable).id
    const testTypeVariable = test.typeVariable as Variable
    if (testTypeVariable !== undefined) {
      const result = updateTypeConstraints(testTypeVariable, {
        kind: 'primitive',
        name: 'boolean'
      })
      if (result === -1) {
        displayErrorAndTerminate(
          'Expecting type `boolean` but got `' + testTypeVariable.kind + '` instead',
          test.loc
        )
      }
    }

    // check that the types of the test expressions are the same
    // const consequentTypeVariable = (consequent.typeVariable as Variable).id
    // const alternateTypeVariable = (alternate.typeVariable as Variable).id
    const consequentTypeVariable = consequent.typeVariable as Variable
    const alternateTypeVariable = alternate.typeVariable as Variable

    if (consequentTypeVariable !== undefined && alternateTypeVariable !== undefined) {
      const result = updateTypeConstraints(consequentTypeVariable, alternateTypeVariable)
      if (result === -1) {
        displayErrorAndTerminate(
          'Expecting type `' +
            consequentTypeVariable.kind +
            '` and `' +
            alternateTypeVariable.kind +
            '` to be the same, but got different',
          consequent.loc
        )
      }
    }
  }

  // function inferFunctionDeclaration(functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration>) {
  //   // get parameterTypes
  //   var parameterTypes = [];
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
  //     parameterTypes : parameterTypes,
  //     resultType :  resultType
  //   }
  //   functionDeclaration.typability = 'Typed'
  // }

  function addTypeConstraintForLiteralPrimitive(literal: TypeAnnotatedNode<es.Literal>) {
    // Update type constraints in constraintStore
    // e.g. Given: 1^T2, Set: T2 = number
    // const lhsVariableId = (literal.typeVariable as Variable).id
    const literalTypeVariable = literal.typeVariable as Variable
    // const rhsType = (literal.inferredType as Primitive).name
    const literalType = literal.inferredType as Primitive

    if (literalTypeVariable !== undefined && literalType !== undefined) {
      const result = updateTypeConstraints(literalTypeVariable, literalType)
      if (result === -1) {
        displayErrorAndTerminate(
          'WARNING: There should not be a type error here in `addTypeConstraintForLiteralPrimitive()` - pls debug',
          literal.loc
        )
      }
    }
  }

  function replaceTypeVariablesWithFreshTypeVariables(parent: Type, tmpMap: Map<Type, Type>) {
    if (isFunctionType(parent)) {
      // Process each paramType iteratively
      const p = parent as FunctionType
      for (let i = 0; i < p.parameterTypes.length; i++) {
        if (isTypeVariable(p.parameterTypes[i])) {
          let freshTypeVariable
          if (tmpMap.get(p.parameterTypes[i]) === undefined) {
            freshTypeVariable = fresh(p.parameterTypes[i] as Variable)
            tmpMap.set(p.parameterTypes[i], freshTypeVariable) // track mapping for repeated use
          } else {
            freshTypeVariable = tmpMap.get(p.parameterTypes[i])
          }
          if (freshTypeVariable) p.parameterTypes[i] = freshTypeVariable
        }
      }

      // Process returnType
      if (isTypeVariable(p.returnType)) {
        let freshTypeVariable
        if (tmpMap.get(p.returnType) === undefined) {
          freshTypeVariable = fresh(p.returnType as Variable)
          tmpMap.set(p.returnType, freshTypeVariable) // track mapping for repeated use
        } else {
          freshTypeVariable = tmpMap.get(p.returnType)
        }
        if (freshTypeVariable) p.returnType = freshTypeVariable
      }
    }
  }

  function displayErrorAndTerminate(errorMsg: string, loc: es.SourceLocation | null | undefined) {
    logObjectsForDebugging()
    console.log('!!! Type check error !!!')

    // Print error msg with optional location (if exists)
    if (loc)
      console.log(errorMsg + ' (line: ' + loc.start.line + ', char: ' + loc.start.column + ')')
    else console.log(errorMsg)

    console.log('\nTerminating program..')
    return process.exit(0)
  }

  function logObjectsForDebugging() {
    // for Debugging output
    console.log('-----------')
    printTypeAnnotation(program)
    printTypeEnvironment(primitiveMap)
    printTypeConstraints(constraintStore)
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
    ConditionalExpression: inferConditionalExpressions
    // FunctionDeclaration: inferFunctionDeclaration
  })

  // Successful run..
  logObjectsForDebugging()
  // return the AST with annotated types
  return program
}
