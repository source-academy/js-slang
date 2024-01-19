import type { Node } from 'estree'
import { memoize } from 'lodash'

import type { Context } from '../..'
import { getImportedName } from '../../utils/ast/helpers'
import { isNamespaceSpecifier } from '../../utils/ast/typeGuards'
import { PromiseTimeoutError, timeoutPromise } from '../../utils/misc'
import { ModuleConnectionError, ModuleInternalError, ModuleNotFoundError } from '../errors'
import type { ModuleBundle, ModuleDocumentation, ModuleManifest } from '../moduleTypes'
import { removeExportDefault } from '../utils'
import { getRequireProvider } from './requireProvider'

export let MODULES_STATIC_URL =
  process.env.REACT_APP_MODULE_BACKEND_URL ?? 'http://source-academy.github.io/modules'
export function setModulesStaticURL(value: string) {
  MODULES_STATIC_URL = value
}

export function httpGetAsync(path: string, type: 'json'): Promise<object>
export function httpGetAsync(path: string, type: 'text'): Promise<string>
export async function httpGetAsync(path: string, type: 'json' | 'text') {
  try {
    const resp = await timeoutPromise(
      fetch(path, {
        method: 'GET'
      }),
      10000
    )

    if (resp.status !== 200 && resp.status !== 304) {
      throw new ModuleConnectionError()
    }

    const promise = type === 'text' ? resp.text() : resp.json()
    return timeoutPromise(promise, 10000)
  } catch (error) {
    if (error instanceof TypeError || error instanceof PromiseTimeoutError) {
      throw new ModuleConnectionError()
    }
    if (!(error instanceof ModuleConnectionError)) throw new ModuleInternalError(path, error)
    throw error
  }
}

/**
 * Send a HTTP GET request to the modules endpoint to retrieve the manifest
 * @return Modules
 */
export const memoizedGetModuleManifestAsync = memoize(getModuleManifestAsync)
function getModuleManifestAsync(): Promise<ModuleManifest> {
  return httpGetAsync(`${MODULES_STATIC_URL}/modules.json`, 'json') as Promise<ModuleManifest>
}

async function checkModuleExists(moduleName: string, node?: Node) {
  const modules = await memoizedGetModuleManifestAsync()
  // Check if the module exists
  if (!(moduleName in modules)) throw new ModuleNotFoundError(moduleName, node)

  return modules[moduleName]
}

export const memoizedGetModuleBundleAsync = memoize(getModuleBundleAsync)
async function getModuleBundleAsync(moduleName: string): Promise<string> {
  const result = await httpGetAsync(`${MODULES_STATIC_URL}/bundles/${moduleName}.js`, 'text')
  return removeExportDefault(result)
}

export const memoizedGetModuleTabAsync = memoize(getModuleTabAsync)
async function getModuleTabAsync(tabName: string): Promise<string> {
  const result = await httpGetAsync(`${MODULES_STATIC_URL}/tabs/${tabName}.js`, 'text')
  return removeExportDefault(result)
}

export const memoizedGetModuleDocsAsync = memoize(getModuleDocsAsync)
async function getModuleDocsAsync(moduleName: string): Promise<ModuleDocumentation | null> {
  try {
    const result = await httpGetAsync(`${MODULES_STATIC_URL}/jsons/${moduleName}.json`, 'json')
    return result as ModuleDocumentation
  } catch (error) {
    console.warn(`Failed to load documentation for ${moduleName}:`, error)
    return null
  }
}

const importWrapper = new Function('path', 'return import(path)') as (
  p: string
) => Promise<{ default: any }>

export async function loadModuleTabsAsync(moduleName: string, node?: Node) {
  const moduleInfo = await checkModuleExists(moduleName, node)

  // Load the tabs for the current module
  return Promise.all(
    moduleInfo.tabs.map(async path => {
      // const rawTabFile = await memoizedGetModuleTabAsync(path)
      try {
        const { default: tab } = await importWrapper(`${MODULES_STATIC_URL}/tabs/${path}.js`)
        return tab
        // return eval(rawTabFile)
      } catch (error) {
        console.error('tab error:', error)
        throw new ModuleInternalError(path, error, node)
      }
    })
  )
}

export async function loadModuleBundleAsync(moduleName: string, context: Context, node?: Node) {
  // await checkModuleExists(moduleName, node)
  // const moduleText = await memoizedGetModuleBundleAsync(moduleName)
  try {
    const { default: bundle } = await importWrapper(
      `${MODULES_STATIC_URL}/bundles/${moduleName}.js`
    )
    return bundle(getRequireProvider(context))
    // const moduleBundle: ModuleBundle = eval(moduleText)
    // return wrapSourceModule(moduleName, moduleBundle, getRequireProvider(context))
  } catch (error) {
    console.error('bundle error: ', error)
    throw new ModuleInternalError(moduleName, error, node)
  }
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

export async function loadSourceModules(
  sourceModulesToLoad: Set<string>,
  context: Context,
  loadTabs: boolean
) {
  const entries = await Promise.all(
    [...sourceModulesToLoad].map(async moduleName => {
      await initModuleContextAsync(moduleName, context, loadTabs)
      const reqProv = getRequireProvider(context)
      const { default: rawBundle } = await importWrapper(
        `${MODULES_STATIC_URL}/bundles/${moduleName}.js`
      )
      const funcs = rawBundle(reqProv)

      const bundle = (importedName: string, localName: string) => {
        const obj = funcs[importedName]
        if (typeof obj === 'function') {
          const wrapped = (...args: any[]) => {
            Object.defineProperty(obj, 'name', { value: localName })
            return obj(...args)
          }

          const repr = `function ${localName} {\n\t[Function ${importedName} from ${moduleName}\n\tImplementation hidden]\n}`
          wrapped.toString = () => repr
          Object.defineProperty(wrapped, 'length', { value: obj.length })

          return wrapped
        }
        return obj
      }

      return [
        moduleName,
        {
          rawBundle: new Proxy(
            {},
            {
              get: (_, p) => (typeof p === 'string' ? bundle(p, p) : undefined)
            }
          ),
          symbols: new Set(Object.keys(funcs)),
          get(spec) {
            if (isNamespaceSpecifier(spec)) return this.rawBundle
            return this.getWithName(getImportedName(spec), spec.local.name)
          },
          getWithName: (importedName, localName) => bundle(importedName, localName)
        }
      ] as [string, ModuleBundle]
    })
  )
  context.nativeStorage.loadedModules = Object.fromEntries(entries)
}
