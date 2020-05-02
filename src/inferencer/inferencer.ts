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
import {
  numberType,
  booleanType,
  isOverLoaded,
  updateTypeEnvironment,
  stringType,
  extendEnvironment,
  globalTypeEnvironment,
  popEnvironment,
  undefinedType,
  emptyMap,
  generateFunctionType,
  generateAndCopyFunctionType
} from './typeEnvironment'
import { updateTypeConstraints, constraintStore } from './constraintStore'
import * as es from 'estree'
import {
  printTypeAnnotation,
  printTypeConstraints,
  printTypeEnvironment
} from '../utils/inferencerUtils'
import {
  WrongArgumentTypeError,
  ConditionalTestTypeError,
  ConditionalTypeError,
  // DifferentReturnTypeError,
  WrongNumberArgumentsError,
  GeneralTypeError,
  IdentifierNotFoundError
} from './typeErrors'

let annotatedProgram: es.Program
export let currentTypeEnvironment: Map<any, any> = globalTypeEnvironment

function inferLiteral(literal: TypeAnnotatedNode<es.Literal>) {
  const valueOfLiteral = literal.value
  if (typeof valueOfLiteral === 'number') {
    literal.inferredType = numberType
  } else if (typeof valueOfLiteral === 'boolean') {
    literal.inferredType = booleanType
  } else if (typeof valueOfLiteral === 'string') {
    literal.inferredType = stringType
  } else {
    literal.typability = 'Untypable'
    return
  }
  literal.typability = 'Typed'
  // e.g. Given: 1^T2, Set: T2 = number
  // e.g. Given: true^T2, Set: T2 = boolean
  // e.g. Given: 'hi'^T2, Set: T2 = string
  addTypeConstraintForLiteralPrimitive(literal)
}

function inferIdentifier(identifier: TypeAnnotatedNode<es.Identifier>) {
  // First, ensure that Identifier exists in type env
  if (!currentTypeEnvironment.get(identifier.name)) {
    throw new IdentifierNotFoundError(identifier.name, identifier.loc!)
  }

  // Update type constraints in constraintStore
  // e.g. Given: x^T2, Set: T2 = Γ[x]
  const idenTypeVariable = identifier.typeVariable as Variable
  const idenTypeEnvType = currentTypeEnvironment.get(identifier.name).types[0]

  if (idenTypeVariable !== undefined && idenTypeEnvType !== undefined) {
    const result = updateTypeConstraints(idenTypeVariable, idenTypeEnvType)
    if (result !== undefined) {
      throw new GeneralTypeError(
        idenTypeVariable,
        idenTypeEnvType,
        'Failed in assigning the identifying the type of the identifier',
        identifier.loc!
      )
    }
  }
}

function inferConstantDeclaration(constantDeclaration: TypeAnnotatedNode<es.VariableDeclaration>) {
  // Update type constraints in constraintStore
  // e.g. Given: const x^T1 = 1^T2, Set: T1 = T2
  const iden = constantDeclaration.declarations[0].id as TypeAnnotatedNode<es.Identifier>
  const idenTypeVariable = iden.typeVariable as Variable

  const value = constantDeclaration.declarations[0].init as TypeAnnotatedNode<es.Node> // use es.Node because rhs could be any value/expression
  const valueTypeVariable = value.typeVariable as Variable

  if (idenTypeVariable !== undefined && valueTypeVariable !== undefined) {
    const result = updateTypeConstraints(idenTypeVariable, valueTypeVariable)
    if (result !== undefined) {
      throw new GeneralTypeError(
        idenTypeVariable,
        valueTypeVariable,
        'Failed in assigning the type of the identifier to the type of its assigned expression',
        constantDeclaration.loc!
      )
    }
  }
}

function inferUnaryExpression(unaryExpression: TypeAnnotatedNode<es.UnaryExpression>) {
  // get data about unary expression from type environment
  const operator = unaryExpression.operator
  // retrieves function type of unary '-'
  const typeOfOperator = isOverLoaded(operator)
    ? currentTypeEnvironment.get(operator).types[1]
    : currentTypeEnvironment.get(operator).types[0]
  const operatorArgType = typeOfOperator.parameterTypes[0]
  const operatorResultType = typeOfOperator.returnType

  // get data about arguments
  const argument = unaryExpression.argument as TypeAnnotatedNode<es.UnaryExpression>
  const argumentTypeVariable = argument.typeVariable as Variable
  const resultTypeVariable = unaryExpression.typeVariable as Variable

  const argumentResult = updateTypeConstraints(argumentTypeVariable, operatorArgType)
  if (argumentResult !== undefined) {
    throw new WrongArgumentTypeError(
      operatorArgType,
      constraintStore.get(argumentTypeVariable),
      1,
      unaryExpression.loc!
    )
  }

  if (operatorResultType !== undefined && resultTypeVariable !== undefined) {
    const result = updateTypeConstraints(resultTypeVariable, operatorResultType)
    if (result !== undefined) {
      throw new GeneralTypeError(
        operatorResultType,
        resultTypeVariable,
        'Unifying result type of operator with actual result type',
        unaryExpression.loc!
      )
    }
  }
}

