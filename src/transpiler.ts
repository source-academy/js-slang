import { simple } from 'acorn-walk/dist/walk'
import { generate } from 'astring'
import * as es from 'estree'
import * as sourceMap from 'source-map'
import { GLOBAL, GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE } from './constants'
import * as errors from './interpreter-errors'
import { AllowedDeclarations, Value } from './types'
import * as create from './utils/astCreator'
import * as random from './utils/random'

/**
 * This whole transpiler includes many many many many hacks to get stuff working.
 * Order in which certain functions are called matter as well.
 * There should be an explanation on it coming up soon.
 */

type StorageLocations = 'builtins' | 'globals' | 'operators' | 'properTailCalls'

let NATIVE_STORAGE: {
  builtins: Map<string, Value>
  globals: Map<string, { kind: AllowedDeclarations; value: Value }>
  operators: Map<string, (...operands: Value[]) => Value>
}

let usedIdentifiers: Set<string>

function getUnqiueId() {
  let uniqueId = `$$unique${random.integer()}`
  while (usedIdentifiers.has(uniqueId)) {
    uniqueId += random.character()
  }
  usedIdentifiers.add(uniqueId)
  return uniqueId
}

let nativeStorageUniqueId: string
let contextId: number

function createStorageLocationAstFor(type: StorageLocations): es.MemberExpression {
  return create.memberExpression(
    {
      type: 'MemberExpression',
      object: create.identifier(nativeStorageUniqueId),
      property: create.literal(contextId),
      computed: true
    },
    type
  )
}

function createGetFromStorageLocationAstFor(name: string, type: StorageLocations): es.Expression {
  return create.callExpression(create.memberExpression(createStorageLocationAstFor(type), 'get'), [
    create.literal(name)
  ])
}

function createStatementAstToStoreBackCurrentlyDeclaredGlobal(
  name: string,
  kind: AllowedDeclarations
): es.ExpressionStatement {
  return create.expressionStatement(
    create.callExpression(create.memberExpression(createStorageLocationAstFor('globals'), 'set'), [
      create.literal(name),
      create.objectExpression([
        create.property('kind', create.literal(kind)),
        create.property('value', create.identifier(name))
      ])
    ])
  )
}

function createStatementsToDeclareBuiltins() {
  const statements = []
  for (const builtinName of NATIVE_STORAGE[contextId].builtins.keys()) {
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
  for (const [name, valueWrapper] of NATIVE_STORAGE[contextId].globals.entries()) {
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
  for (const [name, valueWrapper] of NATIVE_STORAGE[contextId].globals.entries()) {
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
      if (NATIVE_STORAGE[contextId].globals.has(name)) {
        throw new errors.VariableRedeclaration(statement, name)
      }
      const kind = statement.kind as AllowedDeclarations
      statements.push(createStatementAstToStoreBackCurrentlyDeclaredGlobal(name, kind))
    }
  }
  return statements
}

function generateFunctionsToStringMap(program: es.Program) {
  const map: Map<es.Node, string> = new Map()
  simple(program, {
    ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
      map.set(node, generate(node))
    },
    FunctionDeclaration(node: es.FunctionDeclaration) {
      map.set(node, generate(node))
    }
  })
  return map
}

function transformFunctionDeclarationsToArrowFunctions(
  program: es.Program,
  functionsToStringMap: Map<es.Node, string>
) {
  simple(program, {
    FunctionDeclaration(node) {
      const { id, params, body } = node as es.FunctionDeclaration
      node.type = 'VariableDeclaration'
      node = node as es.VariableDeclaration
      const asArrowFunction = create.blockArrowFunction(params as es.Identifier[], body)
      functionsToStringMap.set(asArrowFunction, functionsToStringMap.get(node)!)
      node.declarations = [
        {
          type: 'VariableDeclarator',
          id: id as es.Identifier,
          init: asArrowFunction
        }
      ]
      node.kind = 'const'
    }
  })
}

/**
 * Transforms all arrow functions
 * (arg1, arg2, ...) => { statement1; statement2; return statement3; }
 *
 * to
 *
 * <NATIVE STORAGE>.properTailCalls.wrap((arg1, arg2, ...) => {
 *   statement1;statement2;return statement3;
 * })
 *
 * to allow for iterative processes to take place
 */

