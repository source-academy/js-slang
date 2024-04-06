import type es from 'estree'

import type { Context } from '../..'
import { parse } from '../../parser/parser'
import type { RecursivePartial } from '../../types'
import { CircularImportError, ModuleNotFoundError } from '../errors'
import { getModuleDeclarationSource } from '../../utils/ast/helpers'
import type { FileGetter } from '../moduleTypes'
import { mapAndFilter } from '../../utils/misc'
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
  programs: Record<string, es.Program>
  sourceModulesToImport: Set<string>
  topoOrder: string[]
}

export type LinkerOptions = {
  resolverOptions: ImportResolutionOptions
}

export const defaultLinkerOptions: LinkerOptions = {
  resolverOptions: defaultResolutionOptions
}

/**
 * Starting from the entrypoint file, parse all imported local modules and create
 * a dependency graph.
 *
 * @param fileGetter A function that, when given a file path, either returns the contents
 * of that file as a string, or if it doesn't exist, `undefined`
 */
export default async function parseProgramsAndConstructImportGraph(
  fileGetter: FileGetter,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<LinkerOptions> = defaultLinkerOptions,
  shouldAddFileName: boolean
): Promise<LinkerResult | undefined> {
  const importGraph = new DirectedGraph()
  const programs: Record<string, es.Program> = {}
  const sourceModulesToImport = new Set<string>()

  // Wrapper around resolve file to make calling it more convenient
  async function resolveDependency(fromPath: string, node: ModuleDeclarationWithSource) {
    const toPath = getModuleDeclarationSource(node)

    const resolveResult = await resolveFile(fromPath, toPath, fileGetter, options.resolverOptions)

    if (!resolveResult) {
      throw new ModuleNotFoundError(toPath, node)
    }

    if (resolveResult.type === 'source') {
      // We can assume two things:
      // 1. Source modules do not depend on one another
      // 2. They will always be loaded first before any local modules
      // Thus it is not necessary to track them in the import graph
      sourceModulesToImport.add(toPath)
      return
    }

    const { absPath, contents } = resolveResult
    // Special case of circular import: the module specifier
    // refers to the current file
    if (absPath === fromPath) {
      throw new CircularImportError([absPath, absPath])
    }

    node.source!.value = absPath
    importGraph.addEdge(absPath, fromPath)

    // No need to parse programs we've already parsed before
    if (absPath in programs) return
    await parseAndEnumerateModuleDeclarations(absPath, contents)
  }

  async function parseAndEnumerateModuleDeclarations(fromModule: string, fileText: string) {
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

    await Promise.all(
      mapAndFilter(program.body, node => {
        switch (node.type) {
          case 'ExportNamedDeclaration': {
            if (!node.source) return undefined
            // case falls through!
          }
          case 'ImportDeclaration':
          case 'ExportAllDeclaration':
            // We still have to visit each node to update
            // each node's source value
            return resolveDependency(fromModule, node)
          default:
            return undefined
        }
      })
    )
  }

  try {
    const entrypointFileText = await fileGetter(entrypointFilePath)
    // Not using boolean test here, empty strings are valid programs
    // but are falsy
    if (entrypointFileText === undefined) {
      throw new ModuleNotFoundError(entrypointFilePath)
    }
    await parseAndEnumerateModuleDeclarations(entrypointFilePath, entrypointFileText)

    const topologicalOrderResult = importGraph.getTopologicalOrder()
    if (!topologicalOrderResult.isValidTopologicalOrderFound) {
      context.errors.push(new CircularImportError(topologicalOrderResult.firstCycleFound))
      return undefined
    }

    return {
      topoOrder: topologicalOrderResult.topologicalOrder,
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
