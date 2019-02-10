import { simple } from 'acorn-walk/dist/walk'
import * as es from 'estree'
import { GLOBAL } from './constants'
// import * as constants from "./constants";
// import * as errors from "./interpreter-errors";
import { AllowedDeclarations, Context } from './types'
import * as create from './utils/astCreator'
// import * as rttc from "./utils/rttc";

type StorageLocations = 'builtins' | 'globals' | 'operators'

function createStorageLocationAstFor(type: StorageLocations): es.MemberExpression {
  return create.memberExpression(
    create.memberExpression(create.identifier('context'), 'native'),
    type
  )
}

function createGetFromStorageLocationAstFor(name: string, type: StorageLocations): es.Expression {
  return create.callExpression(create.memberExpression(createStorageLocationAstFor(type), 'get'), [
    create.stringLiteral(name)
  ])
}

function createStatementAstToStoreBackCurrentlyDeclaredGlobal(
  name: string,
  kind: AllowedDeclarations
): es.ExpressionStatement {
  return create.expressionStatement(
    create.callExpression(create.memberExpression(createStorageLocationAstFor('globals'), 'set'), [
      create.stringLiteral(name),
      {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'Property',
            method: false,
            shorthand: false,
            computed: false,
            key: create.stringLiteral('kind'),
            value: create.stringLiteral(kind),
            kind: 'init'
          },
          {
            type: 'Property',
            method: false,
            shorthand: false,
            computed: false,
            key: create.stringLiteral('value'),
            value: create.identifier(name),
            kind: 'init'
          }
        ]
      }
    ])
  )
}

function createStatementsToDeclareBuiltins(node: es.BlockStatement, context: Context) {
  const statements = []
  for (const builtinName of context.native.builtins.keys()) {
    statements.push(
      create.constantDeclaration(
        builtinName,
        createGetFromStorageLocationAstFor(builtinName, 'builtins')
      )
    )
  }
  return statements
}

function createStatementsToDeclarePreviouslyDeclaredGlobals(
  node: es.BlockStatement,
  context: Context
) {
  const statements = []
  for (const [name, valueWrapper] of context.native.globals.entries()) {
    const unwrappedValueAst = create.memberExpression(
      createGetFromStorageLocationAstFor(name, 'globals'),
      'value'
    )
    statements.push(create.declaration(name, valueWrapper.kind, unwrappedValueAst))
  }
  return statements
}

function createStatementsToStorePreviouslyDeclaredLetGlobals(
  node: es.BlockStatement,
  context: Context
) {
  const statements = []
  for (const [name, valueWrapper] of context.native.globals.entries()) {
    if (valueWrapper.kind === 'let') {
      statements.push(createStatementAstToStoreBackCurrentlyDeclaredGlobal(name, 'let'))
    }
  }
  return statements
}

function createStatementsToStoreCurrentlyDeclaredGlobals(program: es.BlockStatement) {
  const statements = []
  for (const statement of program.body) {
    if (statement.type === 'VariableDeclaration') {
      const name = (statement.declarations[0].id as es.Identifier).name
      const kind = statement.kind as AllowedDeclarations
      statements.push(createStatementAstToStoreBackCurrentlyDeclaredGlobal(name, kind))
    }
  }
  return statements
}

function transformFunctionDeclarationsToConstantArrowFunctionDeclarations(blockStatement: es.BlockStatement) {
  simple(blockStatement, {
    FunctionDeclaration(node) {
      const { id, params, body } = node as es.FunctionDeclaration
      node.type = 'VariableDeclaration'
      const transformedNode = node as es.VariableDeclaration
      transformedNode.kind = 'const'
      transformedNode.declarations = [
        {
          type: 'VariableDeclarator',
          id: id as es.Identifier,
          init: create.blockArrowFunction(params as es.Identifier[], body)
        }
      ]
    }
  })
}

function wrapInAnonymousFunctionToBlockExternalGlobals(statements: es.Statement[]): es.Statement {
  function isValidIdentifier(candidate: string) {
    try {
      // tslint:disable-next-line:no-eval
      eval(`{const ${candidate} = 1;}`)
      return true
    } catch {
      return false
    }
  }
  const globalsArray = Object.getOwnPropertyNames(GLOBAL)
  const globalsWithValidIdentifiers = globalsArray.filter(isValidIdentifier)
  const validGlobalsAsIdentifierAsts = globalsWithValidIdentifiers.map(globalName =>
    create.identifier(globalName)
  )
  return create.expressionStatement(
    create.callExpression(
      create.blockArrowFunction(validGlobalsAsIdentifierAsts, [
        create.returnStatement(create.callExpression(create.blockArrowFunction([], statements), []))
      ]),
      []
    )
  )
}

export function transpile(node: es.Node, context: Context) {
  const program = node as es.BlockStatement
  transformFunctionDeclarationsToConstantArrowFunctionDeclarations(program)
  const statements = program.body
  if (statements.length > 0) {
    const statementsToAppend = []
    const statementsToPrepend: es.Statement[] = []
    const lastIndex = statements.length - 1
    const lastStatement: es.Statement = statements[lastIndex]
    const isLastStatementAnExpression = lastStatement.type === 'ExpressionStatement'
    statementsToPrepend.push(...createStatementsToDeclareBuiltins(program, context))
    statementsToPrepend.push(
      ...createStatementsToDeclarePreviouslyDeclaredGlobals(program, context)
    )
    statementsToAppend.push(
      ...createStatementsToStorePreviouslyDeclaredLetGlobals(program, context)
    )
    statementsToAppend.push(...createStatementsToStoreCurrentlyDeclaredGlobals(program))
    program.body.unshift(...statementsToPrepend)

    if (isLastStatementAnExpression) {
      const uniqueIdentifier =
        '$$lastExpressionValue' + String(Math.floor(Math.random() * 1000000000))
      const newLastStatement: es.Statement = create.returnStatement(
        create.callExpression(
          create.blockArrowFunction(
            [],
            [
              create.declaration(
                uniqueIdentifier,
                'const',
                (lastStatement as es.ExpressionStatement).expression
              ),
              ...statementsToAppend,
              create.returnStatement(create.identifier(uniqueIdentifier))
            ]
          ),
          []
        )
      )
      program.body.pop()
      program.body.push(newLastStatement)
    } else {
      program.body.push(
        ...statementsToAppend,
        create.expressionStatement(create.identifier('undefined'))
      )
    }
  }
  const wrapped = wrapInAnonymousFunctionToBlockExternalGlobals(program.body)
  program.body = [wrapped]
  return node
}
