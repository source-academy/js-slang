let HttpRequest = require('xmlhttprequest').XMLHttpRequest
if (typeof window !== 'undefined') {
  HttpRequest = XMLHttpRequest
}

const BACKEND_STATIC_URL = 'http://0.0.0.0:4000/static'

export function loadIIFEModuleText(path: string) {
  const scriptPath = `${BACKEND_STATIC_URL}/${path}.js`
  const req = new HttpRequest()
  req.open('GET', scriptPath, false)
  req.send(null)
  return req.responseText
}

export function loadIIFEModule(path: string) {
  return eval(loadIIFEModuleText(path)) as object
}