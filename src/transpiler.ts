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

let usedIdentifiers: Set<string>

function makeUnique(id: string) {
  let uniqueId = id
  while (usedIdentifiers.has(uniqueId)) {
    uniqueId += '$'
  }
  usedIdentifiers.add(uniqueId)
  return uniqueId
}

let nativeStorageUniqueId: string

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

function createStatementsToDeclareBuiltins() {
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

function createStatementsToDeclarePreviouslyDeclaredGlobals() {
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

function createStatementsToStorePreviouslyDeclaredLetGlobals() {
  const statements = []
  for (const [name, valueWrapper] of NATIVE_STORAGE.globals.entries()) {
    if (valueWrapper.kind === 'let') {
      statements.push(createStatementAstToStoreBackCurrentlyDeclaredGlobal(name, 'let'))
    }
  }
  return statements
}

function createStatementsToStoreCurrentlyDeclaredGlobals(program: es.Program) {
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

function transformFunctionDeclarationsToConstantArrowFunctionDeclarations(program: es.Program) {
  simple(program, {
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

function transformArrowFunctionsToAllowProperTailCalls(program: es.Program) {
  simple(program, {
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

function refreshLatestNatives(program: es.Program) {
  NATIVE_STORAGE = GLOBAL[NATIVE_STORAGE_GLOBAL]
  usedIdentifiers = getAllIdentifiersUsed(program)
  nativeStorageUniqueId = makeUnique('$$$___NATIVE_STORAGE')
}

function getAllIdentifiersUsed(program: es.Program) {
  const identifiers = new Set<string>()
  simple(program, {
    Identifier(node: es.Identifier) {
      identifiers.add(node.name)
    }
  })
  return identifiers
}

function getStatementsToPrepend() {
  return [
    ...createStatementsToDeclareBuiltins(),
    ...createStatementsToDeclarePreviouslyDeclaredGlobals()
  ]
}

function getStatementsToAppend(program: es.Program): es.Statement[] {
  return [
    ...createStatementsToStorePreviouslyDeclaredLetGlobals(),
    ...createStatementsToStoreCurrentlyDeclaredGlobals(program)
  ]
}

function splitLastStatementIntoStorageOfResultAndAccessorPair(
  lastStatement: es.Statement
): es.Statement[] {
  if (lastStatement.type === 'VariableDeclaration') {
    return [lastStatement, create.returnStatement(create.identifier('undefined'))]
  }
  const uniqueIdentifier = makeUnique('$$_lastStatementResult')
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

export function transpile(program: es.Program) {
  refreshLatestNatives(program)
  transformFunctionDeclarationsToConstantArrowFunctionDeclarations(program)
  transformArrowFunctionsToAllowProperTailCalls(program)
  const statements = program.body as es.Statement[]
  if (statements.length > 0) {
    const declarationToAccessNativeStorage = create.constantDeclaration(
      nativeStorageUniqueId,
      create.identifier(NATIVE_STORAGE_GLOBAL)
    )
    const statementsToPrepend = getStatementsToPrepend()
    const statementsToAppend = getStatementsToAppend(program)
    const lastStatement = statements.pop() as es.Statement
    const [
      uniqueDeclarationToStoreLastStatementResult,
      returnStatementToReturnLastStatementResult
    ] = splitLastStatementIntoStorageOfResultAndAccessorPair(lastStatement)
    const wrapped = wrapInAnonymousFunctionToBlockExternalGlobals([
      ...statementsToPrepend,
      ...statements,
      uniqueDeclarationToStoreLastStatementResult,
      ...statementsToAppend,
      returnStatementToReturnLastStatementResult
    ])
    program.body = [declarationToAccessNativeStorage, wrapped]
  }
  return program
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
