import type { Node } from 'estree'
import { memoize, MemoizedFunction } from 'lodash'

import type { Context } from '..'
import { wrapSourceModule } from '../utils/operators'
import { ModuleConnectionError, ModuleInternalError, ModuleNotFoundError } from './errors'
import { MODULES_STATIC_URL } from './moduleLoader'
import type { ModuleBundle, ModuleDocumentation, ModuleManifest } from './moduleTypes'
import { getRequireProvider } from './requireProvider'

export function httpGetAsync(path: string, type: 'json'): Promise<object>
export function httpGetAsync(path: string, type: 'text'): Promise<string>
export async function httpGetAsync(path: string, type: 'json' | 'text') {
  const resp = await fetch(path, {
    method: 'GET'
  })

  if (resp.status !== 200 && resp.status !== 304) {
    throw new ModuleConnectionError()
  }

  if (typeof window === 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('TIMEOUT'))
      }, 10000)

      resp
        .text()
        .then(value => {
          clearTimeout(timer)
          resolve(value)
        })
        .catch(reason => {
          clearTimeout(timer)
          reject(reason)
        })
    })
  }

  return type === 'text' ? resp.text() : resp.json()
  // return new Promise<string>((resolve, reject) => {
  //   try {
  //     resolve(httpGet(path))
  //   } catch (error) {
  //     reject(error)
  //   }
  // })
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
  return httpGetAsync(`${MODULES_STATIC_URL}/bundles/${moduleName}.js`, 'text')
}

export const memoizedGetModuleTabAsync = memoize(getModuleTabAsync)
function getModuleTabAsync(tabName: string): Promise<string> {
  return httpGetAsync(`${MODULES_STATIC_URL}/tabs/${tabName}.js`, 'text')
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

export async function loadModuleTabsAsync(moduleName: string, node?: Node) {
  const moduleInfo = await checkModuleExists(moduleName, node)

  // Load the tabs for the current module
  return Promise.all(
    moduleInfo.tabs.map(async path => {
      const rawTabFile = await memoizedGetModuleTabAsync(path)
      try {
        return eval(rawTabFile)
      } catch (error) {
        // console.error('tab error:', error);
        throw new ModuleInternalError(path, error, node)
      }
    })
  )
}

export async function loadModuleBundleAsync(
  moduleName: string,
  context: Context,
  wrapModule: boolean,
  node?: Node
) {
  // await checkModuleExists(moduleName, node)
  const moduleText = await memoizedGetModuleBundleAsync(moduleName)
  try {
    const moduleBundle: ModuleBundle = eval(moduleText)

    if (wrapModule) return wrapSourceModule(moduleName, moduleBundle, getRequireProvider(context))
    return moduleBundle(getRequireProvider(context))
  } catch (error) {
    // console.error("bundle error: ", error)
    throw new ModuleInternalError(moduleName, error, node)
  }
}

export function resetMemoize() {
  (memoizedGetModuleBundleAsync as MemoizedFunction).cache.clear!();
  (memoizedGetModuleManifestAsync as MemoizedFunction).cache.clear!();
  (memoizedGetModuleTabAsync as MemoizedFunction).cache.clear!();
  (memoizedGetModuleDocsAsync as MemoizedFunction).cache.clear!()
}