function inferBinaryExpression(
  binaryExpression: TypeAnnotatedNode<es.BinaryExpression> | TypeAnnotatedNode<es.LogicalExpression>
) {
  // Given operator, get arg and result types of binary expression from type env
  const currentTypeEnvironmentTypes = currentTypeEnvironment.get(binaryExpression.operator).types
  let functionType

  // Only take the one for BinaryExpression where num params = 2 (e.g. in the case of overloaded '-')
  for (const type of currentTypeEnvironmentTypes) {
    if (type.parameterTypes && type.parameterTypes.length === 2) {
      functionType = type
    }
  }

  // Additional logic for polymorphic case
  // E.g. `A1, A1 -> A1`
  // Becomes `A10, A10 -> A10` after generating fresh type variables
  if (functionType && isFunctionType(functionType) && functionType.isPolymorphic) {
    functionType = generateFunctionTypeWithFreshTypeVariables(functionType)
  }

  const param1Type = functionType.parameterTypes[0]
  const param2Type = functionType.parameterTypes[1]
  const returnType = functionType.returnType

  // Update type constraints in constraintStore
  // e.g. Given: (x^T1 * 1^T2)^T3, Set: T1 = number, T2 = number, T3 = number
  const param1 = binaryExpression.left as TypeAnnotatedNode<es.Node>
  const param1TypeVariable = param1.typeVariable as Variable

  const param2 = binaryExpression.right as TypeAnnotatedNode<es.Node>
  const param2TypeVariable = param2.typeVariable as Variable

  const resultTypeVariable = binaryExpression.typeVariable as Variable

  const errorObj1 = updateTypeConstraints(param1TypeVariable, param1Type)
  if (errorObj1) {
    let expectedType = errorObj1.constraintLhs // set default
    let receivedType = errorObj1.constraintRhs // set default

    // Try to use inferredType to ensure we print the correct error msg
    // Especially since constraint lhs/rhs order does not always coincide with expected/received type order
    if (param1.inferredType) {
      receivedType = param1.inferredType
      if (receivedType && receivedType.name && receivedType.name !== errorObj1.constraintRhs.name) {
        expectedType = errorObj1.constraintRhs
      }
    }

    throw new WrongArgumentTypeError(
      expectedType,
      receivedType,
      1,
      param1.loc!
    )
  }

  const errorObj2 = updateTypeConstraints(param2TypeVariable, param2Type)
  if (errorObj2) {
    let expectedType = errorObj2.constraintLhs // set default
    let receivedType = errorObj2.constraintRhs // set default

    // Try to use inferredType to ensure we print the correct error msg
    // Especially since constraint lhs/rhs order does not always coincide with expected/received type order
    if (param2.inferredType) {
      receivedType = param2.inferredType
      if (receivedType && receivedType.name && receivedType.name !== errorObj2.constraintRhs.name) {
        expectedType = errorObj2.constraintRhs
      }
    }

    throw new WrongArgumentTypeError(
      expectedType,
      receivedType,
      2,
      param2.loc!
    )
  }

  if (resultTypeVariable !== undefined && returnType !== undefined) {
    const result = updateTypeConstraints(resultTypeVariable, returnType)
    if (result !== undefined && result.constraintRhs) {
      throw new GeneralTypeError(
        returnType,
        result.constraintRhs,
        'Assign return type of binary operator to actual return type solved',
        binaryExpression.loc!
      )
    }
  }
}

