import { XMLHttpRequest as NodeXMLHttpRequest } from 'xmlhttprequest-ts'
const HttpRequest = typeof window === 'undefined' ? NodeXMLHttpRequest : XMLHttpRequest

// TODO: Change this URL to actual Backend URL
const BACKEND_STATIC_URL = 'http://ec2-54-169-81-133.ap-southeast-1.compute.amazonaws.com/static'

export function loadIIFEModuleText(path: string) {
  const scriptPath = `${BACKEND_STATIC_URL}/${path}.js`
  const req = new HttpRequest()
  req.open('GET', scriptPath, false)
  req.send(null)
  if (req.status != 200 && req.status != 304) {
    throw new Error(`module ${path} not found.`)
  }
  return req.responseText
}

/* tslint:disable */
export function loadIIFEModule(path: string) {
  return eval(loadIIFEModuleText(path)) as object
}
