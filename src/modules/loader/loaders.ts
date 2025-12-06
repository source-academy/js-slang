import type { Context, Node } from '../../types'
import { ModuleInternalError } from '../errors'
import type { ModuleDocumentation, ModuleFunctions, ModuleManifest } from '../moduleTypes'
import {
  bundleAndTabImporter,
  docsImporter,
  setModulesStaticURL as internalUrlSetter,
  MODULES_STATIC_URL
} from './importers'
import { getRequireProvider } from './requireProvider'

export function setModulesStaticURL(value: string) {
  internalUrlSetter(value)

  // Changing the backend url should clear the caches
  // TODO: Do we want to memoize based on backend url?
  memoizedGetModuleDocsAsync.cache.clear()
  memoizedGetModuleManifestAsync.reset()
}

// lodash's memoize function memoizes on errors. This is undesirable,
// so we have our own custom memoization that won't memoize on errors
function getManifestImporter() {
  let manifest: ModuleManifest | null = null

  async function func() {
    if (manifest !== null) {
      return manifest
    }

    ;({ default: manifest } = await docsImporter(`${MODULES_STATIC_URL}/modules.json`))

    return manifest!
  }

  func.reset = () => {
    manifest = null
  }

  return func
}

function getMemoizedDocsImporter() {
  const docs = new Map<string, ModuleDocumentation>()

  async function func(moduleName: string, throwOnError: true): Promise<ModuleDocumentation>
  async function func(moduleName: string, throwOnError?: false): Promise<ModuleDocumentation | null>
  async function func(moduleName: string, throwOnError?: boolean) {
    if (docs.has(moduleName)) {
      return docs.get(moduleName)!
    }

    try {
      const { default: loadedDocs } = await docsImporter(
        `${MODULES_STATIC_URL}/jsons/${moduleName}.json`
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

export async function loadModuleTabsAsync(moduleName: string) {
  const manifest = await memoizedGetModuleManifestAsync()
  const moduleInfo = manifest[moduleName]

  return Promise.all(
    moduleInfo.tabs.map(async tabName => {
      const { default: result } = await bundleAndTabImporter(
        `${MODULES_STATIC_URL}/tabs/${tabName}.js`
      )
      return result
    })
  )
}

export async function loadModuleBundleAsync(
  moduleName: string,
  context: Context,
  node?: Node
): Promise<ModuleFunctions> {
  const { default: result } = await bundleAndTabImporter(
    `${MODULES_STATIC_URL}/bundles/${moduleName}.js`
  )
  try {
    const loadedModule = result(getRequireProvider(context))
    return Object.entries(loadedModule).reduce((res, [name, value]) => {
      if (typeof value === 'function') {
        const repr = `function ${name} {\n\t[Function from ${moduleName}\n\tImplementation hidden]\n}`
        value[Symbol.toStringTag] = () => repr
        value.toString = () => repr
      }
      return {
        ...res,
        [name]: value
      }
    }, {})
  } catch (error) {
    throw new ModuleInternalError(moduleName, error, node)
  }
}
