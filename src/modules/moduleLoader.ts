import { memoize } from 'lodash'
import { ModuleNotFound, ModuleInternalError } from '../errors/errors'
import { XMLHttpRequest as NodeXMLHttpRequest } from 'xmlhttprequest-ts'
import { Context } from '..'
const HttpRequest = typeof window === 'undefined' ? NodeXMLHttpRequest : XMLHttpRequest

let BACKEND_STATIC_URL = 'https://source-academy.github.io/modules'

export function setBackendStaticURL(url: string) {
  BACKEND_STATIC_URL = url
}

function loadModuleText(path: string) {
  const scriptPath = `${BACKEND_STATIC_URL}/${path}.js`
  const req = new HttpRequest()
  req.open('GET', scriptPath, false)
  req.send(null)
  if (req.status !== 200 && req.status !== 304) {
    throw new ModuleNotFound(path)
  }
  return req.responseText
}

// Uses lodash to memoize loadModuleText
export const memoizedLoadModuleText = memoize(loadModuleText)

export function loadModule(path: string, context: Context, moduleText?: string) {
  try {
    if (moduleText === undefined) {
      moduleText = memoizedLoadModuleText(path)
    }
    // tslint:disable-next-line:no-eval
    const moduleLib = eval(moduleText)
    const moduleObject = moduleLib({ runes: {}, ...context.moduleParams })
    return moduleObject
  } catch (_error) {
    if (_error instanceof ModuleNotFound) {
      throw _error
    }
    throw new ModuleInternalError(path)
  }
}
