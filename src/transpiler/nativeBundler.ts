import { generate } from 'astring'
import type es from 'estree'
import { partial } from 'lodash'

import { Context } from '..'
import { NATIVE_STORAGE_ID, UNKNOWN_LOCATION } from '../constants'
import { Bundler } from '../modules/preprocessor/bundler'
import { Chapter } from '../types'
import assert from '../utils/assert'
import * as ast from '../utils/ast/astCreator'
import {
  getIdsFromDeclaration,
  getImportedName,
  getModuleDeclarationSource
} from '../utils/ast/helpers'
import { isModuleDeclaration, isNamespaceSpecifier } from '../utils/ast/typeGuards'
import {
  getIdentifiersInNativeStorage,
  getIdentifiersInProgram,
  getUniqueId
} from '../utils/uniqueIds'
import { simple } from '../utils/walkers'
import { NativeIds } from './transpiler'

type ExportPair = [string, es.Expression] | es.SpreadElement
type NativeBundler = (
  fileTranspiler: FileTranspiler,
  ...args: Parameters<Bundler>
) => ReturnType<Bundler>

type FileTranspiler = (
  program: es.Program,
  usedIdentifiers: Set<string>,
  context: Context
) => es.Program

function getNativeEvaller(usedIdentifiers: Set<string>) {
  const evallerId = ast.identifier(getUniqueId(usedIdentifiers, '__PROGRAM__'))
  return ast.expressionStatement(
    ast.assignmentExpression(
      ast.memberExpression(ast.identifier(NATIVE_STORAGE_ID), 'evaller'),
      ast.arrowFunctionExpression(
        [evallerId],
        ast.callExpression(ast.identifier('eval'), [evallerId])
      )
    )
  )
}

function processModuleDeclarations(
  program: es.Program,
  modulesObj: es.Expression
): [(es.Statement | es.Declaration)[], ExportPair[]] {
  return program.body.reduce(
    ([nodes, pairs], node) => {
      if (node.type === 'ExportDefaultDeclaration') {
        switch (node.declaration.type) {
          case 'ClassDeclaration':
          case 'FunctionDeclaration': {
            if (node.declaration.id) {
              return [
                [node.declaration, ...nodes],
                [...pairs, ['default', node.declaration.id] as ExportPair]
              ]
            }

            // Case falls through
          }
        }

        return [nodes, [...pairs, ['default', node.declaration] as ExportPair]]
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          const exportedExprs = getIdsFromDeclaration(node.declaration).map(id => {
            assert(id !== null, 'Encountered a null identifier')
            return [id.name, id] as ExportPair
          })
          return [
            [...nodes, node.declaration],
            [...pairs, ...exportedExprs]
          ]
        }

        if (!node.source) {
          return [
            nodes,
            [
              ...pairs,
              ...node.specifiers.map(spec => [spec.exported.name, spec.local] as ExportPair)
            ]
          ]
        }
      } else if (!isModuleDeclaration(node)) {
        return [[...nodes, node], pairs]
      }

      const source = getModuleDeclarationSource(node)
      const moduleExpr = ast.memberExpression(modulesObj, source)

      switch (node.type) {
        case 'ExportAllDeclaration':
          return [
            nodes,
            [
              ...pairs,
              (node.exported
                ? [node.exported.name, moduleExpr]
                : {
                    type: 'SpreadElement',
                    argument: moduleExpr
                  }) as ExportPair
            ]
          ]
        case 'ExportNamedDeclaration':
          return [
            nodes,
            [
              ...pairs,
              ...node.specifiers.map(
                spec =>
                  [
                    spec.exported.name,
                    ast.memberExpression(moduleExpr, spec.local.name)
                  ] as ExportPair
              )
            ]
          ]
        case 'ImportDeclaration':
          return [
            [
              ...node.specifiers.map(spec => {
                if (isNamespaceSpecifier(spec)) {
                  return ast.constantDeclaration(
                    spec.local.name,
                    ast.memberExpression(moduleExpr, 'rawBundle')
                  )
                }

                return ast.constantDeclaration(
                  spec.local.name,
                  ast.callExpression(ast.memberExpression(moduleExpr, 'getWithName'), [
                    ast.literal(getImportedName(spec)),
                    ast.literal(spec.local.name)
                  ])
                )
              }),
              ...nodes
            ],
            pairs
          ]
      }
    },
    [[], []] as [(es.Statement | es.Declaration)[], ExportPair[]]
  )
}

