import type * as es from 'estree'
import { posix as posixPath } from 'path'

import { Context } from '../..'
import { parse } from '../../parser/parser'
import { RecursivePartial } from '../../types'
import assert from '../../utils/assert'
import { mapAndFilter } from '../../utils/misc'
import { CircularImportError, ModuleNotFoundError } from '../errors'
import { isSourceModule } from '../utils'
import { DirectedGraph } from './directedGraph'
import resolveFile, { defaultResolutionOptions, ImportResolutionOptions } from './resolver'

type ModuleDeclarationWithSource = Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>

class LinkerError extends Error {}

export type LinkerResult = {
  importGraph: DirectedGraph
  programs: Record<string, es.Program>
  sourceModulesToImport: Set<string>
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
  function resolveFileWrapper(fromPath: string, toPath: string) {
    return resolveFile(
      fromPath,
      toPath,
      async str => {
        const file = await fileGetter(str)
        return file !== undefined
      },
      options.resolverOptions
    )
  }

  async function resolveAndParseFile(
    fromModule: string,
    node: ModuleDeclarationWithSource
  ): Promise<string> {
    assert(
      typeof node.source?.value === 'string',
      `Expected module declaration source to be of type string, got ${node.source?.value}`
    )

    // TODO: Move file path validation here
    const [absDstPath, resolved] = await resolveFileWrapper(fromModule, node.source.value)

    if (!resolved) {
      throw new ModuleNotFoundError(absDstPath, node)
    }

    // Special case of circular import: the module specifier
    // refers to the current file
    if (absDstPath === fromModule) {
      throw new CircularImportError([absDstPath, absDstPath])
    }

    if (importGraph.hasEdge(absDstPath, fromModule)) {
      // If we've seen this edge before, then we must have a cycle
      // so exit early and proceed to locate the cycle
      throw new LinkerError()
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

    return absDstPath
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
            return resolveAndParseFile(fromModule, node)
          default:
            return undefined
        }
      })
    )
  }

  try {
    const [entrypointAbsPath, entrypointResolved] = await resolveFileWrapper(
      '/',
      entrypointFilePath
    )
    if (!entrypointResolved) {
      throw new ModuleNotFoundError(entrypointAbsPath)
    }
    await enumerateModuleDeclarations(entrypointAbsPath)
  } catch (error) {
    if (!(error instanceof LinkerError)) {
      context.errors.push(error)
    }
    return undefined
  }

  return {
    importGraph,
    programs,
    sourceModulesToImport
  }
}
