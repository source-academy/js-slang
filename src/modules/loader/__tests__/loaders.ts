import { mockContext } from '../../../mocks/context'
import { Chapter, Variant } from '../../../types'
import { ModuleConnectionError, ModuleNotFoundError } from '../../errors'
import * as moduleLoader from '../loaders'
import type { ModuleDocumentation, ModuleManifest } from '../../moduleTypes'
import { funcAsMockedFunc } from '../../../utils/testing'

const moduleMocker = jest.fn()

// Using virtual modules, we can pretend the modules with the given
// import path actually exist
// When testing the import loader we can generally rely on the mocked versions
// under __mocks__ instead.
jest.mock(
  'mockModules/bundles/one_module.js',
  () => ({
    default: moduleMocker
  }),
  { virtual: true }
)

jest.mock(
  `mockModules/tabs/tab1.js`,
  () => ({
    default: () => 'tab1'
  }),
  { virtual: true }
)

jest.mock(
  `mockModules/tabs/tab2.js`,
  () => ({
    default: () => 'tab2'
  }),
  { virtual: true }
)

jest.spyOn(moduleLoader, 'docsImporter')

global.fetch = jest.fn()
const mockedFetch = funcAsMockedFunc(fetch)

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.resetModules()
})

describe('bundle loading', () => {
  test('Loading a single bundle', async () => {
    const context = mockContext(Chapter.SOURCE_4, Variant.DEFAULT)
    moduleMocker.mockReturnValueOnce({
      foo() {
        return this.foo.name
      },
      bar: () => 'bar'
    })
    const mod = await moduleLoader.loadModuleBundleAsync('one_module', context)
    expect(mod.foo()).toEqual('foo')
    expect(mod.foo[moduleLoader.sourceModuleObject]).toEqual(true)
  })

  test('Should throw ModuleConnectionError when unable to reach modules server', () => {
    const context = mockContext(Chapter.SOURCE_4, Variant.DEFAULT)
    const promise = moduleLoader.loadModuleBundleAsync('unknown_module', context)
    return expect(promise).rejects.toBeInstanceOf(ModuleConnectionError)
  })
})

describe('tab loading', () => {
  test("Load a module's tabs", async () => {
    mockedFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          one_module: {
            tabs: ['tab1', 'tab2']
          }
        })
    } as any)
    const tabs = await moduleLoader.loadModuleTabsAsync('one_module')

    expect(tabs[0]({} as any)).toEqual('tab1')
    expect(tabs[1]({} as any)).toEqual('tab2')
  })
})

describe('docs loading', () => {
  const mockedDocsImporter = funcAsMockedFunc(moduleLoader.docsImporter)

  beforeEach(() => {
    mockedDocsImporter.mockClear()
  })

  describe('test memoizedGetModuleManifestAsync', () => {
    beforeEach(() => {
      moduleLoader.memoizedGetModuleManifestAsync.reset()
    })

    test('manifest is memoized on success', async () => {
      const mockManifest: ModuleManifest = {
        one_module: {
          tabs: []
        }
      }
      mockedDocsImporter.mockResolvedValueOnce({ default: mockManifest })

      const result = await moduleLoader.memoizedGetModuleManifestAsync()
      expect(result).toMatchObject(mockManifest)

      const result2 = await moduleLoader.memoizedGetModuleManifestAsync()
      expect(result2).toMatchObject(mockManifest)

      const result3 = await moduleLoader.memoizedGetModuleManifestAsync()
      expect(result3).toMatchObject(mockManifest)

      expect(moduleLoader.docsImporter).toHaveBeenCalledTimes(1)
    })

    test('manifest is not memoized on error', async () => {
      const mockError = new ModuleNotFoundError('one_module')

      mockedDocsImporter.mockRejectedValueOnce(mockError)
      const result = moduleLoader.memoizedGetModuleManifestAsync()
      expect(result).rejects.toBe(mockError)

      const mockManifest: ModuleManifest = {
        one_module: {
          tabs: []
        }
      }

      mockedDocsImporter.mockResolvedValueOnce({ default: mockManifest })
      const result2 = await moduleLoader.memoizedGetModuleManifestAsync()
      expect(result2).toMatchObject(mockManifest)

      expect(moduleLoader.docsImporter).toHaveBeenCalledTimes(2)
    })
  })

  describe('test memoizedGetModuleDocsAsync', () => {
    beforeEach(() => {
      moduleLoader.memoizedGetModuleDocsAsync.cache.clear()
    })

    test('docs are memoized on success', async () => {
      const mockDocs: ModuleDocumentation = {
        foo: 'foo'
      }

      mockedDocsImporter.mockResolvedValue({ default: mockDocs })
      const docs = await moduleLoader.memoizedGetModuleDocsAsync('one_module')
      expect(docs).toMatchObject(mockDocs)

      const docs2 = await moduleLoader.memoizedGetModuleDocsAsync('one_module')
      expect(docs2).toMatchObject(mockDocs)

      expect(moduleLoader.docsImporter).toHaveBeenCalledTimes(1)

      const docs3 = await moduleLoader.memoizedGetModuleDocsAsync('another_module')
      expect(docs3).toMatchObject(mockDocs)

      const docs4 = await moduleLoader.memoizedGetModuleDocsAsync('another_module')
      expect(docs4).toMatchObject(mockDocs)

      expect(moduleLoader.docsImporter).toHaveBeenCalledTimes(2)
    })

    test('docs are not memoized on error', async () => {
      const mockDocs: ModuleDocumentation = {
        foo: 'foo'
      }

      mockedDocsImporter.mockResolvedValueOnce({ default: mockDocs })
      const docs = await moduleLoader.memoizedGetModuleDocsAsync('one_module')
      expect(docs).toMatchObject(mockDocs)

      const docs2 = await moduleLoader.memoizedGetModuleDocsAsync('one_module')
      expect(docs2).toMatchObject(mockDocs)

      expect(moduleLoader.docsImporter).toHaveBeenCalledTimes(1)

      const mockError = new ModuleNotFoundError('another_module')
      mockedDocsImporter.mockRejectedValueOnce(mockError)
      const docs3 = moduleLoader.memoizedGetModuleDocsAsync('another_module', true)
      expect(docs3).rejects.toBe(mockError)

      mockedDocsImporter.mockResolvedValueOnce({ default: mockDocs })
      const docs4 = await moduleLoader.memoizedGetModuleDocsAsync('another_module')
      expect(docs4).toMatchObject(mockDocs)

      const docs5 = await moduleLoader.memoizedGetModuleDocsAsync('another_module')
      expect(docs5).toMatchObject(mockDocs)

      expect(moduleLoader.docsImporter).toHaveBeenCalledTimes(3)
    })
  })
})
