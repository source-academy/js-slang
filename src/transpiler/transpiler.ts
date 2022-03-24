/* eslint-disable @typescript-eslint/no-unused-vars */
import { generate } from 'astring'
import * as es from 'estree'
import { RawSourceMap, SourceMapGenerator } from 'source-map'

import { MODULE_CONTEXTS_ID, MODULE_PARAMS_ID, NATIVE_STORAGE_ID } from '../constants'
import { UndefinedVariable } from '../errors/errors'
import { memoizedGetModuleFile } from '../modules/moduleLoader'
import { isFullJSChapter } from '../runner'
import { AllowedDeclarations, Context, NativeStorage } from '../types'
import * as create from '../utils/astCreator'
import {
  getIdentifiersInNativeStorage,
  getIdentifiersInProgram,
  getUniqueId
} from '../utils/uniqueIds'
import { ancestor, simple } from '../utils/walkers'

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
  'builtins'
] as const

export type NativeIds = Record<typeof globalIdNames[number], es.Identifier>

export function prefixModule(program: es.Program): string {
  let moduleCounter = 0
  let prefix = ''
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') {
      break
    }
    const moduleText = memoizedGetModuleFile(node.source.value as string, 'bundle').trim()
    // remove ; from moduleText
    prefix += `const __MODULE_${moduleCounter}__ = (${moduleText.substring(
      0,
      moduleText.length - 1
    )})(${MODULE_PARAMS_ID}, ${MODULE_CONTEXTS_ID});\n`
    moduleCounter++
  }
  return prefix
}

/*
 * Hoists import statements in the program to the top
 * Also collates multiple import statements to a module into
 * a single statement
 */
export function hoistImportDeclarations(program: es.Program) {
  const importNodes = program.body.filter(
    node => node.type === 'ImportDeclaration'
  ) as es.ImportDeclaration[]
  const specifiers = new Map<
    string,
    (es.ImportSpecifier | es.ImportDefaultSpecifier | es.ImportNamespaceSpecifier)[]
  >()
  const baseNodes = new Map<string, es.ImportDeclaration>()

  for (const node of importNodes) {
    const moduleName = node.source.value as string

    if (!specifiers.has(moduleName)) {
      specifiers.set(moduleName, node.specifiers)
      baseNodes.set(moduleName, node)
    } else {
      for (const specifier of node.specifiers) {
        specifiers.get(moduleName)!.push(specifier)
      }
    }
  }

  const newImports = Array.from(baseNodes.entries()).map(([module, node]) => {
    return {
      ...node,
      specifiers: specifiers.get(module)
    }
  }) as (es.ModuleDeclaration | es.Statement | es.Declaration)[]

  program.body = newImports.concat(program.body.filter(node => node.type !== 'ImportDeclaration'))
}

export function transformSingleImportDeclaration(
  moduleCounter: number,
  node: es.ImportDeclaration,
  useThis = false
) {
  const result = []
  const tempNamespace = (useThis ? 'this.' : '') + `__MODULE_${moduleCounter}__`
  const neededSymbols = node.specifiers.map(specifier => {
    if (specifier.type !== 'ImportSpecifier') {
      throw new Error(
        `I expected only ImportSpecifiers to be allowed, but encountered ${specifier.type}.`
      )
    }

    return {
      imported: specifier.imported.name,
      local: specifier.local.name
    }
  })
  for (const symbol of neededSymbols) {
    result.push(
      create.constantDeclaration(
        symbol.local,
        create.memberExpression(create.identifier(tempNamespace), symbol.imported)
      )
    )
  }
  return result
}

// `useThis` is a temporary indicator used by fullJS
export function transformImportDeclarations(program: es.Program, useThis = false) {
  const imports = []
  let result: es.VariableDeclaration[] = []
  let moduleCounter = 0
  while (program.body.length > 0 && program.body[0].type === 'ImportDeclaration') {
    imports.push(program.body.shift() as es.ImportDeclaration)
  }
  for (const node of imports) {
    result = transformSingleImportDeclaration(moduleCounter, node, useThis).concat(result)
    moduleCounter++
  }
  program.body = (result as (es.Statement | es.ModuleDeclaration)[]).concat(program.body)
}

export function getGloballyDeclaredIdentifiers(program: es.Program): string[] {
  return program.body
    .filter(statement => statement.type === 'VariableDeclaration')
    .map(
      ({
        declarations: {
          0: { id }
        },
        kind
      }: es.VariableDeclaration) => (id as es.Identifier).name
    )
}

export function getBuiltins(nativeStorage: NativeStorage): es.Statement[] {
  const builtinsStatements: es.Statement[] = []
  nativeStorage.builtins.forEach((_unused, name: string) => {
    builtinsStatements.push(
      create.declaration(
        name,
        'const',
        create.callExpression(
          create.memberExpression(
            create.memberExpression(create.identifier(NATIVE_STORAGE_ID), 'builtins'),
            'get'
          ),
          [create.literal(name)]
        )
      )
    )
  })

  return builtinsStatements
}