const sourceFileBundler: FileTranspiler = (program, usedIdentifiers, context: Context) => {
  if (program.body.length === 0) return program

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
        const asArrowFunction = ast.blockArrowFunction(params as es.Identifier[], body)
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
          ast.mutateToCallExpression(node, globalIds.wrap, [
            { ...node },
            ast.literal(functionsToStringMap.get(node)!),
            ast.literal(node.params[node.params.length - 1]?.type === 'RestElement'),

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
          return ast.logicalExpression(
            expression.operator,
            expression.left,
            transformLogicalExpression(expression.right),
            expression.loc
          )
        case 'ConditionalExpression':
          return ast.conditionalExpression(
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

          return ast.objectExpression([
            ast.property('isTail', ast.literal(true)),
            ast.property('function', expression.callee as es.Expression),
            ast.property('functionName', ast.literal(functionName)),
            ast.property('arguments', ast.arrayExpression(args as es.Expression[])),
            ast.property('line', ast.literal(line)),
            ast.property('column', ast.literal(column)),
            ast.property('source', ast.literal(source))
          ])
        default:
          return ast.objectExpression([
            ast.property('isTail', ast.literal(false)),
            ast.property('value', expression)
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
          ast.literal(line),
          ast.literal(column),
          ast.literal(source),
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
      node[test] = ast.callExpression(globalIds.boolOrErr, [
        node[test],
        ast.literal(line),
        ast.literal(column),
        ast.literal(source)
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
        ast.mutateToCallExpression(node, globalIds.binaryOp, [
          ast.literal(operator),
          ast.literal(chapter),
          left,
          right,
          ast.literal(line),
          ast.literal(column),
          ast.literal(source)
        ])
      },
      UnaryExpression(node: es.UnaryExpression) {
        const { line, column } = (node.loc ?? UNKNOWN_LOCATION).start
        const source = node.loc?.source ?? null
        const { operator, argument } = node as es.UnaryExpression
        ast.mutateToCallExpression(node, globalIds.unaryOp, [
          ast.literal(operator),
          argument,
          ast.literal(line),
          ast.literal(column),
          ast.literal(source)
        ])
      }
    })
  }

  function getComputedProperty(computed: boolean, property: es.Expression): es.Expression {
    return computed ? property : ast.literal((property as es.Identifier).name)
  }

  function transformPropertyAssignment(program: es.Program, globalIds: NativeIds) {
    simple(program, {
      AssignmentExpression(node: es.AssignmentExpression) {
        if (node.left.type === 'MemberExpression') {
          const { object, property, computed, loc } = node.left
          const { line, column } = (loc ?? UNKNOWN_LOCATION).start
          const source = loc?.source ?? null
          ast.mutateToCallExpression(node, globalIds.setProp, [
            object as es.Expression,
            getComputedProperty(computed, property as es.Expression),
            node.right,
            ast.literal(line),
            ast.literal(column),
            ast.literal(source)
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
        ast.mutateToCallExpression(node, globalIds.getProp, [
          object as es.Expression,
          getComputedProperty(computed, property as es.Expression),
          ast.literal(line),
          ast.literal(column),
          ast.literal(source)
        ])
      }
    })
  }

  function addInfiniteLoopProtection(
    program: es.Program,
    globalIds: NativeIds,
    usedIdentifiers: Set<string>
  ) {
    const getTimeAst = () => ast.callExpression(ast.identifier('get_time'), [])

    function instrumentLoops(node: es.Program | es.BlockStatement) {
      const newStatements = []
      for (const statement of node.body) {
        if (statement.type === 'ForStatement' || statement.type === 'WhileStatement') {
          const startTimeConst = getUniqueId(usedIdentifiers, 'startTime')
          newStatements.push(ast.constantDeclaration(startTimeConst, getTimeAst()))
          if (statement.body.type === 'BlockStatement') {
            const { line, column } = (statement.loc ?? UNKNOWN_LOCATION).start
            const source = statement.loc?.source ?? null
            statement.body.body.unshift(
              ast.expressionStatement(
                ast.callExpression(globalIds.throwIfTimeout, [
                  globalIds.native,
                  ast.identifier(startTimeConst),
                  getTimeAst(),
                  ast.literal(line),
                  ast.literal(column),
                  ast.literal(source)
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

  function getDeclarationsToAccessTranspilerInternals(
    globalIds: NativeIds
  ): es.VariableDeclaration[] {
    return Object.entries(globalIds).map(([key, { name }]) => {
      let value: es.Expression

      if (key === 'native') {
        value = ast.identifier(NATIVE_STORAGE_ID)
      } else if (key === 'globals') {
        value = ast.memberExpression(globalIds.native, 'globals')
      } else {
        value = ast.callExpression(
          ast.memberExpression(ast.memberExpression(globalIds.native, 'operators'), 'get'),
          [ast.literal(key)]
        )
      }
      return ast.constantDeclaration(name, value)
    })
  }

  function getNativeIds(program: es.Program, usedIdentifiers: Set<string>): NativeIds {
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

    return Object.values(globalIdNames).reduce(
      (res, id) => ({
        ...res,
        [id]: ast.identifier(getUniqueId(usedIdentifiers, id))
      }),
      {} as NativeIds
    )
  }

  const globalIds = getNativeIds(program, usedIdentifiers)

  const functionsToStringMap = generateFunctionsToStringMap(program)

  transformReturnStatementsToAllowProperTailCalls(program)
  transformCallExpressionsToCheckIfFunction(program, globalIds)
  transformUnaryAndBinaryOperationsToFunctionCalls(program, globalIds, context.chapter)
  transformSomeExpressionsToCheckIfBoolean(program, globalIds)
  transformPropertyAssignment(program, globalIds)
  transformPropertyAccess(program, globalIds)
  // checkForUndefinedVariables(program, context.nativeStorage, globalIds, skipUndefined)
  transformFunctionDeclarationsToArrowFunctions(program, functionsToStringMap)
  wrapArrowFunctionsToAllowNormalCallsAndNiceToString(program, functionsToStringMap, globalIds)
  addInfiniteLoopProtection(program, globalIds, usedIdentifiers)

  return ast.program([...getDeclarationsToAccessTranspilerInternals(globalIds), ...program.body])
}

const nativeBundler: NativeBundler = (
  fileTranspiler,
  programs,
  context,
  entrypointFilePath,
  topoOrder
) => {
  function bundleFileToCallExpression(
    programName: string,
    globalIdentifiers: Set<string>,
    includeExports: boolean
  ) {
    const program = programs[programName]
    const localIdentifiers = new Set([...globalIdentifiers, ...getIdentifiersInProgram(program)])

    const modulesObj = ast.identifier(getUniqueId(localIdentifiers, '__MODULES__'))
    const [newBody, exportPairs] = processModuleDeclarations(
      fileTranspiler(program, localIdentifiers, context),
      modulesObj
    )

    if (includeExports) {
      newBody.push(
        ast.expressionStatement(
          ast.assignmentExpression(
            ast.computedMemberExpression(modulesObj, programName),
            ast.objectExpression(
              exportPairs.map(each => {
                if (Array.isArray(each)) {
                  return ast.property(each[0], each[1])
                }
                return each
              })
            )
          )
        )
      )
    }

    return ast.arrowFunctionExpression([modulesObj], ast.blockStatement(newBody))
  }

  const entrypointProgram = programs[entrypointFilePath]
  const usedIdentifiers = new Set<string>([
    ...getIdentifiersInNativeStorage(context.nativeStorage),
    ...getIdentifiersInProgram(entrypointProgram)
  ])

  const [entrypointTranspiled] = processModuleDeclarations(
    fileTranspiler(entrypointProgram, usedIdentifiers, context),
    ast.memberExpression(ast.identifier(NATIVE_STORAGE_ID), 'loadedModules')
  )

  const globModulesObj = ast.identifier(getUniqueId(usedIdentifiers, '__MODULES__'))

  const transpiledPrograms = topoOrder
    .filter(path => path !== entrypointFilePath)
    .map(programName => {
      const arrowFunc = bundleFileToCallExpression(programName, usedIdentifiers, true)
      return ast.expressionStatement(ast.callExpression(arrowFunc, [globModulesObj]))
    })

  const builtins: (es.Statement | es.Declaration)[] = []

  if (!context.nativeStorage.evaller) {
    for (const builtin of context.nativeStorage.builtins.keys()) {
      builtins.push(
        ast.constantDeclaration(
          builtin,
          ast.callExpression(
            ast.memberExpression(
              ast.memberExpression(ast.identifier(NATIVE_STORAGE_ID), 'builtins'),
              'get'
            ),
            [ast.literal(builtin)]
          )
        )
      )
    }

    // And add prelude?
  }

  return ast.program([
    ...builtins,
    ...transpiledPrograms,
    ast.blockStatement([
      getNativeEvaller(usedIdentifiers),
      ast.expressionStatement(ast.identifier('undefined')),
      ...entrypointTranspiled
    ])
  ])
}

export const bundleToFullJS: Bundler = partial(nativeBundler, x => x)
export const bundleToSource: Bundler = partial(nativeBundler, sourceFileBundler)