function inferConditionals(
  conditionalExpression: TypeAnnotatedNode<es.ConditionalExpression | es.IfStatement>
) {
  const expressionTypeVariable = conditionalExpression.typeVariable as Variable
  const test = conditionalExpression.test as TypeAnnotatedNode<es.Expression>
  const consequent = conditionalExpression.consequent as TypeAnnotatedNode<es.Expression>
  const alternate = conditionalExpression.alternate as TypeAnnotatedNode<es.Expression>

  // check that the type of the test expression is boolean
  const testTypeVariable = test.typeVariable as Variable
  const resultOfTypeChecking = updateTypeConstraints(testTypeVariable, booleanType)
  if (resultOfTypeChecking !== undefined) {
    throw new ConditionalTestTypeError(resultOfTypeChecking.constraintRhs, test.loc!)
  }

  // check that the types of the test expressions are the same
  const consequentTypeVariable = consequent.typeVariable as Variable
  const alternateTypeVariable = alternate.typeVariable as Variable
  const result = updateTypeConstraints(consequentTypeVariable, alternateTypeVariable)
  if (result !== undefined) {
    throw new ConditionalTypeError(result.constraintLhs, result.constraintRhs, consequent.loc!)
  }

  updateTypeConstraints(expressionTypeVariable, consequentTypeVariable)
}

function inferReturnStatement(returnStatement: TypeAnnotatedNode<es.ReturnStatement>) {
  // Update type constraints in constraintStore
  // e.g. Given: (return (...)^T1)^T2, Set: T2 = T1
  const arg = returnStatement.argument as TypeAnnotatedNode<es.Node>
  const argTypeVariable = arg.typeVariable as Variable

  const returnypeVariable = returnStatement.typeVariable as Variable

  if (returnypeVariable !== undefined && argTypeVariable !== undefined) {
    const errorObj = updateTypeConstraints(returnypeVariable, argTypeVariable)
    if (errorObj) {
      // type error
      throw new GeneralTypeError(
        returnypeVariable,
        argTypeVariable,
        'Failed in assigning the type of the expression to the return statement expression',
        returnStatement.loc!
      )
    }
  }
}

function inferFunctionDeclaration(functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration>) {
  // Update type constraints in constraintStore
  // e.g. Given: f^T5 (x^T1) { (return (...))^T2 ... (return (...))^T3 }^T4
  // First, try to add constraints that ensure all ReturnStatements *and BlockStatements* give same type
  // e.g. T2 = T3
  // const bodyNodes = (functionDeclaration.body as TypeAnnotatedNode<es.BlockStatement>).body
  // let prevReturnTypeVariable
  // for (const node of bodyNodes) {
  //   if (node.type === 'ReturnStatement' || node.type === 'BlockStatement') {
  //     const currReturnTypeVariable = (node as TypeAnnotatedNode<es.Node>).typeVariable as Variable
  //     if (prevReturnTypeVariable !== undefined && currReturnTypeVariable !== undefined) {
  //       const errorObj = updateTypeConstraints(prevReturnTypeVariable, currReturnTypeVariable)
  //       if (errorObj) {
  //         throw new DifferentReturnTypeError(node.loc!)
  //       }
  //     }
  //     prevReturnTypeVariable = currReturnTypeVariable
  //   }
  // }
  // **** ^ DONE BY BLOCK ****

  // If the above step executes successfully w/o any Type Error,
  // Next, add constraint to give the FunctionDeclaration a result type corresponding to the (last) ReturnStatement *or BlockStatement*
  // e.g. T4 = T3
  // const block = functionDeclaration.body as TypeAnnotatedNode<es.BlockStatement>
  // const blockTypeVariable = block.typeVariable as Variable
  // if (blockTypeVariable !== undefined && prevReturnTypeVariable !== undefined) {
  //   const errorObj = updateTypeConstraints(blockTypeVariable, prevReturnTypeVariable)
  //   if (errorObj) {
  //     throw new GeneralTypeError(
  //       blockTypeVariable,
  //       prevReturnTypeVariable,
  //       'Failed in assigning the return type to the block',
  //       block.loc!
  //     )
  //   }
  // }
  // **** ^ DONE BY BLOCK ****

  // Add constraint to give the function identifier the corresponding function type
  // e.g. Given: f^T5 (x^T1) { (return (...))^T2 ... (return (...))^T3 }^T4
  //      Add: T5 = [T1] => T4
  const iden = functionDeclaration.id as TypeAnnotatedNode<es.Identifier>
  const idenTypeVariable = iden.typeVariable as Variable

  const functionType = currentTypeEnvironment.get(iden.name) // Get function type from Type Env since it was added there

  if (idenTypeVariable !== undefined && functionType !== undefined) {
    const errorObj = updateTypeConstraints(idenTypeVariable, functionType)
    if (errorObj) {
      throw new GeneralTypeError(
        idenTypeVariable,
        functionType,
        "Failed to assign the function type to the function identifier",
        functionDeclaration.loc!
      )
    }
  }
}