function wrapArrowFunctionsToAllowNormalCallsAndNiceToString(
  program: es.Program,
  functionsToStringMap: Map<es.Node, string>
) {
  simple(program, {
    ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
      create.mutateToCallExpression(
        node,
        create.memberExpression(createStorageLocationAstFor('properTailCalls'), 'wrap'),
        [{ ...node }, create.literal(functionsToStringMap.get(node)!)]
      )
    }
  })
}
/**
 * Transforms all return statements (including expression arrow functions) to return an intermediate value
 * return nonFnCall + 1;
 *  =>
 * return {isTail: false, value: nonFnCall + 1};
 *
 * return fnCall(arg1, arg2);
 * => return {isTail: true, function: fnCall, arguments: [arg1, arg2]}
 *
 * conditional and logical expressions will be recursively looped through as well
 */
function transformReturnStatementsToAllowProperTailCalls(program: es.Program) {
  function transformLogicalExpression(expression: es.Expression): es.Expression {
    switch (expression.type) {
      case 'LogicalExpression':
        return create.logicalExpression(
          expression.operator,
          expression.left,
          transformLogicalExpression(expression.right),
          expression.loc!
        )
      case 'ConditionalExpression':
        return create.conditionalExpression(
          expression.test,
          transformLogicalExpression(expression.consequent),
          transformLogicalExpression(expression.alternate),
          expression.loc!
        )
      case 'CallExpression':
        expression = expression as es.CallExpression
        const { line, column } = expression.loc!.start
        const functionName =
          expression.callee.type === 'Identifier' ? expression.callee.name : '<anonymous>'
        return create.objectExpression([
          create.property('isTail', create.literal(true)),
          create.property('function', expression.callee as es.Expression),
          create.property('functionName', create.literal(functionName)),
          create.property(
            'arguments',
            create.arrayExpression(expression.arguments as es.Expression[])
          ),
          create.property('line', create.literal(line)),
          create.property('column', create.literal(column))
        ])
      default:
        return create.objectExpression([
          create.property('isTail', create.literal(false)),
          create.property('value', expression)
        ])
    }
  }

  simple(program, {
    ReturnStatement(node: es.ReturnStatement) {
      node.argument = transformLogicalExpression(node.argument!)
    },
    ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
      if (node.expression) {
        node.body = transformLogicalExpression(node.body as es.Expression)
      }
    }
  })
}

function transformCallExpressionsToCheckIfFunction(program: es.Program) {
  simple(program, {
    CallExpression(node: es.CallExpression) {
      const { line, column } = node.loc!.start
      create.mutateToCallExpression(
        node,
        createGetFromStorageLocationAstFor('callIfFunctionAndRightArgumentsElseError', 'operators'),
        [
          node.callee as es.Expression,
          create.literal(line),
          create.literal(column),
          ...(node.arguments as es.Expression[])
        ]
      )
    }
  })
}

function transformSomeExpressionsToCheckIfBoolean(program: es.Program) {
  function transform(
    node:
      | es.IfStatement
      | es.ConditionalExpression
      | es.LogicalExpression
      | es.ForStatement
      | es.WhileStatement
  ) {
    const { line, column } = node.loc!.start
    const test = node.type === 'LogicalExpression' ? 'left' : 'test'
    node[test] = create.callExpression(
      createGetFromStorageLocationAstFor('itselfIfBooleanElseError', 'operators'),
      [node[test], create.literal(line), create.literal(column)]
    )
  }
  simple(program, {
    IfStatement(node: es.IfStatement) {
      transform(node)
    },
    ConditionalExpression(node: es.ConditionalExpression) {
      transform(node)
    },
    LogicalExpression(node: es.LogicalExpression) {
      transform(node)
    },
    ForStatement(node: es.ForStatement) {
      transform(node)
    },
    WhileStatement(node: es.WhileStatement) {
      transform(node)
    }
  })
}

