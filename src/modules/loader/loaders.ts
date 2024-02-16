import type { Node } from 'estree'

import type { Context } from '../..'
import { timeoutPromise } from '../../utils/misc'
import { ModuleConnectionError, ModuleInternalError } from '../errors'
import type { ModuleDocumentation, ModuleManifest } from '../moduleTypes'
import { getRequireProvider, RequireProvider } from './requireProvider'

export let MODULES_STATIC_URL =
  process.env.REACT_APP_MODULE_BACKEND_URL ?? 'http://source-academy.github.io/modules'
export function setModulesStaticURL(value: string) {
  MODULES_STATIC_URL = value
}

type Importer<T> = (p: string) => Promise<{ default: T }>
const wrapImporter =
  <T>(importer: Importer<T>, timeout: number = 10000): Importer<T> =>
  async p => {
    try {
      // We add an arbitrary query parameter to the import URL so that the import cache
      // is always invalidated, allowing us to handle the memoization on our side
      const result = await timeoutPromise(importer(`${p}?q=${Date.now()}`), timeout)
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

// In the browser, the import statement needs to be wrapped in the function constructor because webpack will try to resolve it
// at compile time
// However, doing this prevents jest from properly mocking the import() call, so in tests we need to use the actual import call
const rawImporter: (p: string) => Promise<{ default: (prov: RequireProvider) => any }> =
  process.env.NODE_ENV !== 'test'
    ? (new Function('path', 'return import(path)') as any)
    : p => import(p)
const importer = wrapImporter(rawImporter)

// Also specifically in the browser the import type assertion is required, but not allowed in js-slang itself because js-slang
// compiles to CommonJS, which does not support import attributes
const rawDocsImporter: (p: string) => Promise<{ default: Record<string, any> }> =
  typeof window !== 'undefined' && process.env.NODE_ENV !== 'test'
    ? // TODO: Change when import attributes become supported
      (new Function('path', 'return import(path, { assert: { type: "json" } })') as any)
    : p => import(p)
const docsImporter = wrapImporter(rawDocsImporter)

// By default, lodash's memoize will just memoize errors. We use custom
// memoizers that won't memoize errors
function createDocsGetter() {
  const memoizedDocs: Map<string, ModuleDocumentation> = new Map()

  function func(moduleName: string, throwOnError?: false): Promise<ModuleDocumentation | null>
  function func(moduleName: string, throwOnError: true): Promise<ModuleDocumentation>
  async function func(moduleName: string, throwOnError?: boolean) {
    if (!memoizedDocs.has(moduleName)) {
      try {
        const { default: result } = await docsImporter(
          `${MODULES_STATIC_URL}/jsons/${moduleName}.json`
        )
        memoizedDocs.set(moduleName, result)
      } catch (error) {
        if (throwOnError) throw error

        console.warn(`Failed to load documentation for ${moduleName}:`, error)
        return null
      }
    }

    return memoizedDocs.get(moduleName)!
  }

  func.cache = memoizedDocs
  return func
}
export const memoizedGetModuleDocsAsync = createDocsGetter()

function createManifestGetter() {
  let memoizedManifest: ModuleManifest | null = null

  const func = async () => {
    if (memoizedManifest === null) {
      ;({ default: memoizedManifest } = await docsImporter(`${MODULES_STATIC_URL}/modules.json`))
    }

    return memoizedManifest
  }

  func.reset = () => {
    memoizedManifest = null
  }

  return func
}
export const memoizedGetModuleManifestAsync = createManifestGetter()

export const sourceModuleObject = Symbol()

export async function loadModuleTabsAsync(moduleName: string, node?: Node) {
  const modules = await memoizedGetModuleManifestAsync()
  const moduleInfo = modules[moduleName]

  // Load the tabs for the current module
  return Promise.all(
    moduleInfo.tabs.map(async path => {
      try {
        const { default: tab } = await importer(`${MODULES_STATIC_URL}/tabs/${path}.js`)
        return tab
      } catch (error) {
        console.error('tab error:', error)
        throw new ModuleInternalError(path, error, node)
      }
    })
  )
}

export async function loadModuleBundleAsync(moduleName: string, context: Context, node?: Node) {
  const { default: bundleFunc } = await importer(`${MODULES_STATIC_URL}/bundles/${moduleName}.js`)
  try {
    const bundle: Record<string, any> = bundleFunc(getRequireProvider(context))

    for (const value of Object.values(bundle)) {
      value[sourceModuleObject] = true
    }

    return bundle
  } catch (error) {
    console.error('bundle error: ', error)
    throw new ModuleInternalError(moduleName, error, node)
  }
}

/**
 * Initialize module contexts and add UI tabs needed for modules to program context
 */
export async function initModuleContextAsync(
  moduleName: string,
  context: Context,
  loadTabs: boolean
) {
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
