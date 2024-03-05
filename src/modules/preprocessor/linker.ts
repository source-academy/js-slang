import type es from 'estree'

import type { Context } from '../..'
import { parse } from '../../parser/parser'
import { parseAt } from '../../parser/utils'
import type { RecursivePartial } from '../../types'
import assert from '../../utils/assert'
import { isDirective } from '../../utils/ast/typeGuards'
import { CircularImportError, ModuleNotFoundError } from '../errors'
import type { AbsolutePath, FileGetter, SourceFiles } from '../moduleTypes'
import { DirectedGraph } from './directedGraph'
import resolveFile, { type ImportResolutionOptions, defaultResolutionOptions } from './resolver'

type ModuleDeclarationWithSource = Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>

/**
 * Helper error type. Thrown to cause any Promise.all calls
 * to reject immediately instead of just returning undefined,
 * which would still require all promises to be resolved
 */
class LinkerError extends Error {}

export interface LinkerSuccessResult {
  ok: true
  programs: Record<AbsolutePath, es.Program>
  sourceModulesToImport: Set<string>
  topoOrder: AbsolutePath[]
  isVerboseErrorsEnabled: boolean
  files: SourceFiles
}

export interface LinkerErrorResult {
  ok: false
  isVerboseErrorsEnabled: boolean
}

export type LinkerResult = LinkerErrorResult | LinkerSuccessResult

export type LinkerOptions = {
  /**
   * Options to pass to `resolveFile`
   */
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
): Promise<LinkerResult> {
  const importGraph = new DirectedGraph()
  const programs: Record<AbsolutePath, es.Program> = {}
  const files: SourceFiles = {}
  const sourceModulesToImport = new Set<string>()
  const getter: FileGetter = path => {
    if (path in files) return Promise.resolve(files[path])
    return fileGetter(path)
  }
  let entrypointCode: string | undefined = undefined

  async function resolveDependency(fromModule: AbsolutePath, node: ModuleDeclarationWithSource) {
    // TODO: Move file path validation here
    const toPath = node.source!.value as string
    const resolveResult = await resolveFile(fromModule, toPath, getter, options?.resolverOptions)

    if (!resolveResult) {
      throw new ModuleNotFoundError(toPath, node)
    }

    const { path: absPath } = resolveResult

    // Special case of circular import: the module specifier
    // refers to the current file
    if (absPath === fromModule) {
      throw new CircularImportError([absPath, absPath])
    }

    // This condition can never be true: To see an existing edge
    // would require having to parse the fromModule again
    // But parseAndEnumerateModuleDeclarations already guards against this.

    // if (importGraph.hasEdge(absDstPath, fromModule)) {
    //   // If we've seen this edge before, then we must have a cycle
    //   // so exit early and proceed to locate the cycle
    //   throw new LinkerError(false)
    // }

    // Update the node's source value with the resolved path
    node.source!.value = resolveResult.path

    // We assume that Source modules always have to be loaded
    // first, so we don't need to add those to the import graph
    if (resolveResult.type === 'source') {
      sourceModulesToImport.add(resolveResult.path)
    } else {
      // No need to parse programs we've already parsed before
      importGraph.addEdge(resolveResult.path, fromModule)
      await parseAndEnumerateModuleDeclarations(resolveResult.path, resolveResult.code)
    }
  }

  async function parseAndEnumerateModuleDeclarations(fromModule: AbsolutePath, fileText: string) {
    if (fromModule in programs) return

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

    // We only really need to pay attention to the first node that imports
    // from each specific module
    const modulesToNodeMap = program.body.reduce(
      (res, node) => {
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
      },
      {} as Record<string, Promise<void>>
    )

    await Promise.all(Object.values(modulesToNodeMap))
  }

  function hasVerboseErrors() {
    let statement: es.Node | null = null
    if (!programs[entrypointFilePath]) {
      if (entrypointCode == undefined) {
        // non-existent entrypoint
        return false
      }
      // There are syntax errors in the entrypoint file
      // we use parseAt to try parse the first line
      statement = parseAt(entrypointCode, 0) as es.Node | null
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
    entrypointCode = await fileGetter(entrypointFilePath)
    if (entrypointCode === undefined) {
      throw new ModuleNotFoundError(entrypointFilePath)
    }

    await parseAndEnumerateModuleDeclarations(entrypointFilePath, entrypointCode)

    const topologicalOrderResult = importGraph.getTopologicalOrder()
    if (!topologicalOrderResult.isValidTopologicalOrderFound) {
      throw new CircularImportError(topologicalOrderResult.firstCycleFound)
    }

    return {
      ok: true,
      topoOrder: topologicalOrderResult.topologicalOrder as AbsolutePath[],
      programs,
      sourceModulesToImport,
      files,
      isVerboseErrorsEnabled: hasVerboseErrors()
    }
  } catch (error) {
    if (!(error instanceof LinkerError)) {
      // Any other error that occurs is just appended to the context
      // and we return undefined
      context.errors.push(error)
    }

    // Even if we encountered some error, we might still
    // be able to infer verboseErrors
    return {
      ok: false,
      isVerboseErrorsEnabled: hasVerboseErrors()
    }
  }
}

export const isLinkerSuccess = (result: LinkerResult): result is LinkerSuccessResult => result.ok
