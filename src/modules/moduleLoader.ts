import es from 'estree'
import { memoize } from 'lodash'
import { XMLHttpRequest as NodeXMLHttpRequest } from 'xmlhttprequest-ts'

import { Context } from '..'
import {
  ModuleConnectionError,
  ModuleInternalError,
  ModuleNotFoundError
} from '../errors/moduleErrors'
import { ModuleBundle, ModuleFunctions, Modules } from './moduleTypes'

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
function getModuleManifest(): Modules {
  const rawManifest = httpGet(`${MODULES_STATIC_URL}/modules.json`)
  return JSON.parse(rawManifest)
}

/**
 * Send a HTTP GET request to the modules endpoint to retrieve the specified file
 * @return String of module file contents
 */
export const memoizedGetModuleFile = memoize(getModuleFile)
function getModuleFile(name: string, type: 'tab' | 'bundle'): string {
  return httpGet(`${MODULES_STATIC_URL}/${type}s/${name}.js`)
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
    const moduleFunctions = moduleBundle(context)
    return moduleFunctions
  } catch (error) {
    throw new ModuleInternalError(path, node)
  }
}

export function convertRawTabToFunction(rawTabString: string): string {
  rawTabString = rawTabString.trim()
  return rawTabString.substring(0, rawTabString.length - 9) + ')'
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
      return eval(convertRawTabToFunction(rawTabFile))
    } catch (error) {
      throw new ModuleInternalError(path, node)
    }
  })
}

/**
 * Retrieves and appends the imported modules' tabs to the context
 * @param program
 * @param context
 */
export function appendModuleTabsToContext(program: es.Program, context: Context): void {
  // Rest the modules to empty array everytime
  context.modules = []
  for (const node of program.body) {
    if (node.type === 'ImportDeclaration') {
      if (!node.source.value) throw new ModuleNotFoundError('', node)
      const moduleName = node.source.value.toString()
      const moduleTab = loadModuleTabs(moduleName, node)
      console.log(moduleName, moduleTab)
      Array.prototype.push.apply(context.modules, moduleTab)
    }
  }
}
