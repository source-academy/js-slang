/* eslint-disable @typescript-eslint/no-unused-vars */
import { generate } from 'astring'
import * as es from 'estree'
import { partition } from 'lodash'
import { RawSourceMap, SourceMapGenerator } from 'source-map'

import { NATIVE_STORAGE_ID, REQUIRE_PROVIDER_ID, UNKNOWN_LOCATION } from '../constants'
import { memoizedGetModuleBundleAsync } from '../modules/moduleLoaderAsync'
import { ImportTransformOptions } from '../modules/moduleTypes'
import { initModuleContextAsync } from '../modules/utils'
import {
  AllowedDeclarations,
  Chapter,
  Context,
  NativeStorage,
  RecursivePartial,
  Variant
} from '../types'
import assert from '../utils/assert'
import * as create from '../utils/ast/astCreator'
import { isImportDeclaration } from '../utils/ast/typeGuards'
import { simple } from '../utils/ast/walkers'
import {
  getIdentifiersInNativeStorage,
  getIdentifiersInProgram,
  getUniqueId
} from '../utils/uniqueIds'
import checkForUndefinedVariables from './variableChecker'

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
  'wrapSourceModule',
  'unaryOp',
  'binaryOp',
  'throwIfTimeout',
  'setProp',
  'getProp',
  'builtins'
] as const

export type NativeIds = Record<typeof globalIdNames[number], es.Identifier>

