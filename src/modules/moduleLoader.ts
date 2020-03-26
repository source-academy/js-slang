import { XMLHttpRequest as NodeXMLHttpRequest } from 'xmlhttprequest-ts'
const HttpRequest = typeof window === 'undefined' ? NodeXMLHttpRequest : XMLHttpRequest

// TODO: Change this URL to actual Backend URL
const BACKEND_STATIC_URL = 'http://0.0.0.0:4000/static'

export function loadIIFEModuleText(path: string) {
  const scriptPath = `${BACKEND_STATIC_URL}/${path}.js`
  const req = new HttpRequest()
  req.open('GET', scriptPath, false)
  req.send(null)
  return req.responseText
}

/* tslint:disable */
export function loadIIFEModule(path: string) {
  return eval(loadIIFEModuleText(path)) as object
}
