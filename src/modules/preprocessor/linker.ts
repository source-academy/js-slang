import type es from 'estree'
import { memoize } from 'lodash'

import type { Context } from '../..'
import { parse } from '../../parser/parser'
import type { RecursivePartial } from '../../types'
import assert from '../../utils/assert'
import { CircularImportError, ModuleNotFoundError } from '../errors'
import type { AbsolutePath, FileGetter } from '../moduleTypes'
import { DirectedGraph } from './directedGraph'
import resolveFile, { defaultResolutionOptions, type ImportResolutionOptions } from './resolver'

type ModuleDeclarationWithSource = Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>

/**
 * Helper error type. Thrown to cause any Promise.all calls
 * to reject immediately instead of just returning undefined,
 * which would still require all promises to be resolved
 */
class LinkerError extends Error {}

export type LinkerResult = {
  programs: Record<AbsolutePath, es.Program>
  sourceModulesToImport: Set<string>
  topoOrder: AbsolutePath[]
}

export type LinkerOptions = {
  /**
   * Options to pass to `resolveFile`
   */
  resolverOptions: ImportResolutionOptions

  /**
   * Set to true to memoize the file getter passed to
   * the linker (useful if reading using `fs`)
   */
  memoizeGetter: boolean
}

export const defaultLinkerOptions: LinkerOptions = {
  resolverOptions: defaultResolutionOptions,
  memoizeGetter: false
}

/**
 * Starting from the entrypoint file, parse all imported local modules and create
 * a dependency graph.
 *
 * @param fileGetter A function that, when given a file path, either returns the contents
 * of that file as a string, or if it doesn't exist, `undefined`
 *
 * @param shouldAddFileName Set to `true` if file name information should be included
 * when parsing files
 */
export default async function parseProgramsAndConstructImportGraph(
  fileGetter: FileGetter,
  entrypointFilePath: AbsolutePath,
  context: Context,
  options: RecursivePartial<LinkerOptions> = defaultLinkerOptions,
  shouldAddFileName: boolean
): Promise<LinkerResult | undefined> {
  const importGraph = new DirectedGraph()
  const programs: Record<string, es.Program> = {}
  const sourceModulesToImport = new Set<string>()
  const getter = options.memoizeGetter ? memoize(fileGetter) : fileGetter

  // Wrapper around resolve file to make calling it more convenient
  async function resolveFileWrapper(fromPath: AbsolutePath, toPath: string, node?: es.Node) {
    const resolveResult = await resolveFile(
      fromPath,
      toPath,
      async str => {
        const file = await getter(str)
        return file !== undefined
      },
      options?.resolverOptions
    )

    if (!resolveResult) {
      throw new ModuleNotFoundError(toPath, node)
    }

    const { path: absPath } = resolveResult

    // Special case of circular import: the module specifier
    // refers to the current file
    if (absPath === fromPath) {
      throw new CircularImportError([absPath, absPath])
    }

    return resolveResult
  }

  async function resolveDependency(fromModule: AbsolutePath, node: ModuleDeclarationWithSource) {
    // TODO: Move file path validation here
    const { type: moduleType, path: absDstPath } = await resolveFileWrapper(
      fromModule,
      node.source!.value as string,
      node
    )

    // This condition can never be true: To see an existing edge
    // would require having to parse the fromModule again
    // But parseAndEnumerateModuleDeclarations already guards against this.

    // if (importGraph.hasEdge(absDstPath, fromModule)) {
    //   // If we've seen this edge before, then we must have a cycle
    //   // so exit early and proceed to locate the cycle
    //   throw new LinkerError(false)
    // }

    // Update the node's source value with the resolved path
    node.source!.value = absDstPath

    // We assume that Source modules always have to be loaded
    // first, so we don't need to add those to the import graph
    if (moduleType === 'source') {
      sourceModulesToImport.add(absDstPath)
    } else {
      importGraph.addEdge(absDstPath, fromModule)
      await parseAndEnumerateModuleDeclarations(absDstPath)
    }
  }

  async function parseAndEnumerateModuleDeclarations(fromModule: AbsolutePath) {
    // No need to parse programs we've already parsed before
    if (fromModule in programs) return

    const fileText = await getter(fromModule)
    assert(
      fileText !== undefined,
      "If the file does not exist, an error should've already been thrown"
    )
    const parseOptions = shouldAddFileName
      ? {
          sourceFile: fromModule
        }
      : {}

    const program = parse(fileText, context, parseOptions)
    if (!program) {
      // The program has syntax errors or something,
      // exit early
      throw new LinkerError()
    }

    programs[fromModule] = program

    // We only really need to pay attention to the first node that imports
    // from each specific module
    const modulesToNodeMap = program.body.reduce((res, node) => {
      switch (node.type) {
        case 'ExportNamedDeclaration': {
          if (!node.source) return res
          // case falls through!
        }
        case 'ImportDeclaration':
        case 'ExportAllDeclaration': {
          const sourceValue = node.source?.value
          assert(
            typeof sourceValue === 'string',
            `Expected type string for module source for ${node.type}, got ${sourceValue}`
          )

          if (sourceValue in res) return res
          return {
            ...res,
            [sourceValue]: resolveDependency(fromModule, node)
          }
        }
        default:
          return res
      }
    }, {} as Record<string, Promise<void>>)

    await Promise.all(Object.values(modulesToNodeMap))
  }

  try {
    const entrypointCode = await fileGetter(entrypointFilePath)
    if (entrypointCode === undefined) {
      throw new ModuleNotFoundError(entrypointFilePath)
    }

    await parseAndEnumerateModuleDeclarations(entrypointFilePath)

    const topologicalOrderResult = importGraph.getTopologicalOrder()
    if (!topologicalOrderResult.isValidTopologicalOrderFound) {
      context.errors.push(new CircularImportError(topologicalOrderResult.firstCycleFound))
      return undefined
    }

    return {
      topoOrder: topologicalOrderResult.topologicalOrder as AbsolutePath[],
      programs,
      sourceModulesToImport
    }
  } catch (error) {
    if (!(error instanceof LinkerError)) {
      // Any other error that occurs is just appended to the context
      // and we return undefined
      context.errors.push(error)
    }
    return undefined
  }
}
