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
  generateAndCopyFunctionType
} from './typeEnvironment'
import { updateTypeConstraints, constraintStore } from './constraintStore'
import * as es from 'estree'
import {
  printType,
  printTypeAnnotation,
  printTypeConstraints,
  printTypeEnvironment
} from '../utils/inferencerUtils'

let annotatedProgram: es.Program
let currentTypeEnvironment: Map<any, any> = globalTypeEnvironment

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
    displayErrorAndTerminate(
      `Identifier with name \`${identifier.name}\` not found in type environment!`,
      identifier.loc
    )
  }

  // Update type constraints in constraintStore
  // e.g. Given: x^T2, Set: T2 = Γ[x]
  const idenTypeVariable = identifier.typeVariable as Variable
  const idenTypeEnvType = currentTypeEnvironment.get(identifier.name).types[0]

  if (idenTypeVariable && idenTypeEnvType) {
    const errorObj = updateTypeConstraints(idenTypeVariable, idenTypeEnvType)
    if (errorObj) {
      displayErrorAndTerminate(
        'WARNING: There should not be a type error here in `inferIdentifier()` - pls debug',
        identifier.loc
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

  if (idenTypeVariable && valueTypeVariable) {
    const errorObj = updateTypeConstraints(idenTypeVariable, valueTypeVariable)
    if (errorObj) {
      displayErrorAndTerminate(
        'WARNING: There should not be a type error here in `inferConstantDeclaration()` - pls debug',
        constantDeclaration.loc
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
    const errorObj = updateTypeConstraints(resultTypeVariable, operatorResultType)
    if (errorObj) {
      displayErrorAndTerminate(
        `Expecting type \`${printType(operatorResultType)}\` but got \`${printType(
          resultTypeVariable
        )} + \` instead`,
        unaryExpression.loc
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

  if (param1TypeVariable !== undefined && param1Type !== undefined) {
    const errorObj = updateTypeConstraints(param1TypeVariable, param1Type)
    if (errorObj && errorObj.constraintRhs) {
      if (!functionType.isPolymorphic)
        displayErrorAndTerminate(
          `Expecting type \`${param1Type.name}\` but got \`${errorObj.constraintRhs.name}\` instead`,
          param1.loc
        )
      else
        displayErrorAndTerminate(
          'Polymorphic type error when type checking first argument, error msg TBC',
          param1.loc
        )
    }
  }

  if (param2TypeVariable !== undefined && param2Type !== undefined) {
    const errorObj = updateTypeConstraints(param2TypeVariable, param2Type)
    if (errorObj && errorObj.constraintRhs) {
      if (!functionType.isPolymorphic)
        displayErrorAndTerminate(
          `Expecting type \`${param2Type.name}\` but got \`${errorObj.constraintRhs.name}\` instead`,
          param2.loc
        )
      else
        displayErrorAndTerminate(
          'Polymorphic type error when type checking second argument, error msg TBC',
          param2.loc
        )
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
  if (testTypeVariable !== undefined) {
    const errorObj = updateTypeConstraints(testTypeVariable, booleanType)
    if (errorObj) {
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
    const errorObj = updateTypeConstraints(consequentTypeVariable, alternateTypeVariable)
    if (errorObj && errorObj.constraintLhs && errorObj.constraintRhs) {
      displayErrorAndTerminate(
        `Expecting consequent and alternate types \`${errorObj.constraintLhs.name}\` and \`${errorObj.constraintRhs.name}\` to be the same, but got different`,
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
    const errorObj = updateTypeConstraints(returnypeVariable, argTypeVariable)
    if (errorObj) {
      // type error
      displayErrorAndTerminate(
        'WARNING: There should not be a type error here in `inferReturnStatement()` - pls debug',
        returnStatement.loc
      )
    }
  }
}

function inferFunctionDeclaration(functionDeclaration: TypeAnnotatedNode<es.FunctionDeclaration> | TypeAnnotatedNode<es.ArrowFunctionExpression>) {
  // Update type constraints in constraintStore
  // e.g. Given: f^T5 (x^T1) { (return (...))^T2 ... (return (...))^T3 }^T4

  // First, try to add constraints that ensure all ReturnStatements *and BlockStatements* give same type
  // e.g. T2 = T3
  const bodyNodes = (functionDeclaration.body as TypeAnnotatedNode<es.BlockStatement>).body
  let prevReturnTypeVariable
  for (const node of bodyNodes) {
    if (node.type === 'ReturnStatement' || node.type === 'BlockStatement') {
      const currReturnTypeVariable = (node as TypeAnnotatedNode<es.Node>).typeVariable as Variable
      if (prevReturnTypeVariable !== undefined && currReturnTypeVariable !== undefined) {
        const errorObj = updateTypeConstraints(prevReturnTypeVariable, currReturnTypeVariable)
        if (errorObj) {
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
  // Next, add constraint to give the FunctionDeclaration a result type corresponding to the (last) ReturnStatement *or BlockStatement*
  // e.g. T4 = T3
  const block = functionDeclaration.body as TypeAnnotatedNode<es.BlockStatement>
  const blockTypeVariable = block.typeVariable as Variable

  if (blockTypeVariable !== undefined && prevReturnTypeVariable !== undefined) {
    const errorObj = updateTypeConstraints(blockTypeVariable, prevReturnTypeVariable)
    if (errorObj) {
      displayErrorAndTerminate(
        'WARNING: There should not be a type error here in `inferFunctionDeclaration()` Part B - pls debug',
        functionDeclaration.loc
      )
    }
  }

  // Commented out as this does not seem to be needed.
  // inferIdentifier() would already add the required constraint and this block seem to not be invoked (maybe because TVar not avail)
  // // Finally, add constraint to give the function identifier the corresponding function type
  // // e.g. T5 = [T1] => T4
  // const iden = functionDeclaration.id as TypeAnnotatedNode<es.Identifier>
  // const idenTypeVariable = iden.typeVariable as Variable

  // const functionType = currentTypeEnvironment.get(iden.name) // Get function type from Type Env since it was added there

  // if (idenTypeVariable !== undefined && functionType !== undefined) {
  //   const errorObj = updateTypeConstraints(idenTypeVariable, functionType)
  //   if (errorObj) {
  //     displayErrorAndTerminate(
  //       'WARNING: There should not be a type error here in `inferFunctionDeclaration()` Part C - pls debug',
  //       functionDeclaration.loc
  //     )
  //   }
  // }
}

function inferFunctionApplication(functionApplication: TypeAnnotatedNode<es.CallExpression>) {
  // Update type constraints in constraintStore
  // e.g. Given: f^T5 (x^T1) { (return (...))^T2 ... (return (...))^T3 }^T4
  //             f^T7 (1^T6)

  const iden = functionApplication.callee as TypeAnnotatedNode<es.Identifier>
  const applicationArgs = functionApplication.arguments as TypeAnnotatedNode<es.Node>[]
  const applicationArgCount = applicationArgs.length

  let declarationFunctionType = currentTypeEnvironment.get(iden.name).types[0]
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
    displayErrorAndTerminate(
      `Expecting \`${declarationArgCount}\` arguments but got \`${applicationArgCount}\` instead`,
      functionApplication.loc
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

    if (applicationArgTypeVariable && declarationArgType) {
      const errorObj = updateTypeConstraints(applicationArgTypeVariable, declarationArgType)
      if (errorObj) {
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
  const literalTypeVariable = literal.typeVariable as Variable
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
        // const errorObj = updateTypeConstraints(returnStatementTypeVariable, blockTypeVariable)
        const errorObj = updateTypeConstraints(blockTypeVariable, returnStatementTypeVariable) // Fixed order
        if (errorObj) {
          displayErrorAndTerminate(
            'WARNING: There is a type error when checking the type of a block',
            block.loc
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
        // const errorObj = updateTypeConstraints(ifStatementTypeVariable, blockTypeVariable)
        const errorObj = updateTypeConstraints(blockTypeVariable, ifStatementTypeVariable) // Fixed order
        if (errorObj) {
          displayErrorAndTerminate(
            'WARNING: There is a type error when checking the type of a block',
            block.loc
          )
        }
        return
      }
    }
  }

  // Todo - Add test case for coverage
  if (blockTypeVariable !== undefined) {
    const errorObj = updateTypeConstraints(blockTypeVariable, undefinedType)
    if (errorObj) {
      displayErrorAndTerminate(
        'WARNING: There is a type error when checking the type of a block',
        block.loc
      )
    }
    return
  }
}

function infer(statement: es.Node, environmentToExtend: Map<any, any> = emptyMap) {
  // console.log(statement.type)
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
    case 'FunctionDeclaration':
    case 'ArrowFunctionExpression': {
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
