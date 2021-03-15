import { ancestor, simple } from '../utils/walkers'
import { generate } from 'astring'
import * as es from 'estree'
import { RawSourceMap, SourceMapGenerator } from 'source-map'
import { AllowedDeclarations, Context, NativeStorage, ValueWrapper } from '../types'
import { ConstAssignment, UndefinedVariable } from '../errors/errors'
import { memoizedGetModuleFile } from '../modules/moduleLoader'
import * as create from '../utils/astCreator'
import {
  getUniqueId,
  getIdentifiersInProgram,
  getIdentifiersInNativeStorage
} from '../utils/uniqueIds'
import { NATIVE_STORAGE_ID, MODULE_PARAMS_ID } from '../constants'

/**
 * This whole transpiler includes many many many many hacks to get stuff working.
 * Order in which certain functions are called matter as well.
 * There should be an explanation on it coming up soon.
 */

const globalIdNames = [
  'native',
  'callIfFuncAndRightArgs',
  'boolOrErr',
  'wrap',
  'unaryOp',
  'binaryOp',
  'throwIfTimeout',
  'setProp',
  'getProp',
  'lastStatementResult',
  'globals'
] as const

export type NativeIds = Record<typeof globalIdNames[number], es.Identifier>

function prefixModule(program: es.Program): string {
  let moduleCounter = 0
  let prefix = ''
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') {
      break
    }
    const moduleText = memoizedGetModuleFile('bundle', node.source.value as string).trim()
    // remove ; from moduleText
    prefix += `const __MODULE_${moduleCounter}__ = (${moduleText.substring(
      0,
      moduleText.length - 1
    )})(${MODULE_PARAMS_ID});\n`
    moduleCounter++
  }
  return prefix
}

export function transformSingleImportDeclaration(
  moduleCounter: number,
  node: es.ImportDeclaration
) {
  const result = []
  const tempNamespace = `__MODULE_${moduleCounter}__`
  // const yyy = __MODULE_xxx__.yyy;
  const neededSymbols = node.specifiers.map(specifier => specifier.local.name)
  for (const symbol of neededSymbols) {
    result.push(
      create.constantDeclaration(
        symbol,
        create.memberExpression(create.identifier(tempNamespace), symbol)
      )
    )
  }
  return result
}

export function transformImportDeclarations(program: es.Program) {
  const imports = []
  let result: es.VariableDeclaration[] = []
  let moduleCounter = 0
  while (program.body.length > 0 && program.body[0].type === 'ImportDeclaration') {
    imports.push(program.body.shift() as es.ImportDeclaration)
  }
  for (const node of imports) {
    result = transformSingleImportDeclaration(moduleCounter, node).concat(result)
    moduleCounter++
  }
  program.body = (result as (es.Statement | es.ModuleDeclaration)[]).concat(program.body)
}

function createStatementAstToStoreBackCurrentlyDeclaredGlobal(
  name: string,
  kind: AllowedDeclarations,
  globalIds: NativeIds,
  usedIdentifiers: Set<string>
): es.ExpressionStatement {
  const paramName = create.identifier(getUniqueId(usedIdentifiers))
  const variableIdentifier = create.identifier(name)
  const properties = [
    create.property('kind', create.literal(kind)),
    create.property(
      'getValue',
      create.blockArrowFunction([], [create.returnStatement(variableIdentifier)])
    )
  ]
  if (kind === 'let') {
    properties.push(
      create.property(
        'assignNewValue',
        create.functionExpression(
          [paramName],
          [create.returnStatement(create.assignmentExpression(variableIdentifier, paramName))]
        )
      )
    )
  }
  return create.expressionStatement(
    create.callExpression(
      create.memberExpression(create.memberExpression(globalIds.globals, 'variables'), 'set'),
      [create.literal(name), create.objectExpression(properties)]
    )
  )
}

