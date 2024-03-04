import type { MockedFunction } from 'jest-mock'

import { mockContext } from '../../mocks/context'
import { Chapter, Variant } from '../../types'
import { ModuleConnectionError, ModuleInternalError } from '../errors'
import { MODULES_STATIC_URL } from '../moduleLoader'
import * as moduleLoader from '../moduleLoaderAsync'

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  memoize: jest.fn(x => x)
}))

global.fetch = jest.fn()
const mockedFetch = fetch as MockedFunction<typeof fetch>

function mockResponse(response: string, status: number = 200) {
  mockedFetch.mockResolvedValueOnce({
    text: () => Promise.resolve(response),
    json: () => Promise.resolve(JSON.parse(response)),
    status
  } as any)
}

async function expectSuccess<T extends string | object>(
  correctUrl: string,
  expectedResp: T,
  func: () => Promise<T>,
  callCount: number = 1
) {
  const response = await func()

  expect(fetch).toHaveBeenCalledTimes(callCount)

  const [calledUrl, callOpts] = mockedFetch.mock.calls[0]
  expect(calledUrl).toEqual(correctUrl)
  expect(callOpts).toMatchObject({ method: 'GET' })
  if (typeof expectedResp === 'string') {
    expect(response).toEqual(expectedResp)
  } else {
    expect(response).toMatchObject(expectedResp)
  }
}

async function expectFailure(sampleUrl: string, expectedErr: any, func: () => Promise<any>) {
  await expect(() => func()).rejects.toBeInstanceOf(expectedErr)

  const [calledUrl, callOpts] = mockedFetch.mock.calls[0]
  expect(calledUrl).toEqual(sampleUrl)
  expect(callOpts).toMatchObject({ method: 'GET' })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Test httpGetAsync', () => {
  test('Http GET function httpGetAsync() works correctly', async () => {
    const sampleResponse = `{ "repeat": { "contents": ["Repeat"] } }`
    const sampleUrl = 'https://www.example.com'

    mockResponse(sampleResponse)
    await expectSuccess(sampleUrl, sampleResponse, () =>
      moduleLoader.httpGetAsync(sampleUrl, 'text')
    )
  })

  test('Http GET function httpGetAsync() throws ModuleConnectionError', async () => {
    const sampleUrl = 'https://www.example.com'
    mockResponse('', 404)

    await expectFailure(sampleUrl, ModuleConnectionError, () =>
      moduleLoader.httpGetAsync(sampleUrl, 'text')
    )
  })

  test('Http GET modules manifest correctly', async () => {
    const sampleResponse = `{ "repeat": { "contents": ["Repeat"] } }`
    const correctUrl = MODULES_STATIC_URL + `/modules.json`
    mockResponse(sampleResponse)

    await expectSuccess(correctUrl, JSON.parse(sampleResponse), () =>
      moduleLoader.memoizedGetModuleManifestAsync()
    )
  })

  test('Http GET returns objects when "json" is specified', async () => {
    const sampleResponse = `{ "repeat": { "contents": ["Repeat"] } }`
    const correctUrl = MODULES_STATIC_URL + `/modules.json`
    mockResponse(sampleResponse)
    const result = await moduleLoader.httpGetAsync(correctUrl, 'json')
    expect(result).toMatchObject(JSON.parse(sampleResponse))
  })

  test('Handles TypeErrors thrown by fetch', async () => {
    mockedFetch.mockImplementationOnce(() => {
      throw new TypeError()
    })
    await expectFailure('anyUrl', ModuleConnectionError, () =>
      moduleLoader.httpGetAsync('anyUrl', 'text')
    )
  })
})

