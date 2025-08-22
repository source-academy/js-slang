import type { Context } from '../..'
import { ModuleInternalError } from '../errors'
import type { ModuleDocumentation, ModuleFunctions, ModuleManifest } from '../moduleTypes'
import { MODULES_STATIC_URL, bundleAndTabImporter, docsImporter } from './importers'
import { getRequireProvider } from './requireProvider'

// lodash's memoize function memoizes on errors. This is undesirable,
// so we have our own custom memoization that won't memoize on errors
function getManifestImporter() {
  let manifest: ModuleManifest | null = null

  async function func(signal?: AbortSignal) {
    if (manifest !== null) {
      return manifest
    }

    ;({ default: manifest } = await docsImporter(`${MODULES_STATIC_URL}/modules.json`, signal))

    return manifest!
  }

  func.reset = () => {
    manifest = null
  }

  return func
}

function getMemoizedDocsImporter() {
  const docs = new Map<string, ModuleDocumentation>()

  async function func(
    moduleName: string,
    throwOnError: true,
    signal?: AbortSignal
  ): Promise<ModuleDocumentation>
  async function func(
    moduleName: string,
    throwOnError?: false,
    signal?: AbortSignal
  ): Promise<ModuleDocumentation | null>
  async function func(moduleName: string, throwOnError?: boolean, signal?: AbortSignal) {
    if (docs.has(moduleName)) {
      return docs.get(moduleName)!
    }

    try {
      const { default: loadedDocs } = await docsImporter(
        `${MODULES_STATIC_URL}/jsons/${moduleName}.json`,
        signal
      )
      docs.set(moduleName, loadedDocs)
      return loadedDocs
    } catch (error) {
      if (throwOnError) throw error
      console.warn(`Failed to load documentation for ${moduleName}:`, error)
      return null
    }
  }

  func.cache = docs
  return func
}

export const memoizedGetModuleManifestAsync = getManifestImporter()
export const memoizedGetModuleDocsAsync = getMemoizedDocsImporter()

export async function loadModuleTabsAsync(moduleName: string, signal?: AbortSignal) {
  const manifest = await memoizedGetModuleManifestAsync()
  const moduleInfo = manifest[moduleName]

  return Promise.all(
    moduleInfo.tabs.map(async tabName => {
      const { default: result } = await bundleAndTabImporter(
        `${MODULES_STATIC_URL}/tabs/${tabName}.js`,
        signal
      )
      return result
    })
  )
}
export async function loadModuleBundleAsync(
  moduleName: string,
  context: Context,
  signal?: AbortSignal
): Promise<ModuleFunctions> {
  const { default: result } = await bundleAndTabImporter(
    `${MODULES_STATIC_URL}/bundles/${moduleName}.js`,
    signal
  )
  try {
    const loadedModule = result(getRequireProvider(context))
    return Object.entries(loadedModule).reduce((res, [name, value]) => {
      if (typeof value === 'function') {
        const repr = `function ${name} {\n\t[Function from ${moduleName}\n\tImplementation hidden]\n}`
        ;(value as any)[Symbol.toStringTag] = () => repr
        value.toString = () => repr
      }
      return {
        ...res,
        [name]: value
      }
    }, {})
  } catch (error) {
    console.error('The error is', error)
    throw new ModuleInternalError(moduleName, error)
  }
}
