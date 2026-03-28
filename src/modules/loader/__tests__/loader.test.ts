import { beforeEach, describe, expect, test, vi } from 'vitest'
import { Chapter, Variant } from '../../../langs'
import { mockContext, mockImportDeclaration } from '../../../utils/testing/mocks'
import {
  ModuleConnectionError,
  ModuleNotFoundError,
  WrongChapterForModuleError
} from '../../errors'
import type { ModuleDocumentation, ModulesManifest } from '../../moduleTypes'
import * as importers from '../importers'
import {
  loadModuleBundleAsync,
  loadModuleTabsAsync,
  memoizedLoadModuleDocsAsync,
  memoizedLoadModuleManifestAsync
} from '../loaders'
import { stringify } from '../../../utils/stringify'
import loadSourceModules from '..'

const moduleMocker = vi.fn()

// Using virtual modules, we can pretend the modules with the given
// import path actually exist
// When testing with the import loader we can generally rely on the mocked versions
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
const mockedManifestImporter = vi.spyOn(importers, 'manifestImporter')

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
    const mod = await loadModuleBundleAsync('one_module', context)
    expect(mod.foo()).toEqual('foo')
    expect(stringify(mod.foo)).toMatchInlineSnapshot(`
      "function foo {
      	[Function from one_module
      	Implementation hidden]
      }"
    `)

    expect(moduleMocker).toHaveBeenCalledOnce()
  })

  test('Should throw ModuleConnectionError when unable to reach modules server', () => {
    const context = mockContext(Chapter.SOURCE_4, Variant.DEFAULT)
    const promise = loadModuleBundleAsync('unknown_module', context)
    return expect(promise).rejects.toBeInstanceOf(ModuleConnectionError)
  })

  test('Loading a bundle preserves properties', async () => {
    const context = mockContext(Chapter.SOURCE_4, Variant.DEFAULT)

    function foo() {
      return foo.name
    }
    foo.someprop = true

    expect('someprop' in foo).toEqual(true)

    moduleMocker.mockReturnValueOnce({
      foo,
      bar: () => 'bar'
    })

    const mod = await loadModuleBundleAsync('one_module', context)
    expect(mod.foo()).toEqual('foo')
    expect(mod.foo).toHaveProperty('someprop', true)
    expect(moduleMocker).toHaveBeenCalledOnce()
  })
})

describe('tab loading', () => {
  test("Load a module's tabs", async () => {
    const tabs = await loadModuleTabsAsync(['tab1', 'tab2'])

    expect(tabs[0]({} as any)).toEqual('tab1')
    expect(tabs[1]({} as any)).toEqual('tab2')
  })
})

