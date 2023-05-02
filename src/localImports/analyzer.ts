import type * as es from 'estree'
import * as pathlib from 'path'
import { Context } from '..'
import {
  memoizedGetModuleBundleAsync,
  memoizedGetModuleDocsAsync
} from '../modules/moduleLoaderAsync'
import { parse } from '../parser/parser'
import { isDeclaration } from './typeGuards'
import {
  ModuleNotFoundError,
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../modules/errors'
import { CircularImportError, ReexportSymbolError } from '../errors/localImportErrors'
import assert from '../utils/assert'

class ArrayMap<K, V> {
  constructor(private readonly map: Map<K, V[]> = new Map()) {}

  public get(key: K) {
    return this.map.get(key)
  }

  public add(key: K, item: V) {
    if (!this.map.has(key)) {
      this.map.set(key, [])
    }
    this.map.get(key)!.push(item)
  }

  public entries() {
    return Array.from(this.map.entries())
  }

  public keys() {
    return new Set(this.map.keys())
  }
}

type LocalModuleInfo = {
  type: 'local'
  indegree: 0
  dependencies: Set<string>
  ast: es.Program
}

export type ResolvedLocalModuleInfo = LocalModuleInfo & {
  exports: Set<string>
}

type SourceModuleInfo = {
  type: 'source'
  exports: Set<string>
  text: string
  indegree: 0
}

type ModuleInfo = LocalModuleInfo | SourceModuleInfo
export type ResolvedModuleInfo = ResolvedLocalModuleInfo | SourceModuleInfo
export type AnalysisResult = {
  moduleInfos: Record<string, ResolvedModuleInfo>
  topoOrder: string[]
}

const isSourceImport = (path: string) => !path.startsWith('.') && !path.startsWith('/')

const analyzeImport = async (
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context
) => {
  function resolveModule(
    desiredPath: string,
    node: Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>
  ) {
    const source = node.source?.value
    if (typeof source !== 'string') {
      throw new Error(`${node.type} should have a source of type string, got ${source}`)
    }

    if (isSourceImport(source)) return source

    const modAbsPath = pathlib.resolve(desiredPath, '..', source)
    if (files[modAbsPath] !== undefined) return modAbsPath

    throw new ModuleNotFoundError(modAbsPath, node)
  }

  const moduleInfos: Record<string, ModuleInfo> = {}
  async function parseFile(desiredPath: string, currNode?: es.Node) {
    if (desiredPath in moduleInfos) {
      return
    }

    if (isSourceImport(desiredPath)) {
      const [bundleText, bundleDocs] = await Promise.all([
        memoizedGetModuleBundleAsync(desiredPath, currNode),
        memoizedGetModuleDocsAsync(desiredPath, currNode)
      ])

      if (!bundleDocs) {
        throw new Error()
      }

      moduleInfos[desiredPath] = {
        type: 'source',
        text: bundleText,
        exports: new Set(Object.keys(bundleDocs)),
        indegree: 0
      }
    } else {
      const code = files[desiredPath]!
      const program = parse(code, context, {}, true)!

      const dependencies = new Map<string, es.Node>()

      for (const node of program.body) {
        switch (node.type) {
          case 'ExportNamedDeclaration': {
            if (!node.source) continue
          }
          case 'ExportAllDeclaration':
          case 'ImportDeclaration': {
            const modAbsPath = resolveModule(desiredPath, node)
            if (modAbsPath === desiredPath) {
              throw new CircularImportError([modAbsPath, desiredPath])
            }

            node.source!.value = modAbsPath
            dependencies.set(modAbsPath, node)
            break
          }
        }
      }

      moduleInfos[desiredPath] = {
        type: 'local',
        indegree: 0,
        dependencies: new Set(dependencies.keys()),
        ast: program
      }

      await Promise.all(
        Array.from(dependencies.entries()).map(async ([dep, node]) => {
          await parseFile(dep, node)
          moduleInfos[dep].indegree++
        })
      )
    }
  }

  await parseFile(entrypointFilePath)
  return moduleInfos
}

const findCycle = (
  moduleInfos: Record<string, { indegree: number; dependencies: Set<string> }>
) => {
  // First, we pick any arbitrary node that is part of a cycle as our
  // starting node.
  const startingNodeInCycle = Object.keys(moduleInfos).find(
    name => moduleInfos[name].indegree !== 0
  )
  // By the invariant stated above, it is impossible that the starting
  // node cannot be found. The lack of a starting node implies that
  // all nodes have an in-degree of 0 after running Kahn's algorithm.
  // This in turn implies that Kahn's algorithm was able to find a
  // valid topological ordering & that the graph contains no cycles.
  assert(!!startingNodeInCycle, 'There are no cycles in this graph. This should never happen.')

  const cycle = [startingNodeInCycle]
  // Then, we keep picking arbitrary nodes with non-zero in-degrees until
  // we pick a node that has already been picked.
  while (true) {
    const currentNode = cycle[cycle.length - 1]
    const { dependencies: neighbours } = moduleInfos[currentNode]
    assert(
      neighbours !== undefined,
      'The keys of the adjacency list & the in-degree maps are not the same. This should never occur.'
    )

    // By the invariant stated above, it is impossible that any node
    // on the cycle has an in-degree of 0 after running Kahn's algorithm.
    // An in-degree of 0 implies that the node is not part of a cycle,
    // which is a contradiction since the current node was picked because
    // it is part of a cycle.
    assert(
      neighbours.size > 0,
      `Node '${currentNode}' has no incoming edges. This should never happen.`
    )

    const nextNodeInCycle = Array.from(neighbours).find(
      neighbour => moduleInfos[neighbour].indegree !== 0
    )

    // By the invariant stated above, if the current node is part of a cycle,
    // then one of its neighbours must also be part of the same cycle. This
    // is because a cycle contains at least 2 nodes.
    assert(
      !!nextNodeInCycle,
      `None of the neighbours of node '${currentNode}' are part of the same cycle. This should never happen.`
    )

    // If the next node we pick is already part of the cycle,
    // we drop all elements before the first instance of the
    // next node and return the cycle.
    const nextNodeIndex = cycle.indexOf(nextNodeInCycle)
    const isNodeAlreadyInCycle = nextNodeIndex !== -1
    cycle.push(nextNodeInCycle)
    if (isNodeAlreadyInCycle) {
      return cycle.slice(nextNodeIndex)
    }
  }
}

const getTopologicalOrder = (moduleInfos: Record<string, ModuleInfo>) => {
  const zeroDegrees = Object.entries(moduleInfos)
    .filter(([, { indegree }]) => indegree === 0)
    .map(([name]) => name)
  const dependencyMap = new Map<string, Set<string>>()

  for (const [name, info] of Object.entries(moduleInfos)) {
    if (info.type === 'local') {
      dependencyMap.set(name, info.dependencies)
    }
  }

  const moduleCount = Object.keys(moduleInfos).length
  const topoOrder = [...zeroDegrees]

  console.log(moduleInfos)

  for (let i = 0; i < moduleCount; i++) {
    if (zeroDegrees.length === 0) {
      const localModuleInfos = Object.entries(moduleInfos).reduce((res, [name, modInfo]) => {
        if (modInfo.type === 'source') return res
        return {
          ...res,
          [name]: {
            indegree: modInfo.indegree,
            dependencies: modInfo.dependencies
          }
        }
      }, {} as Record<string, { indegree: number; dependencies: Set<string> }>)

      const cycle = findCycle(localModuleInfos)
      throw new CircularImportError(cycle)
    }

    const node = zeroDegrees.pop()!
    const info = moduleInfos[node]
    if (info.type === 'source') continue
    const dependencies = dependencyMap.get(node)!

    if (!dependencies || dependencies.size === 0) {
      continue
    }

    for (const neighbour of dependencies.keys()) {
      const neighbourInfo = moduleInfos[neighbour]
      neighbourInfo.indegree--
      if (neighbourInfo.indegree === 0) {
        zeroDegrees.push(neighbour)
        topoOrder.unshift(neighbour)
      }
    }
  }
  return topoOrder
}

const validateDefaultImport = (
  spec: es.ImportDefaultSpecifier | es.ExportSpecifier | es.ImportSpecifier,
  sourcePath: string,
  modExported: Set<string>
) => {
  if (!modExported.has('default')) {
    throw new UndefinedDefaultImportError(sourcePath, spec)
  }
}

const validateImport = (
  spec: es.ImportSpecifier | es.ExportSpecifier,
  sourcePath: string,
  modExported: Set<string>
) => {
  const symbol = spec.type === 'ImportSpecifier' ? spec.imported.name : spec.local.name
  if (symbol === 'default') {
    validateDefaultImport(spec, sourcePath, modExported)
  } else if (!modExported.has(symbol)) {
    throw new UndefinedImportError(symbol, sourcePath, spec)
  }
}

const validateNamespaceImport = (
  spec: es.ImportNamespaceSpecifier | es.ExportAllDeclaration,
  sourcePath: string,
  modExported: Set<string>
) => {
  if (modExported.size === 0) {
    throw new UndefinedNamespaceImportError(sourcePath, spec)
  }
}

const validateImportAndExports = (
  moduleInfos: Record<string, ModuleInfo>,
  topoOrder: string[],
  allowUndefinedImports: boolean
) => {
  const resolvedModuleInfos: Record<string, ResolvedModuleInfo> = {}

  topoOrder.forEach(name => {
    const info = moduleInfos[name]
    if (info.type === 'source') {
      resolvedModuleInfos[name] = info
      return
    }

    const exportedSymbols = new ArrayMap<
      string,
      es.ImportSpecifier | es.ExportSpecifier | es.ModuleDeclaration
    >()
    info.ast.body.forEach(node => {
      switch (node.type) {
        case 'ImportDeclaration': {
          if (!allowUndefinedImports) {
            const { exports } = resolvedModuleInfos[node.source!.value as string]
            node.specifiers.forEach(spec => {
              switch (spec.type) {
                case 'ImportSpecifier': {
                  validateImport(spec, name, exports)
                  break
                }
                case 'ImportDefaultSpecifier': {
                  validateDefaultImport(spec, name, exports)
                  break
                }
                case 'ImportNamespaceSpecifier': {
                  validateNamespaceImport(spec, name, exports)
                  break
                }
              }
            })
          }
          break
        }
        case 'ExportDefaultDeclaration': {
          if (isDeclaration(node.declaration)) {
            if (node.declaration.type === 'VariableDeclaration') {
              throw new Error()
            }
            exportedSymbols.add('default', node)
          }
          break
        }
        case 'ExportNamedDeclaration': {
          if (node.declaration) {
            if (node.declaration.type === 'VariableDeclaration') {
            } else {
              exportedSymbols.add(node.declaration.id!.name, node)
            }
          } else if (node.source) {
            const { exports } = resolvedModuleInfos[node.source!.value as string]
            node.specifiers.forEach(spec => {
              if (!allowUndefinedImports) {
                validateImport(spec, name, exports)
              }

              exportedSymbols.add(spec.exported.name, spec)
            })
          } else {
            node.specifiers.forEach(spec => exportedSymbols.add(spec.exported.name, spec))
          }
          break
        }
        case 'ExportAllDeclaration': {
          const { exports } = resolvedModuleInfos[node.source!.value as string]
          if (!allowUndefinedImports) {
            validateNamespaceImport(node, name, exports)
          }
          if (node.exported) {
            exportedSymbols.add(node.exported.name, node)
          } else {
            for (const symbol of exports) {
              exportedSymbols.add(symbol, node)
            }
          }
          break
        }
      }
    })

    const exports = new Set(
      exportedSymbols.entries().map(([symbol, nodes]) => {
        if (nodes.length === 1) {
          return symbol
        }

        throw new ReexportSymbolError(name, symbol, nodes)
      })
    )

    resolvedModuleInfos[name] = {
      ...info,
      exports
    }
  })

  return resolvedModuleInfos
}

export default async function performImportAnalysis(
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context
): Promise<AnalysisResult> {
  const moduleInfos = await analyzeImport(files, entrypointFilePath, context)
  const topoOrder = getTopologicalOrder(moduleInfos)
  const resolvedInfos = validateImportAndExports(moduleInfos, topoOrder, false)
  return { moduleInfos: resolvedInfos, topoOrder }
}
