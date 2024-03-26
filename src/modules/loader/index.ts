import type { Context, Node } from '../../types'
import { timeoutPromise } from '../../utils/misc'
import { ModuleConnectionError, ModuleInternalError } from '../errors'
import type {
  ModuleBundle,
  ModuleDocumentation,
  ModuleFunctions,
  ModuleManifest
} from '../moduleTypes'
import { getRequireProvider } from './requireProvider'

// Default modules static url. Exported for testing.
export let MODULES_STATIC_URL = 'https://source-academy.github.io/modules'

export function setModulesStaticURL(url: string) {
  MODULES_STATIC_URL = url
}

function wrapImporter<T>(
  browserFunc: (p: string) => Promise<T>,
  nodeFunc: (p: string) => Promise<T>
) {
  const func =
    typeof window !== 'undefined' && process.env.NODE_ENV !== 'test' ? browserFunc : nodeFunc

  return async (p: string): Promise<T> => {
    try {
      const result = await timeoutPromise(func(p), 10000)
      return result
    } catch (error) {
      // Before calling this function, the import analyzer should've been used to make sure
      // that the module being imported already exists, so the following errors should
      // be thrown only if the modules server is unreachable
      if (
        // In the browser, import statements should throw TypeError
        error instanceof TypeError ||
        // In Node a different error is thrown with the given code instead
        error.code === 'MODULE_NOT_FOUND' ||
        // Thrown specifically by jest
        error.code === 'ENOENT'
      ) {
        throw new ModuleConnectionError()
      }
      throw error
    }
  }
}

// Exported for testing
export const docsImporter = wrapImporter<{ default: any }>(
  new Function(
    'path',
    // TODO Change to import attributes when supported
    'return import(`${path}?q=${Date.now()}`, { assert: { type: "json" } })'
  ) as any,
  async p => {
    // Loading JSON using require/import with node is still very inconsistent
    // So we will have to fallback to fetch
    const resp = await fetch(p)
    const result = await resp.json()
    return { default: result }
  }
)

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

const bundleAndTabImporter = wrapImporter<{ default: ModuleBundle }>(
  new Function('path', 'return import(`${path}?q=${Date.now()}`)') as any,
  p => Promise.resolve(require(p))
)

export async function loadModuleBundleAsync(
  moduleName: string,
  context: Context,
  node?: Node
): Promise<ModuleFunctions> {
  const { default: result } = await bundleAndTabImporter(
    `${MODULES_STATIC_URL}/bundles/${moduleName}.js`
  )
  try {
    return Object.entries(result(getRequireProvider(context))).reduce((res, [name, value]) => {
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

/**
 * Initialize module contexts and add UI tabs needed for modules to program context
 */
async function initModuleContextAsync(moduleName: string, context: Context, loadTabs: boolean) {
  // Load the module's tabs
  if (!(moduleName in context.moduleContexts)) {
    context.moduleContexts[moduleName] = {
      state: null,
      tabs: loadTabs ? await loadModuleTabsAsync(moduleName) : null
    }
  } else if (context.moduleContexts[moduleName].tabs === null && loadTabs) {
    context.moduleContexts[moduleName].tabs = await loadModuleTabsAsync(moduleName)
  }
}

export default async function loadSourceModules(
  sourceModulesToImport: Set<string>,
  context: Context,
  loadTabs: boolean
) {
  const loadedModules = await Promise.all(
    [...sourceModulesToImport].map(async moduleName => {
      await initModuleContextAsync(moduleName, context, loadTabs)
      const bundle = await loadModuleBundleAsync(moduleName, context)
      return [moduleName, bundle] as [string, ModuleFunctions]
    })
  )
  context.nativeStorage.loadedModules = Object.fromEntries(loadedModules)
}
