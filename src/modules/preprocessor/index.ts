import type { Context, IOptions } from '../..'
import type { RecursivePartial } from '../../types'
import loadSourceModules from '../loader'
import type { AbsolutePath, FileGetter } from '../moduleTypes'
import analyzeImportsAndExports from './analyzer'
import bundlePrograms, { type Bundler } from './bundler'
import parseProgramsAndConstructImportGraph from './linker'

export default async function preprocessFileImports(
  files: FileGetter | Record<string, string>,
  context: Context,
  entrypointFilePath: AbsolutePath,
  options: RecursivePartial<IOptions> = {},
  bundler: Bundler = bundlePrograms
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

  const { programs, topoOrder, sourceModulesToImport } = linkerResult

  try {
    await loadSourceModules(
      sourceModulesToImport,
      context,
      options?.importOptions?.loadTabs ?? true
    )
    analyzeImportsAndExports(
      programs,
      entrypointFilePath,
      topoOrder,
      context,
      options?.importOptions
    )
    return bundler(programs, entrypointFilePath, topoOrder, context)
  } catch (error) {
    context.errors.push(error)
    return undefined
  }
}