export async function transformImportDeclarations(
  program: es.Program,
  usedIdentifiers: Set<string>,
  context: Context | null,
  { wrapModules, loadTabs }: ImportTransformOptions
): Promise<[string, es.VariableDeclaration[], es.Program['body']]> {
  const [importNodes, otherNodes] = partition(program.body, isImportDeclaration)

  if (importNodes.length === 0) return ['', [], otherNodes as es.Statement[]]

  const moduleToNodeMap = importNodes.reduce((res, node) => {
    const moduleName = node.source.value
    assert(
      typeof moduleName === 'string',
      `Expected ImportDeclaration to have a source of type string!, got ${moduleName}!`
    )

    if (!(moduleName in res)) res[moduleName] = []
    res[moduleName].push(node)
    node.specifiers.forEach(spec => usedIdentifiers.add(spec.local.name))
    return res
  }, {} as Record<string, es.ImportDeclaration[]>)

  const prefix: string[] = []
  const importNodeMap = await Promise.all(
    Object.entries(moduleToNodeMap).map(async ([moduleName, nodes]) => {
      const namespaced = getUniqueId(usedIdentifiers, '__MODULE__')

      const [text] = await Promise.all([
        memoizedGetModuleBundleAsync(moduleName),
        context
          ? initModuleContextAsync(moduleName, context, loadTabs, nodes[0])
          : Promise.resolve()
      ])
      const modifiedText = wrapModules
        ? `${NATIVE_STORAGE_ID}.operators.get("wrapSourceModule")("${moduleName}", ${text}, ${REQUIRE_PROVIDER_ID})`
        : `(${text})(${REQUIRE_PROVIDER_ID})`
      prefix.push(`const ${namespaced} = ${modifiedText}\n`)

      return [namespaced, nodes] as [string, es.ImportDeclaration[]]
    })
  )

  const declNodes = importNodeMap.flatMap(([namespaced, nodes]) => {
    return nodes.flatMap(node =>
      node.specifiers.map(specifier => {
        if (specifier.type !== 'ImportSpecifier') {
          throw new Error(`Expected import specifier, found: ${specifier.type}`)
        }

        // Convert each import specifier to its corresponding local variable declaration
        return create.constantDeclaration(
          specifier.local.name,
          create.memberExpression(create.identifier(namespaced), specifier.imported.name)
        )
      })
    )
  })

  return [prefix.join('\n'), declNodes, otherNodes as es.Statement[]]
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
          expression.loc
        )
      case 'ConditionalExpression':
        return create.conditionalExpression(
          expression.test,
          transformLogicalExpression(expression.consequent),
          transformLogicalExpression(expression.alternate),
          expression.loc
        )
      case 'CallExpression':
        expression = expression as es.CallExpression
        const { line, column } = (expression.loc ?? UNKNOWN_LOCATION).start
        const source = expression.loc?.source ?? null
        const functionName =
          expression.callee.type === 'Identifier' ? expression.callee.name : '<anonymous>'

        const args = expression.arguments

        return create.objectExpression([
          create.property('isTail', create.literal(true)),
          create.property('function', expression.callee as es.Expression),
          create.property('functionName', create.literal(functionName)),
          create.property('arguments', create.arrayExpression(args as es.Expression[])),
          create.property('line', create.literal(line)),
          create.property('column', create.literal(column)),
          create.property('source', create.literal(source))
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
      const { line, column } = (node.loc ?? UNKNOWN_LOCATION).start
      const source = node.loc?.source ?? null
      const args = node.arguments

      node.arguments = [
        node.callee as es.Expression,
        create.literal(line),
        create.literal(column),
        create.literal(source),
        ...args
      ]

      node.callee = globalIds.callIfFuncAndRightArgs
    }
  })
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
    const { line, column } = (node.loc ?? UNKNOWN_LOCATION).start
    const source = node.loc?.source ?? null
    const test = node.type === 'LogicalExpression' ? 'left' : 'test'
    node[test] = create.callExpression(globalIds.boolOrErr, [
      node[test],
      create.literal(line),
      create.literal(column),
      create.literal(source)
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
  chapter: Chapter
) {
  simple(program, {
    BinaryExpression(node: es.BinaryExpression) {
      const { line, column } = (node.loc ?? UNKNOWN_LOCATION).start
      const source = node.loc?.source ?? null
      const { operator, left, right } = node
      create.mutateToCallExpression(node, globalIds.binaryOp, [
        create.literal(operator),
        create.literal(chapter),
        left,
        right,
        create.literal(line),
        create.literal(column),
        create.literal(source)
      ])
    },
    UnaryExpression(node: es.UnaryExpression) {
      const { line, column } = (node.loc ?? UNKNOWN_LOCATION).start
      const source = node.loc?.source ?? null
      const { operator, argument } = node as es.UnaryExpression
      create.mutateToCallExpression(node, globalIds.unaryOp, [
        create.literal(operator),
        argument,
        create.literal(line),
        create.literal(column),
        create.literal(source)
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
        const { line, column } = (loc ?? UNKNOWN_LOCATION).start
        const source = loc?.source ?? null
        create.mutateToCallExpression(node, globalIds.setProp, [
          object as es.Expression,
          getComputedProperty(computed, property as es.Expression),
          node.right,
          create.literal(line),
          create.literal(column),
          create.literal(source)
        ])
      }
    }
  })
}

function transformPropertyAccess(program: es.Program, globalIds: NativeIds) {
  simple(program, {
    MemberExpression(node: es.MemberExpression) {
      const { object, property, computed, loc } = node
      const { line, column } = (loc ?? UNKNOWN_LOCATION).start
      const source = loc?.source ?? null
      create.mutateToCallExpression(node, globalIds.getProp, [
        object as es.Expression,
        getComputedProperty(computed, property as es.Expression),
        create.literal(line),
        create.literal(column),
        create.literal(source)
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
          const { line, column } = (statement.loc ?? UNKNOWN_LOCATION).start
          const source = statement.loc?.source ?? null
          statement.body.body.unshift(
            create.expressionStatement(
              create.callExpression(globalIds.throwIfTimeout, [
                globalIds.native,
                create.identifier(startTimeConst),
                getTimeAst(),
                create.literal(line),
                create.literal(column),
                create.literal(source)
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
export type TranspileOptions = ImportTransformOptions & { skipUndefined?: boolean }

async function transpileToSource(
  program: es.Program,
  context: Context,
  { skipUndefined, ...importOptions }: TranspileOptions
): Promise<TranspiledResult> {
  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInProgram(program),
    ...getIdentifiersInNativeStorage(context.nativeStorage)
  ])
  const globalIds = getNativeIds(program, usedIdentifiers)
  if (program.body.length === 0) {
    return { transpiled: '' }
  }

  if (!skipUndefined) {
    checkForUndefinedVariables(program, usedIdentifiers)
  }

  const functionsToStringMap = generateFunctionsToStringMap(program)

  transformReturnStatementsToAllowProperTailCalls(program)
  transformCallExpressionsToCheckIfFunction(program, globalIds)
  transformUnaryAndBinaryOperationsToFunctionCalls(program, globalIds, context.chapter)
  transformSomeExpressionsToCheckIfBoolean(program, globalIds)
  transformPropertyAssignment(program, globalIds)
  transformPropertyAccess(program, globalIds)
  transformFunctionDeclarationsToArrowFunctions(program, functionsToStringMap)
  wrapArrowFunctionsToAllowNormalCallsAndNiceToString(program, functionsToStringMap, globalIds)
  addInfiniteLoopProtection(program, globalIds, usedIdentifiers)

  const [modulePrefix, importNodes, otherNodes] = await transformImportDeclarations(
    program,
    usedIdentifiers,
    context,
    importOptions
  )
  program.body = (importNodes as es.Program['body']).concat(otherNodes)

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

async function transpileToFullJS(
  program: es.Program,
  context: Context,
  { skipUndefined, ...importOptions }: TranspileOptions
): Promise<TranspiledResult> {
  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInProgram(program),
    ...getIdentifiersInNativeStorage(context.nativeStorage)
  ])

  const globalIds = getNativeIds(program, usedIdentifiers)
  Object.keys(globalIds).forEach(id => usedIdentifiers.add(id))

  if (!skipUndefined) {
    const includingGlobals = new Set([...Object.keys(global), ...usedIdentifiers])
    checkForUndefinedVariables(program, includingGlobals)
  }

  const [modulePrefix, importNodes, otherNodes] = await transformImportDeclarations(
    program,
    usedIdentifiers,
    context,
    importOptions
  )

  getGloballyDeclaredIdentifiers(program).forEach(id =>
    context.nativeStorage.previousProgramsIdentifiers.add(id)
  )
  const transpiledProgram: es.Program = create.program([
    evallerReplacer(create.identifier(NATIVE_STORAGE_ID), new Set()),
    create.expressionStatement(create.identifier('undefined')),
    ...(importNodes as es.Statement[]),
    ...(otherNodes as es.Statement[])
  ])

  const sourceMap = new SourceMapGenerator({ file: 'source' })
  const transpiled = modulePrefix + generate(transpiledProgram, { sourceMap })
  const sourceMapJson = sourceMap.toJSON()

  return { transpiled, sourceMapJson }
}

export function transpile(
  program: es.Program,
  context: Context,
  options: RecursivePartial<TranspileOptions> = {}
): Promise<TranspiledResult> {
  if (context.chapter === Chapter.FULL_JS || context.chapter === Chapter.PYTHON_1) {
    return transpileToFullJS(program, context, {
      skipUndefined: true,
      loadTabs: true,
      wrapModules: false,
      ...options
    })
  } else if (context.variant == Variant.NATIVE) {
    return transpileToFullJS(program, context, {
      skipUndefined: false,
      loadTabs: true,
      wrapModules: true,
      ...options
    })
  } else {
    return transpileToSource(program, context, {
      skipUndefined: false,
      loadTabs: true,
      wrapModules: true,
      ...options
    })
  }
}