function wrapWithPreviouslyDeclaredGlobals(
  statements: es.Statement[],
  nativeStorage: NativeStorage,
  globalIds: NativeIds
) {
  let currentVariableScope = nativeStorage.globals!.previousScope
  let timesToGoUp = 1
  let wrapped = create.blockStatement(statements)
  while (currentVariableScope !== null) {
    const initialisingStatements: es.Statement[] = []
    currentVariableScope.variables.forEach(({ kind }: ValueWrapper, name: string) => {
      let unwrappedValueAst: es.Expression = globalIds.globals
      for (let i = 0; i < timesToGoUp; i += 1) {
        unwrappedValueAst = create.memberExpression(unwrappedValueAst, 'previousScope')
      }
      unwrappedValueAst = create.callExpression(
        create.memberExpression(
          create.callExpression(
            create.memberExpression(create.memberExpression(unwrappedValueAst, 'variables'), 'get'),
            [create.literal(name)]
          ),
          'getValue'
        ),
        []
      )
      initialisingStatements.push(create.declaration(name, kind, unwrappedValueAst))
    })
    timesToGoUp += 1
    currentVariableScope = currentVariableScope.previousScope
    wrapped = create.blockStatement([...initialisingStatements, wrapped])
  }
  return wrapped
}

function createStatementsToStoreCurrentlyDeclaredGlobals(
  program: es.Program,
  globalIds: NativeIds,
  usedIdentifiers: Set<string>
) {
  return program.body
    .filter(statement => statement.type === 'VariableDeclaration')
    .map(({ declarations: { 0: { id } }, kind }: es.VariableDeclaration) =>
      createStatementAstToStoreBackCurrentlyDeclaredGlobal(
        (id as es.Identifier).name,
        kind as AllowedDeclarations,
        globalIds,
        usedIdentifiers
      )
    )
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
 * <NATIVE STORAGE>.operators.wrap((arg1, arg2, ...) => {
 *   statement1;statement2;return statement3;
 * })
 *
 * to allow for iterative processes to take place
 */

function wrapArrowFunctionsToAllowNormalCallsAndNiceToString(
  program: es.Program,
  functionsToStringMap: Map<es.Node, string>,
  globalIds: NativeIds
) {
  simple(program, {
    ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
      // If it's undefined then we're dealing with a thunk
      if (functionsToStringMap.get(node)! !== undefined) {
        create.mutateToCallExpression(node, globalIds.wrap, [
          { ...node },
          create.literal(functionsToStringMap.get(node)!),
          globalIds.native
        ])
      }
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

        const args = expression.arguments

        return create.objectExpression([
          create.property('isTail', create.literal(true)),
          create.property('function', expression.callee as es.Expression),
          create.property('functionName', create.literal(functionName)),
          create.property('arguments', create.arrayExpression(args as es.Expression[])),
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

function transformCallExpressionsToCheckIfFunction(program: es.Program, globalIds: NativeIds) {
  simple(program, {
    CallExpression(node: es.CallExpression) {
      const { line, column } = node.loc!.start
      const args = node.arguments

      node.arguments = [
        node.callee as es.Expression,
        create.literal(line),
        create.literal(column),
        ...args
      ]

      node.callee = globalIds.callIfFuncAndRightArgs
    }
  })
}

export function checkForUndefinedVariablesAndTransformAssignmentsToPropagateBackNewValue(
  program: es.Program,
  skipErrors = false,
  nativeStorage: NativeStorage,
  globalIds: NativeIds
) {
  const globalEnvironment = nativeStorage.globals
  const previousVariablesToAst = new Map<
    string,
    { isConstant: boolean; variableLocationId: es.Expression }
  >()
  let variableScope = globalEnvironment
  let variableScopeId: es.Expression = globalIds.globals
  while (variableScope !== null) {
    for (const [name, { kind }] of variableScope.variables) {
      if (!previousVariablesToAst.has(name)) {
        previousVariablesToAst.set(name, {
          isConstant: kind === 'const',
          variableLocationId: create.callExpression(
            create.memberExpression(create.memberExpression(variableScopeId, 'variables'), 'get'),
            [create.literal(name)]
          )
        })
      }
    }
    variableScope = variableScope.previousScope
    variableScopeId = create.memberExpression(variableScopeId, 'previousScope')
  }
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') {
      break
    }
    const symbols = node.specifiers.map(specifier => specifier.local.name)
    for (const symbol of symbols) {
      previousVariablesToAst.set(symbol, {
        isConstant: true,
        variableLocationId: create.literal(-1)
      })
    }
  }
  const identifiersIntroducedByNode = new Map<es.Node, Set<string>>()
  function processBlock(node: es.Program | es.BlockStatement) {
    const identifiers = new Set<string>()
    for (const statement of node.body) {
      if (statement.type === 'VariableDeclaration') {
        identifiers.add((statement.declarations[0].id as es.Identifier).name)
      } else if (statement.type === 'FunctionDeclaration') {
        identifiers.add((statement.id as es.Identifier).name)
      }
    }
    identifiersIntroducedByNode.set(node, identifiers)
  }
  function processFunction(
    node: es.FunctionDeclaration | es.ArrowFunctionExpression,
    ancestors: es.Node[]
  ) {
    identifiersIntroducedByNode.set(
      node,
      new Set((node.params as es.Identifier[]).map(id => id.name))
    )
  }
  const identifiersToAncestors = new Map<es.Identifier, es.Node[]>()
  ancestor(program, {
    Program: processBlock,
    BlockStatement: processBlock,
    FunctionDeclaration: processFunction,
    ArrowFunctionExpression: processFunction,
    ForStatement(forStatement: es.ForStatement, ancestors: es.Node[]) {
      const init = forStatement.init!
      if (init.type === 'VariableDeclaration') {
        identifiersIntroducedByNode.set(
          forStatement,
          new Set([(init.declarations[0].id as es.Identifier).name])
        )
      }
    },
    Identifier(identifier: es.Identifier, ancestors: es.Node[]) {
      identifiersToAncestors.set(identifier, [...ancestors])
    },
    Pattern(node: es.Pattern, ancestors: es.Node[]) {
      if (node.type === 'Identifier') {
        identifiersToAncestors.set(node, [...ancestors])
      } else if (node.type === 'MemberExpression') {
        if (node.object.type === 'Identifier') {
          identifiersToAncestors.set(node.object, [...ancestors])
        }
      }
    }
  })
  const nativeInternalNames = new Set(Object.values(globalIds).map(({ name }) => name))

  for (const [identifier, ancestors] of identifiersToAncestors) {
    const name = identifier.name
    const isCurrentlyDeclared = ancestors.some(a => identifiersIntroducedByNode.get(a)?.has(name))
    if (!isCurrentlyDeclared) {
      if (previousVariablesToAst.has(name)) {
        const lastAncestor: es.Node = ancestors[ancestors.length - 2]
        const { isConstant, variableLocationId } = previousVariablesToAst.get(name)!
        if (lastAncestor.type === 'AssignmentExpression' && lastAncestor.left === identifier) {
          // if this is an assignment expression, we want to propagate back the change
          if (isConstant) {
            throw new ConstAssignment(identifier, name)
          } else {
            lastAncestor.right = create.callExpression(
              create.memberExpression(variableLocationId, 'assignNewValue'),
              [lastAncestor.right]
            )
          }
        } else {
          /**
           * if this is not the left side of an assignment expression, we need to replace this with
           * the actual value stored in the correct scope, as calling functions defined in a
           * previous block might have side effects that change the variable.
           * e.g.
           * // first eval:
           * let counter = 0;
           * function f() {
           *   counter = counter + 1;
           * }
           * becomes
           * let counter = 0;
           * function f() {
           *   counter = counter + 1;
           * }
           * variables.set("counter", getValue: ()=>counter, assignNewValue: newValue => counter = newValue);
           * // second eval (wrong):
           * f(); counter;
           * becomes
           * let counter = variables.get("counter").getValue(); // set back counter;
           * {
           *   f(); // this has a side effect of incrementing counter
           *   return counter; // that does not get propagated here
           * }
           * // second eval (fixed):
           * f(); counter;
           * becomes
           * let counter = variables.get("counter").getValue(); // set back counter;
           * {
           *   f(); // this has a side effect of incrementing counter
           *   return (counter = variables.get("counter").getValue()); // we have no choice but to
           *    // always assume that counter is updated through a side effect and always retrieve its
           *    // real value
           * }
           */
          if (!isConstant) {
            // if it is a constant, it will definitely not mutate so above change is not needed
            const toExpression: es.AssignmentExpression = (identifier as unknown) as es.AssignmentExpression
            toExpression.type = 'AssignmentExpression'
            toExpression.operator = '='
            toExpression.left = create.identifier(name)
            toExpression.right = create.callExpression(
              create.memberExpression(variableLocationId, 'getValue'),
              []
            )
          }
        }
      } else if (!nativeInternalNames.has(name)) {
        if (!skipErrors) {
          throw new UndefinedVariable(name, identifier)
        }
      }
    }
  }
}

function transformSomeExpressionsToCheckIfBoolean(program: es.Program, globalIds: NativeIds) {
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
    node[test] = create.callExpression(globalIds.boolOrErr, [
      node[test],
      create.literal(line),
      create.literal(column)
    ])
  }

  simple(program, {
    IfStatement: transform,
    ConditionalExpression: transform,
    LogicalExpression: transform,
    ForStatement: transform,
    WhileStatement: transform
  })
}

function getNativeIds(program: es.Program, usedIdentifiers: Set<string>): NativeIds {
  const globalIds = {}
  for (const identifier of globalIdNames) {
    globalIds[identifier] = create.identifier(getUniqueId(usedIdentifiers, identifier))
  }
  return globalIds as NativeIds
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
  lastStatement: es.Statement,
  globalIds: NativeIds
): { lastStatementStoredInResult: es.Statement; evalMap?: RawSourceMap } {
  if (lastStatement.type === 'VariableDeclaration') {
    return {
      lastStatementStoredInResult: lastStatement
    }
  }
  const map = new SourceMapGenerator({ file: 'lastline' })
  const lastStatementAsCode = generate(lastStatement, { lineEnd: ' ', sourceMap: map, version: 3 })
  const uniqueDeclarationToStoreLastStatementResult = create.expressionStatement(
    create.assignmentExpression(
      globalIds.lastStatementResult,
      create.callExpression(create.identifier('eval'), [
        create.literal(lastStatementAsCode, lastStatement.loc!)
      ])
    )
  )
  return {
    lastStatementStoredInResult: uniqueDeclarationToStoreLastStatementResult,
    evalMap: map.toJSON()
  }
}

function transformUnaryAndBinaryOperationsToFunctionCalls(
  program: es.Program,
  globalIds: NativeIds,
  chapter: number
) {
  simple(program, {
    BinaryExpression(node: es.BinaryExpression) {
      const { line, column } = node.loc!.start
      const { operator, left, right } = node
      create.mutateToCallExpression(node, globalIds.binaryOp, [
        create.literal(operator),
        create.literal(chapter),
        left,
        right,
        create.literal(line),
        create.literal(column)
      ])
    },
    UnaryExpression(node: es.UnaryExpression) {
      const { line, column } = node.loc!.start
      const { operator, argument } = node as es.UnaryExpression
      create.mutateToCallExpression(node, globalIds.unaryOp, [
        create.literal(operator),
        argument,
        create.literal(line),
        create.literal(column)
      ])
    }
  })
}

function getComputedProperty(computed: boolean, property: es.Expression): es.Expression {
  return computed ? property : create.literal((property as es.Identifier).name)
}

function transformPropertyAssignment(program: es.Program, globalIds: NativeIds) {
  simple(program, {
    AssignmentExpression(node: es.AssignmentExpression) {
      if (node.left.type === 'MemberExpression') {
        const { object, property, computed, loc } = node.left
        const { line, column } = loc!.start
        create.mutateToCallExpression(node, globalIds.setProp, [
          object as es.Expression,
          getComputedProperty(computed, property),
          node.right,
          create.literal(line),
          create.literal(column)
        ])
      }
    }
  })
}

function transformPropertyAccess(program: es.Program, globalIds: NativeIds) {
  simple(program, {
    MemberExpression(node: es.MemberExpression) {
      const { object, property, computed, loc } = node
      const { line, column } = loc!.start
      create.mutateToCallExpression(node, globalIds.getProp, [
        object as es.Expression,
        getComputedProperty(computed, property),
        create.literal(line),
        create.literal(column)
      ])
    }
  })
}

function addInfiniteLoopProtection(
  program: es.Program,
  globalIds: NativeIds,
  usedIdentifiers: Set<string>
) {
  const getTimeAst = () => create.callExpression(create.identifier('get_time'), [])

  function instrumentLoops(node: es.Program | es.BlockStatement) {
    const newStatements = []
    for (const statement of node.body) {
      if (statement.type === 'ForStatement' || statement.type === 'WhileStatement') {
        const startTimeConst = getUniqueId(usedIdentifiers, 'startTime')
        newStatements.push(create.constantDeclaration(startTimeConst, getTimeAst()))
        if (statement.body.type === 'BlockStatement') {
          const { line, column } = statement.loc!.start
          statement.body.body.unshift(
            create.expressionStatement(
              create.callExpression(globalIds.throwIfTimeout, [
                globalIds.native,
                create.identifier(startTimeConst),
                getTimeAst(),
                create.literal(line),
                create.literal(column)
              ])
            )
          )
        }
      }
      newStatements.push(statement)
    }
    node.body = newStatements
  }

  simple(program, {
    Program: instrumentLoops,
    BlockStatement: instrumentLoops
  })
}

export function transpile(
  program: es.Program,
  context: Context,
  skipUndefinedVariableErrors = false
) {
  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInProgram(program),
    ...getIdentifiersInNativeStorage(context.nativeStorage)
  ])
  const globalIds = getNativeIds(program, usedIdentifiers)
  context.nativeStorage.globals = {
    variables: new Map(),
    previousScope: context.nativeStorage.globals
  }
  if (program.body.length === 0) {
    return { transpiled: '' }
  }

  const functionsToStringMap = generateFunctionsToStringMap(program)

  transformReturnStatementsToAllowProperTailCalls(program)
  transformCallExpressionsToCheckIfFunction(program, globalIds)
  transformUnaryAndBinaryOperationsToFunctionCalls(program, globalIds, context.chapter)
  transformSomeExpressionsToCheckIfBoolean(program, globalIds)
  transformPropertyAssignment(program, globalIds)
  transformPropertyAccess(program, globalIds)
  checkForUndefinedVariablesAndTransformAssignmentsToPropagateBackNewValue(
    program,
    skipUndefinedVariableErrors,
    context.nativeStorage,
    globalIds
  )
  transformFunctionDeclarationsToArrowFunctions(program, functionsToStringMap)
  wrapArrowFunctionsToAllowNormalCallsAndNiceToString(program, functionsToStringMap, globalIds)
  addInfiniteLoopProtection(program, globalIds, usedIdentifiers)

  const modulePrefix = prefixModule(program)
  transformImportDeclarations(program)
  const statementsToSaveDeclaredGlobals = createStatementsToStoreCurrentlyDeclaredGlobals(
    program,
    globalIds,
    usedIdentifiers
  )
  const statements = program.body as es.Statement[]
  const lastStatement = statements.pop() as es.Statement
  const {
    lastStatementStoredInResult,
    evalMap
  } = splitLastStatementIntoStorageOfResultAndAccessorPair(lastStatement, globalIds)

  const body = [
    wrapWithPreviouslyDeclaredGlobals(
      [...statements, lastStatementStoredInResult, ...statementsToSaveDeclaredGlobals],
      context.nativeStorage,
      globalIds
    ),
    create.expressionStatement(globalIds.lastStatementResult)
  ]

  program.body = [...getDeclarationsToAccessTranspilerInternals(globalIds), ...body]

  const map = new SourceMapGenerator({ file: 'source' })
  const transpiled = modulePrefix + generate(program, { sourceMap: map })
  const codeMap = map.toJSON()
  return { transpiled, codeMap, evalMap }
}

function getDeclarationsToAccessTranspilerInternals(
  globalIds: NativeIds
): es.VariableDeclaration[] {
  return Object.entries(globalIds).map(([key, { name }]) => {
    let value: es.Expression
    let kind: AllowedDeclarations = 'const'
    if (key === 'native') {
      value = create.identifier(NATIVE_STORAGE_ID)
    } else if (key === 'lastStatementResult') {
      value = create.primitive(undefined)
      kind = 'let'
    } else if (key === 'globals') {
      value = create.memberExpression(globalIds.native, 'globals')
    } else {
      value = create.callExpression(
        create.memberExpression(create.memberExpression(globalIds.native, 'operators'), 'get'),
        [create.literal(key)]
      )
    }
    return create.declaration(name, kind, value)
  })
}
