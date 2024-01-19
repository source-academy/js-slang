import _ from 'lodash'

import type { Context, IOptions } from '../..'
import { type RecursivePartial, Variant } from '../../types'
import { CircularImportError } from '../errors'
import { loadSourceModules } from '../loader/moduleLoaderAsync'
import analyzeImportsAndExports, { defaultAnalysisOptions } from './analyzer'
import bundlePrograms, { Bundler } from './bundler'
import parseProgramsAndConstructImportGraph, { defaultLinkerOptions, LinkerResult } from './linker'

const DEFAULT_SOURCE_OPTIONS: Readonly<IOptions> = {
  scheduler: 'async',
  steps: 1000,
  stepLimit: -1,
  executionMethod: 'auto',
  variant: Variant.DEFAULT,
  originalMaxExecTime: 1000,
  useSubst: false,
  isPrelude: false,
  throwInfiniteLoops: true,
  envSteps: -1,
  importOptions: {
    ...defaultAnalysisOptions,
    ...defaultLinkerOptions,
    wrapSourceModules: true,
    loadTabs: true
  },
  shouldAddFileName: null
}

export class Preprocessor {
  public readonly files: (p: string) => Promise<string | undefined>
  public readonly shouldAddFileNames: boolean
  public readonly options: IOptions

  constructor(
    files: ((p: string) => Promise<string | undefined>) | Record<string, string>,
    public readonly context: Context,
    public readonly entrypointFilePath: string,
    options: RecursivePartial<IOptions>
  ) {
    this.files = typeof files === 'function' ? files : p => Promise.resolve(files[p])
    this.shouldAddFileNames = typeof files === 'function' || Object.keys(files).length > 1
    this.options = _.merge({ ...DEFAULT_SOURCE_OPTIONS }, options)
  }

  // Step 1
  public runLinker() {
    return parseProgramsAndConstructImportGraph(
      this.files,
      this.entrypointFilePath,
      this.context,
      this.options.importOptions,
      this.shouldAddFileNames
    )
  }

  // Step 2
  public checkForCircularImports({ importGraph }: LinkerResult) {
    // Check for circular imports.
    const topologicalOrderResult = importGraph.getTopologicalOrder()
    if (!topologicalOrderResult.isValidTopologicalOrderFound) {
      throw new CircularImportError(topologicalOrderResult.firstCycleFound)
    }

    return topologicalOrderResult.topologicalOrder
  }

  // Step 3
  public async loadSourceModules({ sourceModulesToImport }: LinkerResult) {
    await loadSourceModules(
      sourceModulesToImport,
      this.context,
      this.options.importOptions.loadTabs
    )
  }

  // Step 4
  public analyzeImportsAndExports({ programs, topoOrder }: LinkerResult & { topoOrder: string[] }) {
    const fullTopoOrder = topoOrder.length === 0 ? [this.entrypointFilePath] : topoOrder

    analyzeImportsAndExports(programs, fullTopoOrder, this.context, this.options.importOptions)
  }

  public get bundler(): Bundler {
    return bundlePrograms
  }

  // Step 5
  public bundlePrograms({ programs, topoOrder }: LinkerResult & { topoOrder: string[] }) {
    return this.bundler(programs, this.context, this.entrypointFilePath, topoOrder)
  }
}

export default async function preprocessFileImports(preprocessor: Preprocessor) {
  try {
    const linkerResult = await preprocessor.runLinker()
    const topoOrder = preprocessor.checkForCircularImports(linkerResult)
    await preprocessor.loadSourceModules(linkerResult)

    const analysisResult = {
      ...linkerResult,
      topoOrder
    }
    preprocessor.analyzeImportsAndExports(analysisResult)
    return preprocessor.bundlePrograms(analysisResult)
  } catch (error) {
    preprocessor.context.errors.push(error)
    return undefined
  }
}