function inferFunctionDefinition(functionDefinition: TypeAnnotatedNode<es.ArrowFunctionExpression>) {
  // Add constraint to give the function result the corresponding function type
  // e.g. Given: ( (x^T1) => { S }^T2 )^T3
  //      Add: T3 = [T1] => T2
  const params = functionDefinition.params as TypeAnnotatedNode<es.Node>[]
  const paramTypeVariables = []
  for (const p of params) {
    if (p.typeVariable) paramTypeVariables.push(p.typeVariable as Variable)
  }

  const bodyTypeVariable = (functionDefinition.body as TypeAnnotatedNode<es.Node>).typeVariable as Variable
  const resultTypeVariable = functionDefinition.typeVariable as Variable

  const isPolymorphic = true  // because using type variables
  const functionType = generateFunctionType(paramTypeVariables, bodyTypeVariable, isPolymorphic)

  if (resultTypeVariable !== undefined && functionType !== undefined) {
    const errorObj = updateTypeConstraints(resultTypeVariable, functionType)
    if (errorObj) {
      throw new GeneralTypeError(
        resultTypeVariable,
        functionType,
        "Failed to assign the function type to the function definition's type variable",
        functionDefinition.loc!
      )
    }
  }
}

function inferFunctionApplication(functionApplication: TypeAnnotatedNode<es.CallExpression>) {
  // Update type constraints in constraintStore
  // e.g. Given: f^T5 (x^T1) { (return (...))^T2 ... (return (...))^T3 }^T4
  //             f^T7 (1^T6)

  const iden = functionApplication.callee as TypeAnnotatedNode<es.Identifier>
  const applicationArgs = functionApplication.arguments as TypeAnnotatedNode<es.Node>[]
  const applicationArgCount = applicationArgs.length

  let declarationFunctionType = currentTypeEnvironment.get(iden.name).types[0]

  // Only handle functions that have already been declared
  if (isFunctionType(declarationFunctionType)) {
    const declarationArgCount = declarationFunctionType.parameterTypes.length

    // Additional logic to handle polymorphic functions
    if (
      declarationFunctionType &&
      isFunctionType(declarationFunctionType) &&
      declarationFunctionType.isPolymorphic
    ) {
      declarationFunctionType = generateFunctionTypeWithFreshTypeVariables(declarationFunctionType)
    }

    // First, ensure arg nodes have same count as Γ(f)
    // Note that we skip this check for functions with varArgs
    if (!declarationFunctionType.hasVarArgs && applicationArgCount !== declarationArgCount) {
      throw new WrongNumberArgumentsError(
        declarationArgCount,
        applicationArgCount,
        functionApplication.loc!
      )
    }

    // Second, try to add constraints that ensure arg nodes have same corresponding types
    for (let i = 0; i < applicationArgs.length; i++) {
      const applicationArgTypeVariable = applicationArgs[i].typeVariable as Variable
      let declarationArgType
      if (declarationFunctionType.hasVarArgs) {
        // Note that for functions with varArgs, we check that all args have same type as the single declared type
        declarationArgType = declarationFunctionType.parameterTypes[0]
      } else {
        declarationArgType = declarationFunctionType.parameterTypes[i]
      }
      const errorObj = updateTypeConstraints(applicationArgTypeVariable, declarationArgType)
      if (errorObj) {
        let expectedType = errorObj.constraintLhs // set default
        let receivedType = errorObj.constraintRhs // set default

        // Try to use inferredType to ensure we print the correct error msg
        // Especially since constraint lhs/rhs order does not always coincide with expected/received type order
        if (applicationArgs[i].inferredType) {
          receivedType = applicationArgs[i].inferredType
          if (receivedType && receivedType.name && receivedType.name !== errorObj.constraintRhs.name) {
            expectedType = errorObj.constraintRhs
          }
        }

        throw new WrongArgumentTypeError(
          expectedType,
          receivedType,
          i + 1,
          applicationArgs[i].loc!
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
      throw new GeneralTypeError(
        applicationTypeVariable,
        resultTypeVariable,
        'Failed in assigning the result type of the function to the function application expression',
        functionApplication.loc!
      )
    }
  }
}

function addTypeConstraintForLiteralPrimitive(literal: TypeAnnotatedNode<es.Literal>) {
  // Update type constraints in constraintStore
  // e.g. Given: 1^T2, Set: T2 = number
  const literalTypeVariable = literal.typeVariable as Variable
  const literalType = literal.inferredType as Primitive

  if (literalTypeVariable !== undefined && literalType !== undefined) {
    const result = updateTypeConstraints(literalTypeVariable, literalType)
    if (result !== undefined) {
      throw new GeneralTypeError(
        literalTypeVariable,
        literalType,
        'Failed in assigning the type of the literal to the type variable annotating the literal',
        literal.loc!
      )
    }
  }
}

function generateFunctionTypeWithFreshTypeVariables(parent: Type) {
  if (isFunctionType(parent)) {
    const p = parent as FunctionType
    const child = generateAndCopyFunctionType(p)
    const tmpMap = new Map() // tracks old TVariable, new TVariable

    // Process each parameterType iteratively
    for (let i = 0; i < p.parameterTypes.length; i++) {
      if (isTypeVariable(p.parameterTypes[i])) {
        let freshTypeVariable
        if (tmpMap.get(p.parameterTypes[i]) === undefined) {
          freshTypeVariable = fresh(p.parameterTypes[i] as Variable)
          tmpMap.set(p.parameterTypes[i], freshTypeVariable) // track mapping for repeated use
        } else {
          freshTypeVariable = tmpMap.get(p.parameterTypes[i])
        }
        if (freshTypeVariable) child.parameterTypes[i] = freshTypeVariable
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
      if (freshTypeVariable) child.returnType = freshTypeVariable
    }

    return child
  }
}

function ifStatementHasReturnStatements(ifStatement: TypeAnnotatedNode<es.IfStatement>): boolean {
  const consequent = ifStatement.consequent as TypeAnnotatedNode<es.BlockStatement>
  const alternate = ifStatement.alternate as TypeAnnotatedNode<es.BlockStatement>

  return (
    blockStatementHasReturnStatements(consequent) || blockStatementHasReturnStatements(alternate)
  )
}

function blockStatementHasReturnStatements(block: TypeAnnotatedNode<es.BlockStatement>): boolean {
  for (const statement of block.body) {
    if (statement.type === 'ReturnStatement') {
      return true
    }
    if (statement.type === 'IfStatement') {
      if (ifStatementHasReturnStatements(statement)) {
        return true
      }
    }
    if (statement.type === 'BlockStatement') {
      if (blockStatementHasReturnStatements(statement)) {
        return true
      }
    }
  }
  return false
}

function inferBlockStatement(
  block: TypeAnnotatedNode<es.BlockStatement>,
  environmentToExtend: Map<any, any>
) {
  currentTypeEnvironment = extendEnvironment(environmentToExtend)
  const blockTypeVariable = block.typeVariable
  for (const expression of block.body) {
    infer(expression, currentTypeEnvironment)

    // Set block type var to ReturnStatement type var
    if (expression.type === 'ReturnStatement') {
      const returnStatementTypeVariable = (expression as TypeAnnotatedNode<es.ReturnStatement>)
        .typeVariable
      if (returnStatementTypeVariable !== undefined && blockTypeVariable !== undefined) {
        const result = updateTypeConstraints(blockTypeVariable, returnStatementTypeVariable)
        if (result) {
          throw new GeneralTypeError(
            returnStatementTypeVariable,
            blockTypeVariable,
            'Failed in assigning the type of the return expression to the block',
            expression.loc!
          )
        }
        return
      }
    }

    // Set block type var to IfStatement type var
    if (expression.type === 'IfStatement' && ifStatementHasReturnStatements(expression)) {
      // Check if it has return statements. It has return statements when the type of the block is not undefined.
      // If it does, assign type of block to type of IfStatement.
      const ifStatementTypeVariable = (expression as TypeAnnotatedNode<es.IfStatement>).typeVariable
      if (ifStatementTypeVariable !== undefined && blockTypeVariable !== undefined) {
        const result = updateTypeConstraints(blockTypeVariable, ifStatementTypeVariable)
        if (result) {
          throw new GeneralTypeError(
            ifStatementTypeVariable,
            blockTypeVariable,
            'Failed in assigning the type of the if statement to the block',
            expression.loc!
          )
        }
        return
      }
    }
  }

  // Todo - Add test case for coverage
  if (blockTypeVariable !== undefined) {
    const result = updateTypeConstraints(blockTypeVariable, undefinedType)
    if (result) {
      throw new GeneralTypeError(
        undefinedType,
        blockTypeVariable,
        'Failed in assigning the type of the block to undefined',
        block.loc!
      )
    }
    return
  }
}

function infer(statement: es.Node, environmentToExtend: Map<any, any> = emptyMap) {
  switch (statement.type) {
    case 'BlockStatement': {
      if (environmentToExtend !== undefined) {
        inferBlockStatement(statement, environmentToExtend)
        currentTypeEnvironment = popEnvironment()
      }
      return
    }
    case 'Literal': {
      inferLiteral(statement)
      return
    }
    case 'Identifier': {
      inferIdentifier(statement)
      return
    }
    case 'VariableDeclaration': {
      infer(statement.declarations[0].init!)
      inferConstantDeclaration(statement)
      return
    }
    case 'UnaryExpression': {
      infer(statement.argument)
      inferUnaryExpression(statement)
      return
    }
    case 'ExpressionStatement': {
      infer(statement.expression)
      return
    }
    case 'BinaryExpression': {
      infer(statement.left)
      infer(statement.right)
      inferBinaryExpression(statement)
      return
    }
    case 'LogicalExpression': {
      infer(statement.left)
      infer(statement.right)
      inferBinaryExpression(statement)
      return
    }
    case 'ConditionalExpression': {
      infer(statement.test)
      infer(statement.alternate)
      infer(statement.consequent)
      inferConditionals(statement)
      return
    }
    case 'IfStatement': {
      infer(statement.test, environmentToExtend)
      infer(statement.alternate!, environmentToExtend)
      infer(statement.consequent, environmentToExtend)
      inferConditionals(statement)
      return
    }
    case 'FunctionDeclaration': {
      // FIXME: Environment does not seem to be scoped with respect to argument parameters.
      const parameters = new Map()
      for (const param of statement.params) {
        parameters.set((param as es.Identifier).name, {
          types: [(param as TypeAnnotatedNode<es.Pattern>).typeVariable]
        })
      }
      infer(statement.body, parameters)
      currentTypeEnvironment = extendEnvironment(parameters)
      inferFunctionDeclaration(statement)
      currentTypeEnvironment = popEnvironment()
      return
    }
    case 'ArrowFunctionExpression': {
      // FIXME: Environment does not seem to be scoped with respect to argument parameters.
      const parameters = new Map()
      for (const param of statement.params) {
        parameters.set((param as es.Identifier).name, {
          types: [(param as TypeAnnotatedNode<es.Pattern>).typeVariable]
        })
      }
      // Note: order swapped wrt function declaration because function definition does not have a block statement to extend the env
      // Hence, env needs to be extended here first
      currentTypeEnvironment = extendEnvironment(parameters)
      infer(statement.body, parameters)

      inferFunctionDefinition(statement)
      currentTypeEnvironment = popEnvironment()
      return
    }
    case 'CallExpression': {
      for (const argument of statement.arguments) {
        infer(argument)
      }
      infer(statement.callee)
      inferFunctionApplication(statement)
      return
    }
    case 'ReturnStatement': {
      infer(statement.argument!)
      inferReturnStatement(statement)
      break
    }
    default: {
      console.log(`[WARNING] Not implemented yet - Pls check! statement.type: ${statement.type}`)
      return
    }
  }
}

// function displayErrorAndTerminate(errorMsg: string, loc: es.SourceLocation | null | undefined) {
//   logObjectsForDebugging()
//   console.log('!!! Type check error !!!')

//   // Print error msg with optional location (if exists)
//   if (loc) console.log(`${errorMsg} (line: ${loc.start.line}, char: ${loc.start.column})`)
//   else console.log(errorMsg)

//   console.log('\nTerminating program..')
//   return process.exit(0)
// }

function logObjectsForDebugging() {
  // for Debugging output
  console.log('\n--------------')
  printTypeAnnotation(annotatedProgram)
  printTypeEnvironment(currentTypeEnvironment)
  printTypeConstraints(constraintStore)
}
// // main function that will infer a program
export function inferProgram(program: es.Program): TypeAnnotatedNode<es.Program> {
  // Step 1. Annotate program
  program = annotateProgram(program)
  annotatedProgram = program

  // Step 2. Update type environment
  updateTypeEnvironment(program)

  // Step 3. Update and solve type constraints
  for (const statement of program.body) {
    infer(statement)
  }

  // Successful run..
  logObjectsForDebugging()
  // return the AST with annotated types
  return program
}
