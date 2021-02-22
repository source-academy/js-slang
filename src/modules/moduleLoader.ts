import { memoize } from 'lodash'
import { ModuleNotFound, ModuleInternalError } from '../errors/errors'
import { XMLHttpRequest as NodeXMLHttpRequest } from 'xmlhttprequest-ts'
import { Context } from '..'
const HttpRequest = typeof window === 'undefined' ? NodeXMLHttpRequest : XMLHttpRequest

let BACKEND_STATIC_URL = 'https://source-academy.github.io/modules'

export function setBackendStaticURL(url: string) {
  BACKEND_STATIC_URL = url
}

/**
 * Loads the respective module package (functions from the module)
 *
 * @param path imported module name
 * @param context
 * @param moduleText object of functions as a String
 * @returns an object of functions
 */
export function loadModulePackage(path: string, context: Context, moduleText?: string) {
  try {
    if (moduleText === undefined) {
      moduleText = loadModulePackageText(path)
    }
    const modulePackage = eval(moduleText)
    const moduleObject = modulePackage(context)
    return moduleObject
  } catch (_error) {
    if (_error instanceof ModuleNotFound) {
      throw _error
    }
    throw new ModuleInternalError(path)
  }
}

/**
 * Loads the respective module package (functions from the module) as a String
 * Memoized by lodash
 *
 * @param path imported module name
 * @returns object functions as String
 */
export const loadModulePackageText = memoize((path: string): string => {
  const scriptPath = `${BACKEND_STATIC_URL}/packages/${path}.js`
  const req = new HttpRequest()
  try {
    // Set the request timeout here to 10 seconds
    if (window instanceof NodeXMLHttpRequest) {
      req.timeout = 10000
    }
    req.open('GET', scriptPath, false)
    req.send(null)
  } catch (error) {
    // Catch DOMException thrown by request when module path is not found and
    // request timesout (For jsdom environment)
    // For node environment, the request doesnt throw any errors...
    if (!(error instanceof DOMException)) throw error
  }

  if (req.status !== 200 && req.status !== 304) {
    throw new ModuleNotFound(path)
  }
  return req.responseText
})

/**
 * Loads the module contents of a package
 *
 * @param path imported module name
 * @returns an array of functions
 */
export function loadModuleContent(path: string) {
  try {
    const modules = loadModulesJSON()
    // Retrieves the contents the module has from modules.json
    const sideContentTabPaths: string[] = modules[path]['contents']
    const sideContentTabs: any[] = []
    // Load the contents for the current module
    sideContentTabPaths.forEach(path => {
      sideContentTabs.push(eval(loadModulesContentText(path)))
    })
    return sideContentTabs
  } catch (_error) {
    throw new ModuleInternalError(path)
  }
}

/**
 * Loads respective module content as a String
 * Memoized by lodash
 *
 * @param path imported module name
 * @returns module content as a String
 */
const loadModulesContentText = memoize((path: string): string => {
  const scriptPath = `${BACKEND_STATIC_URL}/contents/${path}.js`
  const req = new HttpRequest()
  try {
    // Set the request timeout here to 10 seconds
    if (window instanceof NodeXMLHttpRequest) {
      req.timeout = 10000
    }
    req.open('GET', scriptPath, false)
    req.send(null)
  } catch (error) {
    // Catch DOMException thrown by request when module path is not found and
    // request timesout (For jsdom environment)
    // For node environment, the request doesnt throw any errors...
    if (!(error instanceof DOMException)) throw error
  }
  if (req.status !== 200 && req.status !== 304) {
    throw new ModuleNotFound(path)
  }
  const contentText = req.responseText
  // remove "(React);" at the back of the contentText
  return contentText.trim().substring(0, contentText.length - 10)
})

/**
 * Loads modules.json which contains the contents to be loaded for each package
 * Memoized by lodash
 *
 * @return modules JSON
 */
const loadModulesJSON = memoize(() => {
  const scriptPath = `${BACKEND_STATIC_URL}/modules.json`
  const req = new HttpRequest()
  try {
    if (window instanceof NodeXMLHttpRequest) {
      // Set the request timeout here to 10 seconds
      req.timeout = 10000
    }
    req.open('GET', scriptPath, false)
    req.send(null)
  } catch (error) {
    // Catch DOMException thrown by request when modules.json is not found and
    // request timesout (For jsdom environment)
    // For node environment, the request doesnt throw any errors...
    if (!(error instanceof DOMException)) throw error
  }
  if (req.status !== 200 && req.status !== 304) {
    throw new ModuleInternalError('modules.json')
  }
  return JSON.parse(req.responseText)
})