describe('docs loading', () => {
  describe(memoizedLoadModuleManifestAsync, () => {
    beforeEach(() => {
      memoizedLoadModuleManifestAsync.reset()
    })

    test('manifest is memoized on success', async () => {
      const mockManifest: ModulesManifest = {
        one_module: {
          tabs: [],
          node: mockImportDeclaration()
        }
      }
      mockedManifestImporter.mockResolvedValueOnce({ default: mockManifest })

      const result = await memoizedLoadModuleManifestAsync()
      expect(result).toMatchObject(mockManifest)

      const result2 = await memoizedLoadModuleManifestAsync()
      expect(result2).toMatchObject(mockManifest)

      const result3 = await memoizedLoadModuleManifestAsync()
      expect(result3).toMatchObject(mockManifest)

      expect(importers.manifestImporter).toHaveBeenCalledTimes(1)
    })

    test('manifest is not memoized on error', async () => {
      const mockError = new ModuleNotFoundError('one_module', mockImportDeclaration())

      mockedManifestImporter.mockRejectedValueOnce(mockError)
      const result = memoizedLoadModuleManifestAsync()
      await expect(result).rejects.toBe(mockError)

      const mockManifest: ModulesManifest = {
        one_module: {
          tabs: [],
          node: mockImportDeclaration()
        }
      }

      mockedManifestImporter.mockResolvedValueOnce({ default: mockManifest })
      const result2 = await memoizedLoadModuleManifestAsync()
      expect(result2).toMatchObject(mockManifest)

      expect(importers.manifestImporter).toHaveBeenCalledTimes(2)
    })
  })

  describe(memoizedLoadModuleDocsAsync, () => {
    beforeEach(() => {
      memoizedLoadModuleDocsAsync.cache.clear()
    })

    test('docs are memoized on success', async () => {
      const mockDocs: ModuleDocumentation = {
        foo: { kind: 'unknown' }
      }

      mockedDocsImporter.mockResolvedValue({ default: mockDocs })
      const docs = await memoizedLoadModuleDocsAsync('one_module')
      expect(docs).toMatchObject(mockDocs)

      const docs2 = await memoizedLoadModuleDocsAsync('one_module')
      expect(docs2).toMatchObject(mockDocs)

      expect(importers.docsImporter).toHaveBeenCalledTimes(1)

      const docs3 = await memoizedLoadModuleDocsAsync('another_module')
      expect(docs3).toMatchObject(mockDocs)

      const docs4 = await memoizedLoadModuleDocsAsync('another_module')
      expect(docs4).toMatchObject(mockDocs)

      expect(importers.docsImporter).toHaveBeenCalledTimes(2)
    })

    test('docs are not memoized on error', async () => {
      const mockDocs: ModuleDocumentation = {
        foo: { kind: 'unknown' }
      }

      mockedDocsImporter.mockResolvedValueOnce({ default: mockDocs })
      const docs = await memoizedLoadModuleDocsAsync('one_module')
      expect(docs).toMatchObject(mockDocs)

      const docs2 = await memoizedLoadModuleDocsAsync('one_module')
      expect(docs2).toMatchObject(mockDocs)

      expect(importers.docsImporter).toHaveBeenCalledTimes(1)

      const mockError = new ModuleNotFoundError('another_module', mockImportDeclaration())
      mockedDocsImporter.mockRejectedValueOnce(mockError)
      const docs3 = memoizedLoadModuleDocsAsync('another_module', true)
      await expect(docs3).rejects.toBe(mockError)

      mockedDocsImporter.mockResolvedValueOnce({ default: mockDocs })
      const docs4 = await memoizedLoadModuleDocsAsync('another_module')
      expect(docs4).toMatchObject(mockDocs)

      const docs5 = await memoizedLoadModuleDocsAsync('another_module')
      expect(docs5).toMatchObject(mockDocs)

      expect(importers.docsImporter).toHaveBeenCalledTimes(3)
    })
  })
})

describe('module loading', () => {
  test('throwing error when context chapter is not high enough', async () => {
    const context = mockContext(Chapter.SOURCE_1)
    await expect(
      loadSourceModules(
        {
          one_module: {
            name: 'one_module',
            tabs: [],
            requires: Chapter.SOURCE_3,
            node: mockImportDeclaration()
          }
        },
        context
      )
    ).rejects.toThrowError(WrongChapterForModuleError)
    expect(moduleMocker).not.toHaveBeenCalledOnce()
  })

  test("not throwing error when module doesn't need a specific chapter", async () => {
    const context = mockContext(Chapter.SOURCE_1)
    moduleMocker.mockReturnValueOnce({
      foo() {
        return this.foo.name
      },
      bar: () => 'bar'
    })
    await expect(
      loadSourceModules(
        {
          one_module: {
            name: 'one_module',
            tabs: [],
            node: mockImportDeclaration()
          }
        },
        context
      )
    ).resolves.toMatchObject({
      one_module: expect.any(Object)
    })

    expect(moduleMocker).toHaveBeenCalledOnce()
  })

  test('not throwing error when context chapter is high enough', async () => {
    const context = mockContext(Chapter.SOURCE_3)
    moduleMocker.mockReturnValueOnce({
      foo() {
        return this.foo.name
      },
      bar: () => 'bar'
    })
    await expect(
      loadSourceModules(
        {
          one_module: {
            name: 'one_module',
            tabs: [],
            requires: Chapter.SOURCE_3,
            node: mockImportDeclaration()
          }
        },
        context
      )
    ).resolves.toMatchObject({
      one_module: expect.any(Object)
    })

    expect(moduleMocker).toHaveBeenCalledOnce()
  })

  test('using a custom bundle importer', async () => {
    const context = mockContext(Chapter.SOURCE_3)
    const importer = vi.fn(() =>
      Promise.resolve({
        default: () => ({
          foo: () => 'foo'
        })
      })
    )

    const loadedModules = await loadSourceModules(
      {
        one_module: {
          name: 'one_module',
          tabs: [],
          requires: Chapter.SOURCE_3,
          node: mockImportDeclaration()
        }
      },
      context,
      {
        sourceBundleImporter: importer
      }
    )

    expect(loadedModules).toHaveProperty('one_module')
    expect(loadedModules.one_module.foo()).toEqual('foo')
    expect(importer).toHaveBeenCalledOnce()
  })
})
