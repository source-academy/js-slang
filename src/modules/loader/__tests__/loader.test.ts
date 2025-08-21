import { beforeEach, describe, expect, test, vi } from 'vitest'
import { Chapter, Variant } from '../../../langs'
import { mockContext } from '../../../utils/testing/mocks'
import { ModuleConnectionError, ModuleNotFoundError } from '../../errors'
import type { ModuleDocumentation, ModuleManifest } from '../../moduleTypes'
import * as importers from '../importers'
import * as loaders from '../loaders'

const moduleMocker = vi.hoisted(() => vi.fn())
const mockedFetch = vi.spyOn(global, 'fetch')

// Using virtual modules, we can pretend the modules with the given
// import path actually exist
// When testing the import loader we can generally rely on the mocked versions
// under __mocks__ instead.
vi.doMock(`${importers.MODULES_STATIC_URL}/bundles/one_module.js`, () => ({
  default: moduleMocker
}))

vi.doMock(`${importers.MODULES_STATIC_URL}/tabs/tab1.js`, () => ({
  default: () => 'tab1'
}))

vi.doMock(`${importers.MODULES_STATIC_URL}/tabs/tab2.js`, () => ({
  default: () => 'tab2'
}))

const mockedDocsImporter = vi.spyOn(importers, 'docsImporter')

beforeEach(() => {
  vi.clearAllMocks()
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
    const mod = await loaders.loadModuleBundleAsync('one_module', context)
    expect(mod.foo()).toEqual('foo')
  })

  test('Should throw ModuleConnectionError when unable to reach modules server', () => {
    const context = mockContext(Chapter.SOURCE_4, Variant.DEFAULT)
    const promise = loaders.loadModuleBundleAsync('unknown_module', context)
    return expect(promise).rejects.toBeInstanceOf(ModuleConnectionError)
  })
})

describe('tab loading', () => {
  test("Load a module's tabs", async () => {
    mockedFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          one_module: { tabs: ['tab1', 'tab2'] }
        }),
      status: 200
    } as any)

    const tabs = await loaders.loadModuleTabsAsync('one_module')

    expect(tabs[0]({} as any)).toEqual('tab1')
    expect(tabs[1]({} as any)).toEqual('tab2')
  })
})

describe('docs loading', () => {
  beforeEach(() => {
    mockedDocsImporter.mockClear()
  })

  describe('test memoizedGetModuleManifestAsync', () => {
    beforeEach(() => {
      loaders.memoizedGetModuleManifestAsync.reset()
    })

    test('manifest is memoized on success', async () => {
      const mockManifest: ModuleManifest = {
        one_module: {
          tabs: []
        }
      }
      mockedDocsImporter.mockResolvedValueOnce({ default: mockManifest })

      const result = await loaders.memoizedGetModuleManifestAsync()
      expect(result).toMatchObject(mockManifest)

      const result2 = await loaders.memoizedGetModuleManifestAsync()
      expect(result2).toMatchObject(mockManifest)

      const result3 = await loaders.memoizedGetModuleManifestAsync()
      expect(result3).toMatchObject(mockManifest)

      expect(importers.docsImporter).toHaveBeenCalledTimes(1)
    })

    test('manifest is not memoized on error', async () => {
      const mockError = new ModuleNotFoundError('one_module')

      mockedDocsImporter.mockRejectedValueOnce(mockError)
      const result = loaders.memoizedGetModuleManifestAsync()
      expect(result).rejects.toBe(mockError)

      const mockManifest: ModuleManifest = {
        one_module: {
          tabs: []
        }
      }

      mockedDocsImporter.mockResolvedValueOnce({ default: mockManifest })
      const result2 = await loaders.memoizedGetModuleManifestAsync()
      expect(result2).toMatchObject(mockManifest)

      expect(importers.docsImporter).toHaveBeenCalledTimes(2)
    })
  })

  describe('test memoizedGetModuleDocsAsync', () => {
    beforeEach(() => {
      loaders.memoizedGetModuleDocsAsync.cache.clear()
    })

    test('docs are memoized on success', async () => {
      const mockDocs: ModuleDocumentation = {
        foo: { kind: 'unknown' }
      }

      mockedDocsImporter.mockResolvedValue({ default: mockDocs })
      const docs = await loaders.memoizedGetModuleDocsAsync('one_module')
      expect(docs).toMatchObject(mockDocs)

      const docs2 = await loaders.memoizedGetModuleDocsAsync('one_module')
      expect(docs2).toMatchObject(mockDocs)

      expect(importers.docsImporter).toHaveBeenCalledTimes(1)

      const docs3 = await loaders.memoizedGetModuleDocsAsync('another_module')
      expect(docs3).toMatchObject(mockDocs)

      const docs4 = await loaders.memoizedGetModuleDocsAsync('another_module')
      expect(docs4).toMatchObject(mockDocs)

      expect(importers.docsImporter).toHaveBeenCalledTimes(2)
    })

    test('docs are not memoized on error', async () => {
      const mockDocs: ModuleDocumentation = {
        foo: { kind: 'unknown' }
      }

      mockedDocsImporter.mockResolvedValueOnce({ default: mockDocs })
      const docs = await loaders.memoizedGetModuleDocsAsync('one_module')
      expect(docs).toMatchObject(mockDocs)

      const docs2 = await loaders.memoizedGetModuleDocsAsync('one_module')
      expect(docs2).toMatchObject(mockDocs)

      expect(importers.docsImporter).toHaveBeenCalledTimes(1)

      const mockError = new ModuleNotFoundError('another_module')
      mockedDocsImporter.mockRejectedValueOnce(mockError)
      const docs3 = loaders.memoizedGetModuleDocsAsync('another_module', true)
      expect(docs3).rejects.toBe(mockError)

      mockedDocsImporter.mockResolvedValueOnce({ default: mockDocs })
      const docs4 = await loaders.memoizedGetModuleDocsAsync('another_module')
      expect(docs4).toMatchObject(mockDocs)

      const docs5 = await loaders.memoizedGetModuleDocsAsync('another_module')
      expect(docs5).toMatchObject(mockDocs)

      expect(importers.docsImporter).toHaveBeenCalledTimes(3)
    })
  })
})