export function evallerReplacer(
  nativeStorageId: NativeIds['native'],
  usedIdentifiers: Set<string>
): es.ExpressionStatement {
  const arg = create.identifier(getUniqueId(usedIdentifiers, 'program'))
  return create.expressionStatement(
    create.assignmentExpression(
      create.memberExpression(nativeStorageId, 'evaller'),
      create.arrowFunctionExpression([arg], create.callExpression(create.identifier('eval'), [arg]))
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
          create.literal(node.params[node.params.length - 1]?.type === 'RestElement'),

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

export function checkForUndefinedVariables(
  program: es.Program,
  nativeStorage: NativeStorage,
  globalIds: NativeIds,
  skipUndefined: boolean
) {
  const builtins = nativeStorage.builtins
  const identifiersIntroducedByNode = new Map<es.Node, Set<string>>()
  function processBlock(node: es.Program | es.BlockStatement) {
    const identifiers = new Set<string>()
    for (const statement of node.body) {
      if (statement.type === 'VariableDeclaration') {
        identifiers.add((statement.declarations[0].id as es.Identifier).name)
      } else if (statement.type === 'FunctionDeclaration') {
        identifiers.add((statement.id as es.Identifier).name)
      } else if (statement.type === 'ImportDeclaration') {
        for (const specifier of statement.specifiers) {
          identifiers.add(specifier.local.name)
        }
      }
    }
    identifiersIntroducedByNode.set(node, identifiers)
  }
  function processFunction(
    node: es.FunctionDeclaration | es.ArrowFunctionExpression,
    _ancestors: es.Node[]
  ) {
    identifiersIntroducedByNode.set(
      node,
      new Set(
        node.params.map(id =>
          id.type === 'Identifier'
            ? id.name
            : ((id as es.RestElement).argument as es.Identifier).name
        )
      )
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
    if (isCurrentlyDeclared) {
      continue
    }
    const isPreviouslyDeclared = nativeStorage.previousProgramsIdentifiers.has(name)
    if (isPreviouslyDeclared) {
      continue
    }
    const isBuiltin = builtins.has(name)
    if (isBuiltin) {
      continue
    }
    const isNativeId = nativeInternalNames.has(name)
    if (!isNativeId && !skipUndefined) {
      throw new UndefinedVariable(name, identifier)
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
          getComputedProperty(computed, property as es.Expression),
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
        getComputedProperty(computed, property as es.Expression),
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

function wrapWithBuiltins(statements: es.Statement[], nativeStorage: NativeStorage) {
  return create.blockStatement([...getBuiltins(nativeStorage), create.blockStatement(statements)])
}

function getDeclarationsToAccessTranspilerInternals(
  globalIds: NativeIds
): es.VariableDeclaration[] {
  return Object.entries(globalIds).map(([key, { name }]) => {
    let value: es.Expression
    const kind: AllowedDeclarations = 'const'
    if (key === 'native') {
      value = create.identifier(NATIVE_STORAGE_ID)
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

export type TranspiledResult = { transpiled: string; sourceMapJson?: RawSourceMap }

function transpileToSource(
  program: es.Program,
  context: Context,
  skipUndefined: boolean
): TranspiledResult {
  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInProgram(program),
    ...getIdentifiersInNativeStorage(context.nativeStorage)
  ])
  const globalIds = getNativeIds(program, usedIdentifiers)
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
  checkForUndefinedVariables(program, context.nativeStorage, globalIds, skipUndefined)
  transformFunctionDeclarationsToArrowFunctions(program, functionsToStringMap)
  wrapArrowFunctionsToAllowNormalCallsAndNiceToString(program, functionsToStringMap, globalIds)
  addInfiniteLoopProtection(program, globalIds, usedIdentifiers)

  const modulePrefix = prefixModule(program)
  transformImportDeclarations(program)
  getGloballyDeclaredIdentifiers(program).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id)
  )
  const statements = program.body as es.Statement[]
  const newStatements = [
    ...getDeclarationsToAccessTranspilerInternals(globalIds),
    evallerReplacer(globalIds.native, usedIdentifiers),
    create.expressionStatement(create.identifier('undefined')),
    ...statements
  ]

  program.body =
    context.nativeStorage.evaller === null
      ? [wrapWithBuiltins(newStatements, context.nativeStorage)]
      : [create.blockStatement(newStatements)]

  const map = new SourceMapGenerator({ file: 'source' })
  const transpiled = modulePrefix + generate(program, { sourceMap: map })
  const sourceMapJson = map.toJSON()
  return { transpiled, sourceMapJson }
}

function transpileToFullJS(program: es.Program): TranspiledResult {
  transformImportDeclarations(program)
  const transpiledProgram: es.Program = create.program([
    evallerReplacer(create.identifier(NATIVE_STORAGE_ID), new Set()),
    create.expressionStatement(create.identifier('undefined')),
    ...(program.body as es.Statement[])
  ])

  const sourceMap = new SourceMapGenerator({ file: 'source' })
  const transpiled = generate(transpiledProgram, { sourceMap })
  const sourceMapJson = sourceMap.toJSON()

  return { transpiled, sourceMapJson }
}

export function transpile(
  program: es.Program,
  context: Context,
  skipUndefined = false
): TranspiledResult {
  if (isFullJSChapter(context.chapter) || context.variant == 'native') {
    return transpileToFullJS(program)
  }

  return transpileToSource(program, context, skipUndefined)
}
