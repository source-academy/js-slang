import { simple } from 'acorn-walk/dist/walk'
import { generate } from 'astring'
import * as es from 'estree'
import { GLOBAL, NATIVE_STORAGE_GLOBAL } from './constants'
// import * as constants from "./constants";
// import * as errors from "./interpreter-errors";
import { AllowedDeclarations, Value } from './types'
import * as create from './utils/astCreator'
// import * as rttc from "./utils/rttc";

type StorageLocations = 'builtins' | 'globals' | 'operators'

let NATIVE_STORAGE: {
  builtins: Map<string, Value>
  globals: Map<string, { kind: AllowedDeclarations; value: Value }>
  operators: Map<string, (...operands: Value[]) => Value>
}

const getUniqueIdentifier = (() => {
  const used: string[] = []
  const BIG_ENOUGH = 1e12
  const getRandomInt = () => Math.floor(Math.random() * BIG_ENOUGH)
  return () => {
    let candidate
    do {
      candidate = '$_uniqueIdentifier$_' + String(getRandomInt())
    } while (used.includes(candidate))
    used.push(candidate)
    return candidate
  }
})()

let nativeStorageUniqueId = getUniqueIdentifier()

function createStorageLocationAstFor(type: StorageLocations): es.MemberExpression {
  return create.memberExpression(create.identifier(nativeStorageUniqueId), type)
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

function createStatementsToDeclareBuiltins(node: es.BlockStatement) {
  const statements = []
  for (const builtinName of NATIVE_STORAGE.builtins.keys()) {
    statements.push(
      create.constantDeclaration(
        builtinName,
        createGetFromStorageLocationAstFor(builtinName, 'builtins')
      )
    )
  }
  return statements
}

function createStatementsToDeclarePreviouslyDeclaredGlobals(node: es.BlockStatement) {
  const statements = []
  for (const [name, valueWrapper] of NATIVE_STORAGE.globals.entries()) {
    const unwrappedValueAst = create.memberExpression(
      createGetFromStorageLocationAstFor(name, 'globals'),
      'value'
    )
    statements.push(create.declaration(name, valueWrapper.kind, unwrappedValueAst))
  }
  return statements
}

function createStatementsToStorePreviouslyDeclaredLetGlobals(node: es.BlockStatement) {
  const statements = []
  for (const [name, valueWrapper] of NATIVE_STORAGE.globals.entries()) {
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

function transformFunctionDeclarationsToConstantArrowFunctionDeclarations(
  blockStatement: es.BlockStatement
) {
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

function transformArrowFunctionsToAllowProperTailCalls(blockStatement: es.BlockStatement) {
  simple(blockStatement, {
    ArrowFunctionExpression(node) {
      const originalNode = { ...node }
      node.type = 'CallExpression'
      const transformedNode = node as es.CallExpression
      transformedNode.arguments = [originalNode as es.ArrowFunctionExpression]
      transformedNode.callee = create.memberExpression(
        create.identifier(nativeStorageUniqueId),
        'enableProperTailCalls'
      )
    }
  })
}

function refreshLatestNatives() {
  NATIVE_STORAGE = GLOBAL[NATIVE_STORAGE_GLOBAL]
  nativeStorageUniqueId = getUniqueIdentifier()
}

function getStatementsToPrepend(program: es.BlockStatement) {
  return [
    ...createStatementsToDeclareBuiltins(program),
    ...createStatementsToDeclarePreviouslyDeclaredGlobals(program)
  ]
}

function getStatementsToAppend(program: es.BlockStatement) {
  return [
    ...createStatementsToStorePreviouslyDeclaredLetGlobals(program),
    ...createStatementsToStoreCurrentlyDeclaredGlobals(program)
  ]
}

function splitLastStatementIntoStorageOfResultAndAccessorPair(
  lastStatement: es.Statement
): es.Statement[] {
  if (lastStatement.type === 'VariableDeclaration') {
    return [lastStatement, create.returnStatement(create.identifier('undefined'))]
  }
  const uniqueIdentifier = getUniqueIdentifier()
  const lastStatementAsCode = generate(lastStatement)
  const uniqueDeclarationToStoreLastStatementResult = create.constantDeclaration(
    uniqueIdentifier,
    create.callExpression(create.identifier('eval'), [create.stringLiteral(lastStatementAsCode)])
  )
  const returnStatementToReturnLastStatementResult = create.returnStatement(
    create.identifier(uniqueIdentifier)
  )
  return [uniqueDeclarationToStoreLastStatementResult, returnStatementToReturnLastStatementResult]
}

export function transpile(node: es.Node) {
  refreshLatestNatives()
  const program = node as es.BlockStatement
  transformFunctionDeclarationsToConstantArrowFunctionDeclarations(program)
  transformArrowFunctionsToAllowProperTailCalls(program)
  const statements = program.body
  if (statements.length > 0) {
    const declarationToAccessNativeStorage = create.constantDeclaration(
      nativeStorageUniqueId,
      create.identifier(NATIVE_STORAGE_GLOBAL)
    )
    const statementsToAppend = getStatementsToAppend(program)
    const lastStatement = statements.pop() as es.Statement
    const [
      uniqueDeclarationToStoreLastStatementResult,
      returnStatementToReturnLastStatementResult
    ] = splitLastStatementIntoStorageOfResultAndAccessorPair(lastStatement)
    const wrapped = wrapInAnonymousFunctionToBlockExternalGlobals([
      ...getStatementsToPrepend(program),
      ...statements,
      uniqueDeclarationToStoreLastStatementResult,
      ...statementsToAppend,
      returnStatementToReturnLastStatementResult
    ])
    program.body = [declarationToAccessNativeStorage, wrapped]
  }
  return node
}

function wrapInAnonymousFunctionToBlockExternalGlobals(statements: es.Statement[]): es.Statement {
  function isValidIdentifier(candidate: string) {
    try {
      // tslint:disable-next-line:no-eval
      eval(`"use strict";{const ${candidate} = 1;}`)
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
