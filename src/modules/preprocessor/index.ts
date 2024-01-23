import type { Context, IOptions } from '../..'
import { type RecursivePartial } from '../../types'
import { CircularImportError } from '../errors'
import { loadSourceModules } from '../loader/moduleLoaderAsync'
import analyzeImportsAndExports from './analyzer'
import bundlePrograms from './bundler'
import parseProgramsAndConstructImportGraph from './linker'

// const DEFAULT_SOURCE_OPTIONS: Readonly<IOptions> = {
//   scheduler: 'async',
//   steps: 1000,
//   stepLimit: -1,
//   executionMethod: 'auto',
//   variant: Variant.DEFAULT,
//   originalMaxExecTime: 1000,
//   useSubst: false,
//   isPrelude: false,
//   throwInfiniteLoops: true,
//   envSteps: -1,
//   importOptions: {
//     ...defaultAnalysisOptions,
//     ...defaultLinkerOptions,
//     wrapSourceModules: true,
//     loadTabs: true
//   },
//   shouldAddFileName: null
// }

export default async function preprocessFileImports(
  files: ((p: string) => Promise<string | undefined>) | Record<string, string>,
  context: Context,
  entrypointFilePath: string,
  options: RecursivePartial<IOptions> = {}
) {
  const fileGetter = typeof files === 'function' ? files : (p: string) => Promise.resolve(files[p])

  const linkerResult = await parseProgramsAndConstructImportGraph(
    fileGetter,
    entrypointFilePath,
    context,
    options?.importOptions,
    options.shouldAddFileName ?? (typeof files === 'function' || Object.keys(files).length > 1)
  )
  if (!linkerResult) return undefined

  const { programs, importGraph, sourceModulesToImport } = linkerResult

  // Check for circular imports.
  const topologicalOrderResult = importGraph.getTopologicalOrder()
  if (!topologicalOrderResult.isValidTopologicalOrderFound) {
    context.errors.push(new CircularImportError(topologicalOrderResult.firstCycleFound))
    return undefined
  }

  const topoOrder = topologicalOrderResult.topologicalOrder
  try {
    await loadSourceModules(
      sourceModulesToImport,
      context,
      options?.importOptions?.loadTabs ?? true
    )
    analyzeImportsAndExports(programs, topoOrder, context, options?.importOptions)
    return bundlePrograms(programs, context, entrypointFilePath, topoOrder)
  } catch (error) {
    context.errors.push(error)
    return undefined
  }
}
