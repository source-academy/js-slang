import type { Node } from 'estree'
import { memoize } from 'lodash'

import type { Context } from '../..'
import { timeoutPromise } from '../../utils/misc'
import { ModuleConnectionError, ModuleInternalError, ModuleNotFoundError } from '../errors'
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
      const result = await timeoutPromise(importer(p), timeout)
      return result
    } catch (error) {
      if (error instanceof TypeError) {
        // Import statements should throw TypeError if the destination is unreachable
        throw new ModuleConnectionError()
      }
      throw error
    }
  }

// In the browser, the import statement needs to be wrapped in the function constructor because webpack will try to resolve it
// at compile time
// Not sure about running it purely using node tho....
// However, doing this prevents jest from properly mocking the import() call, so in tests we need to use the actual import call
const rawImporter: (p: string) => Promise<{ default: (prov: RequireProvider) => any }> =
  process.env.NODE_ENV !== 'test'
    ? (new Function('path', 'return import(path)') as any)
    : p => import(p)
const importer = wrapImporter(rawImporter)

// Also specifically in the browser the import type assertion is required, but not allowed in js-slang itself because js-slang
// compiles to CommonJS, which does not support type assertions
const rawDocsImporter: (p: string) => Promise<{ default: Record<string, any> }> =
  typeof window !== undefined && process.env.NODE_ENV !== 'test'
    ? (new Function('path', 'return import(path, { assert: { type: "json" } })') as any)
    : p => import(p)

const docsImporter = wrapImporter(rawDocsImporter)

async function checkModuleExists(moduleName: string, node?: Node) {
  const modules = await memoizedGetModuleManifestAsync()
  // Check if the module exists
  if (!(moduleName in modules)) throw new ModuleNotFoundError(moduleName, node)

  return modules[moduleName]
}

export const memoizedGetModuleDocsAsync = memoize(getModuleDocsAsync)
async function getModuleDocsAsync(moduleName: string): Promise<ModuleDocumentation | null> {
  try {
    const { default: result } = await docsImporter(`${MODULES_STATIC_URL}/jsons/${moduleName}.json`)
    return result as ModuleDocumentation
  } catch (error) {
    console.warn(`Failed to load documentation for ${moduleName}:`, error)
    return null
  }
}

/**
 * Send a HTTP GET request to the modules endpoint to retrieve the manifest
 * @return Modules
 */
export const memoizedGetModuleManifestAsync = memoize(getModuleManifestAsync)
async function getModuleManifestAsync(): Promise<ModuleManifest> {
  const { default: result } = await docsImporter(`${MODULES_STATIC_URL}/modules.json`)
  return result as ModuleManifest
}

export async function loadModuleTabsAsync(moduleName: string, node?: Node) {
  const moduleInfo = await checkModuleExists(moduleName, node)

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

export const sourceModuleObject = Symbol()

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
