import { Node } from 'estree'
import { memoize } from 'lodash'

import type { Context } from '..'
import { ModuleInternalError, ModuleNotFoundError } from '../errors/moduleErrors'
import { wrapSourceModule } from '../utils/operators'
import { httpGet, MODULES_STATIC_URL } from './moduleLoader'
import type { ModuleBundle, ModuleDocumentation, ModuleManifest } from './moduleTypes'
import { getRequireProvider } from './requireProvider'

async function httpGetAsync(path: string) {
  return new Promise<string>((resolve, reject) => {
    try {
      resolve(httpGet(path))
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Send a HTTP GET request to the modules endpoint to retrieve the manifest
 * @return Modules
 */
export const memoizedGetModuleManifestAsync = memoize(getModuleManifestAsync)
async function getModuleManifestAsync(): Promise<ModuleManifest> {
  const rawManifest = await httpGetAsync(`${MODULES_STATIC_URL}/modules.json`)
  return JSON.parse(rawManifest)
}

async function checkModuleExists(moduleName: string, node?: Node) {
  const modules = await memoizedGetModuleManifestAsync()
  // Check if the module exists
  if (!(moduleName in modules)) throw new ModuleNotFoundError(moduleName, node)

  return modules[moduleName]
}

export const memoizedGetModuleBundleAsync = memoize(getModuleBundleAsync)
async function getModuleBundleAsync(moduleName: string, node?: Node): Promise<string> {
  await checkModuleExists(moduleName, node)
  return httpGetAsync(`${MODULES_STATIC_URL}/bundles/${moduleName}.js`)
}

export const memoizedGetModuleTabAsync = memoize(getModuleTabAsync)
function getModuleTabAsync(tabName: string): Promise<string> {
  return httpGetAsync(`${MODULES_STATIC_URL}/tabs/${tabName}.js`)
}

export const memoizedGetModuleDocsAsync = memoize(getModuleDocsAsync)
async function getModuleDocsAsync(
  moduleName: string,
  node?: Node
): Promise<ModuleDocumentation | null> {
  try {
    await checkModuleExists(moduleName, node)
    const rawDocs = await httpGetAsync(`${MODULES_STATIC_URL}/jsons/${moduleName}.json`)
    return JSON.parse(rawDocs)
  } catch (error) {
    console.warn(`Failed to load documentation for ${moduleName}`)
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

export async function loadModuleBundleAsync(moduleName: string, context: Context, node?: Node) {
  await checkModuleExists(moduleName, node)
  const moduleText = await memoizedGetModuleBundleAsync(moduleName)
  try {
    const moduleBundle: ModuleBundle = eval(moduleText)
    return wrapSourceModule(moduleName, moduleBundle, getRequireProvider(context))
  } catch (error) {
    // console.error("bundle error: ", error)
    throw new ModuleInternalError(moduleName, error, node)
  }
}
