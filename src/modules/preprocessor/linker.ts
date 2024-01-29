import type es from 'estree'
import { posix as posixPath } from 'path'

import type { Context } from '../..'
import { parse } from '../../parser/parser'
import type { RecursivePartial } from '../../types'
import assert from '../../utils/assert'
import { mapAndFilter } from '../../utils/misc'
import { CircularImportError, ModuleNotFoundError } from '../errors'
import { isSourceModule } from '../utils'
import { DirectedGraph } from './directedGraph'
import resolveFile, { defaultResolutionOptions, type ImportResolutionOptions } from './resolver'

type ModuleDeclarationWithSource = Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>

/**
 * Helper error type. Thrown to cause any Promise.all calls
 * to reject immediately instead of just returning undefined,
 * which would still require all promises to be resolved
 */
class LinkerError extends Error {
  constructor(public readonly isProgramError: boolean) {
    super()
  }
}

export type LinkerResult = {
  programs: Record<string, es.Program>
  sourceModulesToImport: Set<string>
  entrypointAbsPath: string
  topoOrder: string[]
}

export type LinkerOptions = {
  resolverOptions: ImportResolutionOptions
}

export const defaultLinkerOptions: LinkerOptions = {
  resolverOptions: defaultResolutionOptions
}

function checkForCycle(graph: DirectedGraph) {
  // Check for circular imports.
  const topologicalOrderResult = graph.getTopologicalOrder()
  if (!topologicalOrderResult.isValidTopologicalOrderFound) {
    throw new CircularImportError(topologicalOrderResult.firstCycleFound)
  }

  return topologicalOrderResult.topologicalOrder
}

/**
 * Starting from the entrypoint file, parse all imported local modules and create
 * a dependency graph.
 *
 * @param fileGetter A function that, when given a file path, either returns the contents
 * of that file as a string, or if it doesn't exist, `undefined`
 */
export default async function parseProgramsAndConstructImportGraph(
  fileGetter: (path: string) => Promise<string | undefined>,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<LinkerOptions> = defaultLinkerOptions,
  shouldAddFileName: boolean
): Promise<LinkerResult | undefined> {
  const importGraph = new DirectedGraph()
  const programs: Record<string, es.Program> = {}
  const sourceModulesToImport = new Set<string>()

  // Wrapper around resolve file to make calling it more convenient
  async function resolveFileWrapper(fromPath: string, toPath: string, node?: es.Node) {
    const [absPath, resolved] = await resolveFile(
      fromPath,
      toPath,
      async str => {
        const file = await fileGetter(str)
        return file !== undefined
      },
      options?.resolverOptions
    )

    if (!resolved) {
      throw new ModuleNotFoundError(absPath, node)
    }

    return absPath
  }

  async function resolveAndParseFile(fromModule: string, node: ModuleDeclarationWithSource) {
    assert(
      typeof node.source?.value === 'string',
      `Expected ${node.type} to have source of type string, got ${node.source?.value}`
    )

    // TODO: Move file path validation here
    const absDstPath = await resolveFileWrapper(fromModule, node.source.value, node)

    // Special case of circular import: the module specifier
    // refers to the current file
    if (absDstPath === fromModule) {
      throw new CircularImportError([absDstPath, absDstPath])
    }

    if (importGraph.hasEdge(absDstPath, fromModule)) {
      // If we've seen this edge before, then we must have a cycle
      // so exit early and proceed to locate the cycle
      throw new LinkerError(false)
    }

    // Update the node's source value with the resolved path
    node.source.value = absDstPath

    // We assume that Source modules always have to be loaded
    // first, so we don't need to add those to the import graph
    if (isSourceModule(absDstPath)) {
      sourceModulesToImport.add(absDstPath)
    } else {
      importGraph.addEdge(absDstPath, fromModule)
      await enumerateModuleDeclarations(absDstPath)
    }
  }

  async function enumerateModuleDeclarations(fromModule: string) {
    // No need to parse programs we've already parsed before
    if (fromModule in programs) return
    assert(
      posixPath.isAbsolute(fromModule),
      `${enumerateModuleDeclarations.name} should only be used with absolute paths`
    )

    const fileText = await fileGetter(fromModule)
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
      throw new LinkerError(true)
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
            return resolveAndParseFile(fromModule, node)
          default:
            return undefined
        }
      })
    )
  }

   try {
     const entrypointAbsPath = await resolveFileWrapper('/', entrypointFilePath)
     await enumerateModuleDeclarations(entrypointAbsPath)

    const topoOrder = checkForCycle(importGraph)
    return {
      topoOrder,
      programs,
      sourceModulesToImport,
      entrypointAbsPath
    }
   } catch (error) {
    if (error instanceof LinkerError) {
      // If the LinkerError was caused by a parsing error,
      // then we return undefined straight away
      if (error.isProgramError) return undefined

      // Otherwise it was because we have to find an import cycle
      // so proceed to do that
      checkForCycle(importGraph)

      // We're guaranteed a cycle, so findCycle should throw an error
      // and enter the catch block
      return {} as never
    } else {
      // Any other error that occurs is just appended to the context
      // and we return undefined
       context.errors.push(error)
       return undefined
     }
   }
}
