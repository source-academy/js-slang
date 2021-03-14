import { memoize } from 'lodash'
import { ModuleNotFound, ModuleInternalError } from '../errors/errors'
import { XMLHttpRequest as NodeXMLHttpRequest } from 'xmlhttprequest-ts'
import { Context } from '..'

// Supports both JSDom (Web Browser) environment and Node environment
export const newHttpRequest = () =>
  typeof window === 'undefined' ? new NodeXMLHttpRequest() : new XMLHttpRequest()

// Default modules static url. Exported for testing.
export let MODULES_STATIC_URL = 'https://source-academy.github.io/modules'

export function setModulesStaticURL(url: string) {
  MODULES_STATIC_URL = url
}

/**
 * Send a HTTP GET request to the modules endpoint to retrieve the specified file
 * @return String of module file contents
 */
export const memoizedGetModuleFile = memoize(getModuleFile)
function getModuleFile(type: 'manifest'): string
function getModuleFile(type: 'tab' | 'bundle', name: string): string
function getModuleFile(type: 'tab' | 'bundle' | 'manifest', name?: string): string {
  const request = newHttpRequest()
  try {
    // If running function in node environment, set request timeout
    if (typeof window === 'undefined') request.timeout = 10000
    const url =
      type === 'manifest'
        ? MODULES_STATIC_URL + `/modules.json`
        : MODULES_STATIC_URL + `/${type}s/${name}.js`
    request.open('GET', url, false)
    request.send(null)
  } catch (error) {
    if (!(error instanceof DOMException)) throw error
  }
  if (request.status !== 200 && request.status !== 304) throw new ModuleNotFound(name || 'manifest')
  return request.responseText
}

/**
 * Loads the respective module package (functions from the module)
 *
 * @param path imported module name
 * @param context
 * @param moduleText object of functions as a String
 * @returns an object of functions
 */
export function loadModuleBundle(path: string, context: Context, moduleText?: string) {
  try {
    if (moduleText === undefined) moduleText = memoizedGetModuleFile('bundle', path)
    const moduleBundle = eval(moduleText)
    const moduleFunctions = moduleBundle(context)
    return moduleFunctions
  } catch (_error) {
    if (_error instanceof ModuleNotFound) throw _error
    throw new ModuleInternalError(path)
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
 * @returns an array of functions
 */
export function loadModuleTabs(path: string) {
  try {
    const modules = JSON.parse(memoizedGetModuleFile('manifest'))
    // Retrieves the contents the module has from modules.json
    const sideContentTabPaths: string[] = modules[path]['tabs'] || []
    // Load the contents for the current module
    return sideContentTabPaths.map(path => {
      const rawTabFile = memoizedGetModuleFile('tab', path)
      return eval(convertRawTabToFunction(rawTabFile))
    })
  } catch (_error) {
    if (_error instanceof ModuleNotFound) throw _error
    throw new ModuleInternalError(path)
  }
}