function refreshLatestNatives(program: es.Program) {
  NATIVE_STORAGE = GLOBAL[GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE]
  usedIdentifiers = getAllIdentifiersUsed(program)
  nativeStorageUniqueId = getUnqiueId()
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

/**
 * statement1;
 * statement2;
 * ...
 * const a = 1; //lastStatement example 1 (should give undefined)
 * 1 + 1; //lastStatement example 2 (should give 2)
 * b = fun(5); //lastStatement example 3 (should set b to fun(5))
 * if (true) { true; } else { false; } //lastStatement example 4 (should give true)
 * for (let i = 0; i < 5; i = i + 1) { i; } //lastStatement example 5 (should give 4)
 *
 * We want to preserve the last evaluated statement's result to return back, so
 * for const/let declarations we simply don't change anything, and return undefined
 * at the end.
 *
 * For others, we will convert it into a string, wrap it in an eval, and store
 * the result in a temporary variable. e.g.
 *
 * const tempVar = eval("1+1;");
 * const tempVar = eval("if (true) { true; } else { false; }");
 * etc etc...
 * now at the end of all the appended statements we can do
 * return tempVar;
 */

function splitLastStatementIntoStorageOfResultAndAccessorPair(
  lastStatement: es.Statement
): [es.Statement, es.Statement, {}?] {
  if (lastStatement.type === 'VariableDeclaration') {
    return [lastStatement, create.returnStatement(create.identifier('undefined'))]
  }
  const uniqueIdentifier = getUnqiueId()
  const map = new sourceMap.SourceMapGenerator({ file: 'lastline' })
  const lastStatementAsCode = generate(lastStatement, { lineEnd: ' ', sourceMap: map, version: 3 })
  const uniqueDeclarationToStoreLastStatementResult = create.constantDeclaration(
    uniqueIdentifier,
    create.callExpression(create.identifier('eval'), [
      create.literal(lastStatementAsCode, lastStatement.loc!)
    ])
  )
  const returnStatementToReturnLastStatementResult = create.returnStatement(
    create.identifier(uniqueIdentifier)
  )
  return [
    uniqueDeclarationToStoreLastStatementResult,
    returnStatementToReturnLastStatementResult,
    map.toJSON()
  ]
}

function transformUnaryAndBinaryOperationsToFunctionCalls(program: es.Program) {
  simple(program, {
    BinaryExpression(node) {
      const { line, column } = node.loc!.start
      const { operator, left, right } = node as es.BinaryExpression
      create.mutateToCallExpression(
        node,
        createGetFromStorageLocationAstFor('evaluateBinaryExpressionIfValidElseError', 'operators'),
        [create.literal(operator), left, right, create.literal(line), create.literal(column)]
      )
    },
    UnaryExpression(node) {
      const { line, column } = node.loc!.start
      const { operator, argument } = node as es.UnaryExpression
      create.mutateToCallExpression(
        node,
        createGetFromStorageLocationAstFor('evaluateUnaryExpressionIfValidElseError', 'operators'),
        [create.literal(operator), argument, create.literal(line), create.literal(column)]
      )
    }
  })
}

export function transpile(untranformedProgram: es.Program, id: number) {
  contextId = id
  refreshLatestNatives(untranformedProgram)
  const program: es.Program = untranformedProgram
  const statements = program.body as es.Statement[]
  if (statements.length === 0) {
    return ''
  }
  const functionsToStringMap = generateFunctionsToStringMap(program)
  transformReturnStatementsToAllowProperTailCalls(program)
  transformCallExpressionsToCheckIfFunction(program)
  transformUnaryAndBinaryOperationsToFunctionCalls(program)
  transformSomeExpressionsToCheckIfBoolean(program)
  transformFunctionDeclarationsToArrowFunctions(program, functionsToStringMap)
  wrapArrowFunctionsToAllowNormalCallsAndNiceToString(program, functionsToStringMap)
  const declarationToAccessNativeStorage = create.constantDeclaration(
    nativeStorageUniqueId,
    create.identifier(GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE)
  )
  const statementsToPrepend = getStatementsToPrepend()
  const statementsToAppend = getStatementsToAppend(program)
  const lastStatement = statements.pop() as es.Statement
  const [
    uniqueDeclarationToStoreLastStatementResult,
    returnStatementToReturnLastStatementResult,
    lastStatementSourceMap
  ] = splitLastStatementIntoStorageOfResultAndAccessorPair(lastStatement)
  const wrapped = wrapInAnonymousFunctionToBlockExternalGlobals([
    ...statementsToPrepend,
    ...statements,
    uniqueDeclarationToStoreLastStatementResult,
    ...statementsToAppend,
    returnStatementToReturnLastStatementResult
  ])
  program.body = [declarationToAccessNativeStorage, wrapped]

  const map = new sourceMap.SourceMapGenerator({ file: 'source' })
  const transpiled = generate(program, { sourceMap: map })
  const consumer = map.toJSON()
  return [transpiled, consumer, lastStatementSourceMap]
}

/**
 * Restricts the access of external global variables in Source
 *
 * statement;
 * statement2;
 * statement3;
 * =>
 * ((window, Number, Function, alert, ...other globals) => {
 *  statement;
 *  statement2;
 *  statement3;
 * })();
 *
 */
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
