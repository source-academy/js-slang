import type es from 'estree'

import type { Context } from '../..'
import { parse } from '../../parser/parser'
import type { RecursivePartial } from '../../types'
import { CircularImportError, ModuleNotFoundError } from '../errors'
import { getModuleDeclarationSource } from '../../utils/ast/helpers'
import type { FileGetter } from '../moduleTypes'
import { mapAndFilter } from '../../utils/misc'
import { parseAt } from '../../parser/utils'
import { isDirective } from '../../utils/ast/typeGuards'
import { DirectedGraph } from './directedGraph'
import resolveFile, { defaultResolutionOptions, type ImportResolutionOptions } from './resolver'

type ModuleDeclarationWithSource = Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>

/**
 * Helper error type. Thrown to cause any Promise.all calls
 * to reject immediately instead of just returning undefined,
 * which would still require all promises to be resolved
 */
class LinkerError extends Error {}

export type LinkerResult =
  | {
      ok: false
      verboseErrors: boolean
    }
  | {
      ok: true
      programs: Record<string, es.Program>
      files: Record<string, string>
      sourceModulesToImport: Set<string>
      topoOrder: string[]
      verboseErrors: boolean
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
): Promise<LinkerResult> {
  const importGraph = new DirectedGraph()
  const programs: Record<string, es.Program> = {}
  const files: Record<string, string> = {}
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
    files[fromModule] = fileText

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

  let entrypointFileText: string | undefined = undefined

  function hasVerboseErrors() {
    // Always try to infer if verbose errors should be enabled
    let statement: es.Node | null = null

    if (!programs[entrypointFilePath]) {
      if (entrypointFileText == undefined) {
        // non-existent entrypoint
        return false
      }
      // There are syntax errors in the entrypoint file
      // we use parseAt to try parse the first line
      statement = parseAt(entrypointFileText, 0) as es.Node | null
    } else {
      // Otherwise we can use the entrypoint program as it has been passed
      const entrypointProgram = programs[entrypointFilePath]

      // Check if the program had any code at all
      if (entrypointProgram.body.length === 0) return false
      ;[statement] = entrypointProgram.body
    }

    if (statement === null) return false

    // The two different parsers end up with two different ASTs
    // These are the two cases where 'enable verbose' appears
    // as a directive
    if (isDirective(statement)) {
      return statement.directive === 'enable verbose'
    }

    return statement.type === 'Literal' && statement.value === 'enable verbose'
  }

  try {
    entrypointFileText = await fileGetter(entrypointFilePath)
    // Not using boolean test here, empty strings are valid programs
    // but are falsy
    if (entrypointFileText === undefined) {
      throw new ModuleNotFoundError(entrypointFilePath)
    }

    await parseAndEnumerateModuleDeclarations(entrypointFilePath, entrypointFileText)

    const topologicalOrderResult = importGraph.getTopologicalOrder()
    if (topologicalOrderResult.isValidTopologicalOrderFound) {
      return {
        ok: true,
        topoOrder: topologicalOrderResult.topologicalOrder,
        programs,
        sourceModulesToImport,
        files,
        verboseErrors: hasVerboseErrors()
      }
    }

    context.errors.push(new CircularImportError(topologicalOrderResult.firstCycleFound))
  } catch (error) {
    if (!(error instanceof LinkerError)) {
      // Any other error that occurs is just appended to the context
      // and we return undefined
      context.errors.push(error)
    }
  }

  return {
    ok: false,
    verboseErrors: hasVerboseErrors()
  }
}