describe('Test bundle loading', () => {
  const sampleModuleName = 'valid_module'
  const sampleModuleUrl = MODULES_STATIC_URL + `/bundles/${sampleModuleName}.js`

  test('Http GET module bundle correctly', async () => {
    const sampleResponse = `require => ({ foo: () => 'foo' })`
    mockResponse(sampleResponse)

    const bundleText = await moduleLoader.memoizedGetModuleBundleAsync(sampleModuleName)

    expect(fetch).toHaveBeenCalledTimes(1)

    const [calledUrl, callOpts] = mockedFetch.mock.calls[0]
    expect(calledUrl).toEqual(sampleModuleUrl)
    expect(callOpts).toMatchObject({ method: 'GET' })
    expect(bundleText).toEqual(sampleResponse)
  })

  test('Loading a correctly implemented module bundle', async () => {
    const context = mockContext(Chapter.SOURCE_4, Variant.DEFAULT)
    const sampleResponse = `require => ({ foo: () => 'foo' })`
    mockResponse(sampleResponse)

    const loadedModule = await moduleLoader.loadModuleBundleAsync(sampleModuleName, context, false)

    expect(loadedModule.foo()).toEqual('foo')
    expect(fetch).toHaveBeenCalledTimes(1)

    const [calledUrl, callOpts] = mockedFetch.mock.calls[0]
    expect(calledUrl).toEqual(sampleModuleUrl)
    expect(callOpts).toMatchObject({ method: 'GET' })
  })

  test('Loading a wrongly implemented module bundle throws ModuleInternalError', async () => {
    const context = mockContext(Chapter.SOURCE_4, Variant.DEFAULT)
    const wrongModuleText = `export function es6_function(params) {};`
    mockResponse(wrongModuleText)
    await expect(() =>
      moduleLoader.loadModuleBundleAsync(sampleModuleName, context, true)
    ).rejects.toBeInstanceOf(ModuleInternalError)

    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('Test tab loading', () => {
  const sampleTabUrl = `${MODULES_STATIC_URL}/tabs/Tab1.js`
  const sampleManifest = `{ "one_module": { "tabs": ["Tab1", "Tab2"] } }`

  test('Http GET module tab correctly', async () => {
    const sampleResponse = `require => ({ foo: () => 'foo' })`
    mockResponse(sampleResponse)

    const bundleText = await moduleLoader.memoizedGetModuleTabAsync('Tab1')

    expect(fetch).toHaveBeenCalledTimes(1)

    const [calledUrl, callOpts] = mockedFetch.mock.calls[0]
    expect(calledUrl).toEqual(sampleTabUrl)
    expect(callOpts).toMatchObject({ method: 'GET' })
    expect(bundleText).toEqual(sampleResponse)
  })

  test('Loading a wrongly implemented tab throws ModuleInternalError', async () => {
    mockResponse(sampleManifest)

    const wrongTabText = `export function es6_function(params) {};`
    mockResponse(wrongTabText)
    mockResponse(wrongTabText)

    await expect(() => moduleLoader.loadModuleTabsAsync('one_module')).rejects.toBeInstanceOf(
      ModuleInternalError
    )
    expect(fetch).toHaveBeenCalledTimes(3)

    const [[call0Url], [call1Url], [call2Url]] = mockedFetch.mock.calls
    expect(call0Url).toEqual(`${MODULES_STATIC_URL}/modules.json`)
    expect(call1Url).toEqual(`${MODULES_STATIC_URL}/tabs/Tab1.js`)
    expect(call2Url).toEqual(`${MODULES_STATIC_URL}/tabs/Tab2.js`)
  })

  test('Able to handle tabs with export default declarations', async () => {
    mockResponse(sampleManifest)
    mockResponse(`export default require => ({ foo: () => 'foo' })`)
    mockResponse(`require => ({ foo: () => 'foo' })`)
    const [rawTab1, rawTab2] = await moduleLoader.loadModuleTabsAsync('one_module')
    const tab1 = rawTab1(jest.fn())
    expect(tab1.foo()).toEqual('foo')

    const tab2 = rawTab2(jest.fn())
    expect(tab2.foo()).toEqual('foo')
  })
})
