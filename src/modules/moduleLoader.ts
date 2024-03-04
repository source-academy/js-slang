import es from 'estree'
import { memoize } from 'lodash'
import { XMLHttpRequest as NodeXMLHttpRequest } from 'xmlhttprequest-ts'

import {
  ModuleConnectionError,
  ModuleInternalError,
  ModuleNotFoundError
} from '../errors/moduleErrors'
import { Context } from '../types'
import { wrapSourceModule } from '../utils/operators'
import { ModuleBundle, ModuleDocumentation, ModuleFunctions, ModuleManifest } from './moduleTypes'
import { getRequireProvider } from './requireProvider'
import { evalRawTab } from './utils'

// Supports both JSDom (Web Browser) environment and Node environment
export const newHttpRequest = () =>
  typeof window === 'undefined' ? new NodeXMLHttpRequest() : new XMLHttpRequest()

// Default modules static url. Exported for testing.
export let MODULES_STATIC_URL = 'https://source-academy.github.io/modules'

export function setModulesStaticURL(url: string) {
  MODULES_STATIC_URL = url
}

/**
 * Send a HTTP Get request to the specified endpoint.
 * @return NodeXMLHttpRequest | XMLHttpRequest
 */
export function httpGet(url: string): string {
  const request = newHttpRequest()
  try {
    // If running function in node environment, set request timeout
    if (typeof window === 'undefined') request.timeout = 10000
    request.open('GET', url, false)
    request.send(null)
  } catch (error) {
    if (!(error instanceof DOMException)) throw error
  }
  if (request.status !== 200 && request.status !== 304) throw new ModuleConnectionError()
  return request.responseText
}

/**
 * Send a HTTP GET request to the modules endpoint to retrieve the manifest
 * @return Modules
 */
export const memoizedGetModuleManifest = memoize(getModuleManifest)
function getModuleManifest(): ModuleManifest {
  const rawManifest = httpGet(`${MODULES_STATIC_URL}/modules.json`)
  return JSON.parse(rawManifest)
}

/**
 * Send a HTTP GET request to the modules endpoint to retrieve the specified file
 * @return String of module file contents
 */

const memoizedGetModuleFileInternal = memoize(getModuleFile)
export const memoizedGetModuleFile = (name: string, type: 'tab' | 'bundle' | 'json') =>
  memoizedGetModuleFileInternal({ name, type })
function getModuleFile({ name, type }: { name: string; type: 'tab' | 'bundle' | 'json' }): string {
  return httpGet(`${MODULES_STATIC_URL}/${type}s/${name}.js${type === 'json' ? 'on' : ''}`)
}

/**
 * Loads the respective module package (functions from the module)
 * @param path imported module name
 * @param context
 * @param node import declaration node
 * @returns the module's functions object
 */
export function loadModuleBundle(path: string, context: Context, node?: es.Node): ModuleFunctions {
  const modules = memoizedGetModuleManifest()

  // Check if the module exists
  const moduleList = Object.keys(modules)
  if (moduleList.includes(path) === false) throw new ModuleNotFoundError(path, node)

  // Get module file
  const moduleText = memoizedGetModuleFile(path, 'bundle')
  try {
    const moduleBundle: ModuleBundle = eval(moduleText)
    return wrapSourceModule(path, moduleBundle, getRequireProvider(context))
  } catch (error) {
    // console.error("bundle error: ", error)
    throw new ModuleInternalError(path, error, node)
  }
}

/**
 * Loads the module contents of a package
 *
 * @param path imported module name
 * @param node import declaration node
 * @returns an array of functions
 */
export function loadModuleTabs(path: string, node?: es.Node) {
  const modules = memoizedGetModuleManifest()
  // Check if the module exists
  const moduleList = Object.keys(modules)
  if (moduleList.includes(path) === false) throw new ModuleNotFoundError(path, node)

  // Retrieves the tabs the module has from modules.json
  const sideContentTabPaths: string[] = modules[path].tabs
  // Load the tabs for the current module
  return sideContentTabPaths.map(path => {
    const rawTabFile = memoizedGetModuleFile(path, 'tab')
    try {
      return evalRawTab(rawTabFile)
    } catch (error) {
      // console.error('tab error:', error);
      throw new ModuleInternalError(path, error, node)
    }
  })
}

export const memoizedloadModuleDocs = memoize(loadModuleDocs)
export function loadModuleDocs(path: string, node?: es.Node) {
  try {
    const modules = memoizedGetModuleManifest()
    // Check if the module exists
    const moduleList = Object.keys(modules)
    if (!moduleList.includes(path)) throw new ModuleNotFoundError(path, node)
    const result = getModuleFile({ name: path, type: 'json' })
    return JSON.parse(result) as ModuleDocumentation
  } catch (error) {
    console.warn('Failed to load module documentation')
    return null
  }
}

export function initModuleContext(
  moduleName: string,
  context: Context,
  loadTabs: boolean,
  node?: es.Node
) {
  if (!(moduleName in context.moduleContexts)) {
    context.moduleContexts[moduleName] = {
      state: null,
      tabs: loadTabs ? loadModuleTabs(moduleName, node) : null
    }
  } else if (context.moduleContexts[moduleName].tabs === null && loadTabs) {
    context.moduleContexts[moduleName].tabs = loadModuleTabs(moduleName, node)
  }
}
