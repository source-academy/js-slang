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
import { booleanType, isOverLoaded, primitiveMap, updateTypeEnvironment } from './typeEnvironment'
import { updateTypeConstraints, constraintStore } from './constraintStore'
import * as es from 'estree'
import {
  printType,
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
    const idenTypeEnvType = primitiveMap.get(identifier.name).types[0] // Type obj

    if (idenTypeVariable !== undefined && idenTypeEnvType !== undefined) {
      const result = updateTypeConstraints(idenTypeVariable, idenTypeEnvType)
      if (result !== undefined) {
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
      if (result !== undefined) {
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

  function inferUnaryExpression(unaryExpression: TypeAnnotatedNode<es.UnaryExpression>) {
    // get data about unary expression from type environment
    const operator = unaryExpression.operator
    // retrieves function type of unary '-'
    const typeOfOperator = isOverLoaded(operator)
      ? primitiveMap.get(operator).types[1]
      : primitiveMap.get(operator).types[0]
    const operatorArgType = typeOfOperator.parameterTypes[0]
    const operatorResultType = typeOfOperator.returnType

    // get data about arguments
    const argument = unaryExpression.argument as TypeAnnotatedNode<es.UnaryExpression>
    const argumentTypeVariable = argument.typeVariable as Variable
    const resultTypeVariable = unaryExpression.typeVariable as Variable

    if (operatorArgType !== undefined && argumentTypeVariable !== undefined) {
      const result = updateTypeConstraints(argumentTypeVariable, operatorArgType)
      if (result !== undefined) {
        displayErrorAndTerminate(
          `Expecting type \`${printType(operatorArgType)}\` but got \`${printType(
            argumentTypeVariable
          )} + \` instead`,
          unaryExpression.loc
        )
      }
    }

    if (operatorResultType !== undefined && resultTypeVariable !== undefined) {
      const result = updateTypeConstraints(resultTypeVariable, operatorResultType)
      if (result !== undefined) {
        displayErrorAndTerminate(
          `Expecting type \`${printType(operatorResultType)}\` but got \`${printType(
            resultTypeVariable
          )} + \` instead`,
          unaryExpression.loc
        )
      }
    }
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
            `Expecting type \`${param1Type.name}\` but got \`${result.constraintRhs.name}\` instead`,
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
            `Expecting type \`${param2Type.name}\` but got \`${result.constraintRhs.name}\` instead`,
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
            `Expecting type \` ${returnType.name}\` but got \`${result.constraintRhs.name}\` instead`,
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
    const expressionTypeVariable = conditionalExpression.typeVariable as Variable
    const test = conditionalExpression.test as TypeAnnotatedNode<es.Expression>
    const consequent = conditionalExpression.consequent as TypeAnnotatedNode<es.Expression>
    const alternate = conditionalExpression.alternate as TypeAnnotatedNode<es.Expression>

    // check that the type of the test expression is boolean
    // const testTypeVariable = (test.typeVariable as Variable).id
    const testTypeVariable = test.typeVariable as Variable
    if (testTypeVariable !== undefined) {
      const result = updateTypeConstraints(testTypeVariable, booleanType)
      if (result !== undefined) {
        displayErrorAndTerminate(
          `Expecting type of test expression to be a \`boolean\` but got \` ${printType(
            testTypeVariable
          )}\` instead`,
          test.loc
        )
      }
    }

    // check that the types of the test expressions are the same
    const consequentTypeVariable = consequent.typeVariable as Variable
    const alternateTypeVariable = alternate.typeVariable as Variable
    if (consequentTypeVariable !== undefined && alternateTypeVariable !== undefined) {
      const result = updateTypeConstraints(consequentTypeVariable, alternateTypeVariable)
      if (result !== undefined) {
        displayErrorAndTerminate(
          `Expecting consequent type \`${printType(
            consequentTypeVariable
          )}\` and alternate type \`${printType(
            alternateTypeVariable
          )}\` to be the same, but got different`,
          consequent.loc
        )
      } else {
        updateTypeConstraints(expressionTypeVariable, consequentTypeVariable)
      }
    }
  }

  function inferReturnStatement(returnStatement: TypeAnnotatedNode<es.ReturnStatement>) {
    // Update type constraints in constraintStore
    // e.g. Given: (return (...)^T1)^T2, Set: T2 = T1
    const arg = returnStatement.argument as TypeAnnotatedNode<es.Node>
    const argTypeVariable = arg.typeVariable as Variable

    const returnypeVariable = returnStatement.typeVariable as Variable

    if (returnypeVariable !== undefined && argTypeVariable !== undefined) {
      const result = updateTypeConstraints(returnypeVariable, argTypeVariable)
      if (result !== undefined) {
        // type error
        displayErrorAndTerminate(
          'WARNING: There should not be a type error here in `inferReturnStatement()` - pls debug',
          returnStatement.loc
        )
      }
    }
  }

  function inferFunctionDeclaration(
    functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration>
  ) {
    // Update type constraints in constraintStore
    // e.g. Given: f^T5 (x^T1) { (return (...))^T2 ... (return (...))^T3 }^T4

    // First, try to add constraints that ensure all ReturnStatements give same type
    // e.g. T2 = T3
    const bodyNodes = functionDeclaration.body.body
    let prevReturnTypeVariable
    for (const node of bodyNodes) {
      if (node.type === 'ReturnStatement') {
        const currReturnTypeVariable = (node as TypeAnnotatedNode<es.ReturnStatement>)
          .typeVariable as Variable
        if (prevReturnTypeVariable !== undefined && currReturnTypeVariable !== undefined) {
          const result = updateTypeConstraints(prevReturnTypeVariable, currReturnTypeVariable)
          if (result === -1) {
            displayErrorAndTerminate(
              'Expecting all return statements to have same type, but encountered a different type',
              node.loc
            )
          }
        }
        prevReturnTypeVariable = currReturnTypeVariable
      }
    }

    // If the above step executes successfully w/o any Type Error,
    // Next, add constraint to give the FunctionDeclaration a result type corresponding to the ReturnStatement
    // e.g. T4 = T3
    const block = functionDeclaration.body as TypeAnnotatedNode<es.BlockStatement>
    const blockTypeVariable = block.typeVariable as Variable

    if (blockTypeVariable !== undefined && prevReturnTypeVariable !== undefined) {
      const result = updateTypeConstraints(blockTypeVariable, prevReturnTypeVariable)
      if (result !== undefined) {
        displayErrorAndTerminate(
          'WARNING: There should not be a type error here in `inferFunctionDeclaration()` Part B - pls debug',
          functionDeclaration.loc
        )
      }
    }

    // Finally, add constraint to give the function identifier the corresponding function type
    // e.g. T5 = [T1] => T4
    const iden = functionDeclaration.id as TypeAnnotatedNode<es.Identifier>
    const idenTypeVariable = iden.typeVariable as Variable

    const functionType = primitiveMap.get(iden.name) // Get function type from Type Env since it was added there

    if (idenTypeVariable !== undefined && functionType !== undefined) {
      const result = updateTypeConstraints(idenTypeVariable, functionType)
      if (result !== undefined) {
        displayErrorAndTerminate(
          'WARNING: There should not be a type error here in `inferFunctionDeclaration()` Part C - pls debug',
          functionDeclaration.loc
        )
      }
    }
  }

  function inferFunctionApplication(functionApplication: TypeAnnotatedNode<es.CallExpression>) {
    // Update type constraints in constraintStore
    // e.g. Given: f^T5 (x^T1) { (return (...))^T2 ... (return (...))^T3 }^T4
    //             f^T7 (1^T6)

    // First, ensure arg nodes have same count as Γ(f)
    // And try to add constraints that ensure arg nodes have same corresponding types
    // e.g. T6 = T1
    const iden = functionApplication.callee as TypeAnnotatedNode<es.Identifier>
    const applicationArgs = functionApplication.arguments as TypeAnnotatedNode<es.Node>[]
    const applicationArgCount = applicationArgs.length

    const declarationFunctionType = primitiveMap.get(iden.name).types[0]
    const declarationArgCount = declarationFunctionType.parameterTypes.length

    if (applicationArgCount !== declarationArgCount) {
      // check arg count
      displayErrorAndTerminate(
        `Expecting \`${declarationArgCount}\` arguments but got \`${applicationArgCount}\` instead`,
        functionApplication.loc
      )
    }

    for (let i = 0; i < applicationArgs.length; i++) {
      // add type constraint for each arg
      const applicationArgTypeVariable = applicationArgs[i].typeVariable as Variable
      const declarationArgTypeVariable = declarationFunctionType.parameterTypes[i]
        .typeVariable as Variable

      if (applicationArgTypeVariable && declarationArgTypeVariable) {
        const result = updateTypeConstraints(applicationArgTypeVariable, declarationArgTypeVariable)
        if (result === -1) {
          displayErrorAndTerminate(
            'Expecting all arguments to have correct type as per function declaration, but encountered a wrong type',
            applicationArgs[i].loc
          )
        }
      }
    }

    // If the above step executes successfully w/o any Type Error,
    // Next, add constraint to give the functionApplication a type corresponding to returnType of functionDeclaration
    // e.g. T7 = T4
    const applicationTypeVariable = functionApplication.typeVariable as Variable
    const resultTypeVariable = declarationFunctionType.returnType

    if (applicationTypeVariable && resultTypeVariable) {
      const errorObj = updateTypeConstraints(applicationTypeVariable, resultTypeVariable)
      if (errorObj) {
        displayErrorAndTerminate(
          'WARNING: There should not be a type error here in `inferFunctionApplication()` - pls debug',
          functionApplication.loc
        )
      }
    }
  }

  function addTypeConstraintForLiteralPrimitive(literal: TypeAnnotatedNode<es.Literal>) {
    // Update type constraints in constraintStore
    // e.g. Given: 1^T2, Set: T2 = number
    // const lhsVariableId = (literal.typeVariable as Variable).id
    const literalTypeVariable = literal.typeVariable as Variable
    // const rhsType = (literal.inferredType as Primitive).name
    const literalType = literal.inferredType as Primitive

    if (literalTypeVariable !== undefined && literalType !== undefined) {
      const result = updateTypeConstraints(literalTypeVariable, literalType)
      if (result !== undefined) {
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
    if (loc) console.log(`${errorMsg} (line: ${loc.start.line}, char: ${loc.start.column})`)
    else console.log(errorMsg)

    console.log('\nTerminating program..')
    return process.exit(0)
  }

  function logObjectsForDebugging() {
    // for Debugging output
    console.log('\n--------------')
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
    UnaryExpression: inferUnaryExpression,
    BinaryExpression: inferBinaryExpression,
    ConditionalExpression: inferConditionalExpressions,
    ReturnStatement: inferReturnStatement,
    FunctionDeclaration: inferFunctionDeclaration,
    CallExpression: inferFunctionApplication
  })

  // Successful run..
  logObjectsForDebugging()
  // return the AST with annotated types
  return program
}
