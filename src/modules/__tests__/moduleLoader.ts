import { createEmptyContext } from '../../createContext'
import { ModuleConnectionError, ModuleInternalError } from '../../errors/moduleErrors'
import { Variant } from '../../types'
import { stripIndent } from '../../utils/formatters'
import * as moduleLoader from '../moduleLoader'

// Mock memoize function from lodash
jest.mock('lodash', () => ({ memoize: jest.fn(func => func) }))

/**
 * Mock XMLHttpRequest from jsdom environment
 *
 * @returns Mocked
 */
const mockXMLHttpRequest = (xhr: Partial<XMLHttpRequest> = {}) => {
  const xhrMock: Partial<XMLHttpRequest> = {
    open: jest.fn(() => {}),
    send: jest.fn(() => {}),
    status: 200,
    responseText: 'Hello World!',
    ...xhr
  }
  jest.spyOn(window, 'XMLHttpRequest').mockImplementationOnce(() => xhrMock as XMLHttpRequest)
  return xhrMock
}

describe('Testing modules/moduleLoader.ts in a jsdom environment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('Check instance of HttpRequest', () => {
    // XMLHttpRequest only if environment is jsdom.
    expect(moduleLoader.newHttpRequest()).toBeInstanceOf(XMLHttpRequest)
  })

  test('Modify MODULES_STATIC_URL using setModulesStaticURL()', () => {
    const previousStaticUrl = moduleLoader.MODULES_STATIC_URL
    const newUrl = previousStaticUrl + 'R9JVlSkma6LZs1efkQ1K'
    moduleLoader.setModulesStaticURL(newUrl)
    expect(moduleLoader.MODULES_STATIC_URL).toBe(newUrl)
  })

  test('Http GET function httpGet() works correctly', () => {
    const sampleResponse = `{ "repeat": { "contents": ["Repeat"] } }`
    const sampleUrl = 'https://www.example.com'
    const mockedXMLHttpRequest = mockXMLHttpRequest({ responseText: sampleResponse })
    const response = moduleLoader.httpGet(sampleUrl)
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledWith('GET', sampleUrl, false)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledWith(null)
    expect(response).toEqual(sampleResponse)
  })

  test('Http GET function httpGet() throws ModuleConnectionError', () => {
    const sampleUrl = 'https://www.example.com'
    const mockedXMLHttpRequest = mockXMLHttpRequest({ status: 404 })
    expect(() => moduleLoader.httpGet(sampleUrl)).toThrow(ModuleConnectionError)
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledWith('GET', sampleUrl, false)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledWith(null)
  })

  test('Http GET modules manifest correctly', () => {
    const sampleResponse = `{ "repeat": { "contents": ["Repeat"] } }`
    const mockedXMLHttpRequest = mockXMLHttpRequest({ responseText: sampleResponse })
    const response = moduleLoader.memoizedGetModuleManifest()
    const correctUrl = moduleLoader.MODULES_STATIC_URL + `/modules.json`
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledWith('GET', correctUrl, false)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledWith(null)
    expect(response).toEqual(JSON.parse(sampleResponse))
  })

  test('Http GET module bundle correctly', () => {
    const validModuleBundle = 'valid_module'
    const sampleResponse = `(function () {'use strict'; function index(_params) { return { }; } return index; })();`
    const correctUrl = moduleLoader.MODULES_STATIC_URL + `/bundles/${validModuleBundle}.js`
    const mockedXMLHttpRequest = mockXMLHttpRequest({ responseText: sampleResponse })
    const response = moduleLoader.memoizedGetModuleFile(validModuleBundle, 'bundle')
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledWith('GET', correctUrl, false)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledWith(null)
    expect(response).toEqual(sampleResponse)
  })

  test('Http GET module tab correctly', () => {
    const validModuleTab = 'ModuleTab'
    const sampleResponse = `(function (React) {});`
    const correctUrl = moduleLoader.MODULES_STATIC_URL + `/tabs/${validModuleTab}.js`
    const mockedXMLHttpRequest = mockXMLHttpRequest({ responseText: sampleResponse })
    const response = moduleLoader.memoizedGetModuleFile(validModuleTab, 'tab')
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.open).toHaveBeenCalledWith('GET', correctUrl, false)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest.send).toHaveBeenCalledWith(null)
    expect(response).toEqual(sampleResponse)
  })

  test('Loading a module bundle correctly', () => {
    const sampleManifest = `{ "module": { "tabs": [] } }`
    mockXMLHttpRequest({ responseText: sampleManifest })
    const sampleResponse = stripIndent`require => { 
      return {
        make_empty_array: () => []
      }
    }`
    mockXMLHttpRequest({ responseText: sampleResponse })
    const loadedBundle = moduleLoader.loadModuleBundle(
      'module',
      createEmptyContext(1, Variant.DEFAULT, [])
    )
    expect(loadedBundle.make_empty_array()).toEqual([])
  })

  test('Loading a wrongly implemented module bundle throws ModuleInternalError', () => {
    const sampleManifest = `{ "module": { "tabs": [] } }`
    mockXMLHttpRequest({ responseText: sampleManifest })
    const wrongModuleText = `export function es6_function(params) {};`
    mockXMLHttpRequest({ responseText: wrongModuleText })
    expect(() =>
      moduleLoader.loadModuleBundle('module', createEmptyContext(1, Variant.DEFAULT, []))
    ).toThrow(ModuleInternalError)
  })

  test('Loading module tabs correctly', () => {
    const validModule = 'valid_module'
    const sampleResponse = `{ "${validModule}": { "tabs": ["Tab1", "Tab2"] } }`
    const mockedXMLHttpRequest1 = mockXMLHttpRequest({ responseText: sampleResponse })
    const mockedXMLHttpRequest2 = mockXMLHttpRequest({
      responseText: '(function (React) {});'
    })
    const mockedXMLHttpRequest3 = mockXMLHttpRequest({
      responseText: '(function (React) {});'
    })
    const sideContentTabs = moduleLoader.loadModuleTabs(validModule)
    const correctUrl1 = moduleLoader.MODULES_STATIC_URL + `/modules.json`
    expect(mockedXMLHttpRequest1.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest1.open).toHaveBeenCalledWith('GET', correctUrl1, false)
    expect(mockedXMLHttpRequest1.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest1.send).toHaveBeenCalledWith(null)
    const correctUrl2 = moduleLoader.MODULES_STATIC_URL + `/tabs/Tab1.js`
    expect(mockedXMLHttpRequest2.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest2.open).toHaveBeenCalledWith('GET', correctUrl2, false)
    expect(mockedXMLHttpRequest2.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest2.send).toHaveBeenCalledWith(null)
    const correctUrl3 = moduleLoader.MODULES_STATIC_URL + `/tabs/Tab2.js`
    expect(mockedXMLHttpRequest3.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest3.open).toHaveBeenCalledWith('GET', correctUrl3, false)
    expect(mockedXMLHttpRequest3.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest3.send).toHaveBeenCalledWith(null)
    expect(sideContentTabs.length).toBe(2)
  })

  test('Loading wrongly implemented module tabs correctly throws ModuleInternalError', () => {
    const validModule = 'valid_module'
    const sampleResponse = `{ "${validModule}": { "tabs": ["Tab1", "Tab2"] } }`
    const mockedXMLHttpRequest1 = mockXMLHttpRequest({ responseText: sampleResponse })
    const mockedXMLHttpRequest2 = mockXMLHttpRequest({
      responseText: '(function (React) {});'
    })
    const mockedXMLHttpRequest3 = mockXMLHttpRequest({
      responseText: '(function (React) {}))'
    })
    expect(() => moduleLoader.loadModuleTabs(validModule)).toThrow(ModuleInternalError)
    const correctUrl1 = moduleLoader.MODULES_STATIC_URL + `/modules.json`
    expect(mockedXMLHttpRequest1.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest1.open).toHaveBeenCalledWith('GET', correctUrl1, false)
    expect(mockedXMLHttpRequest1.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest1.send).toHaveBeenCalledWith(null)
    const correctUrl2 = moduleLoader.MODULES_STATIC_URL + `/tabs/Tab1.js`
    expect(mockedXMLHttpRequest2.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest2.open).toHaveBeenCalledWith('GET', correctUrl2, false)
    expect(mockedXMLHttpRequest2.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest2.send).toHaveBeenCalledWith(null)
    const correctUrl3 = moduleLoader.MODULES_STATIC_URL + `/tabs/Tab2.js`
    expect(mockedXMLHttpRequest3.open).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest3.open).toHaveBeenCalledWith('GET', correctUrl3, false)
    expect(mockedXMLHttpRequest3.send).toHaveBeenCalledTimes(1)
    expect(mockedXMLHttpRequest3.send).toHaveBeenCalledWith(null)
  })

  test('Able to load tabs with export default declarations', () => {
    mockXMLHttpRequest({ responseText: `{ "valid_module": { "tabs": ["Tab1", "Tab2"] } }` })
    mockXMLHttpRequest({ responseText: `export default require => ({ foo: () => 'foo' })` })
    mockXMLHttpRequest({ responseText: `require => ({ foo: () => 'foo' })` })

    const [rawTab1, rawTab2] = moduleLoader.loadModuleTabs('valid_module')
    const tab1 = rawTab1(jest.fn())
    expect(tab1.foo()).toEqual('foo')

    const tab2 = rawTab2(jest.fn())
    expect(tab2.foo()).toEqual('foo')
  })
})
