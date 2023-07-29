import { memoizedGetModuleManifestAsync } from '../../moduleLoaderAsync'
import resolveModule from '../resolver'

jest.mock('../../moduleLoaderAsync')

beforeEach(() => {
  jest.clearAllMocks()
})

test('If only local imports are used, the module manifest is not loaded', async () => {
  await resolveModule('/a.js', '/b.js', () => true, {
    resolveDirectories: false,
    resolveExtensions: null
  })

  expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(0)
})

test('Returns false and resolved path of source file when resolution fails', () => {
  return expect(
    resolveModule('/', './a', () => false, {
      resolveDirectories: true,
      resolveExtensions: ['js']
    })
  ).resolves.toEqual([false, '/a'])
})

test('Will resolve directory imports', () => {
  const mockResolver = (p: string) => p === '/a/index'

  return expect(
    resolveModule('/', '/a', mockResolver, {
      resolveDirectories: true,
      resolveExtensions: null
    })
  ).resolves.toEqual([true, '/a/index'])
})

test('Will resolve extensions', () => {
  const mockResolver = (p: string) => p === '/a.ts'

  return expect(
    resolveModule('/', '/a', mockResolver, {
      resolveDirectories: false,
      resolveExtensions: ['js', 'ts']
    })
  ).resolves.toEqual([true, '/a.ts'])
})

test('Will resolve directory import with extensions', () => {
  const mockResolver = (p: string) => p === '/a/index.ts'

  return expect(
    resolveModule('/', '/a', mockResolver, {
      resolveDirectories: true,
      resolveExtensions: ['js', 'ts']
    })
  ).resolves.toEqual([true, '/a/index.ts'])
})

test('Will not resolve if the corresponding options are given as false', () => {
  const mockResolver = (p: string) => {
    return p === '/a.js' || p === '/a/index'
  }
  return expect(
    resolveModule('/', './a', mockResolver, {
      resolveDirectories: false,
      resolveExtensions: null
    })
  ).resolves.toEqual([false, '/a'])
})

test('Will not resolve directories with extensions if resolveExtensions is false', () => {
  const mockResolver = (p: string) => p === '/a/index.js'
  return expect(
    resolveModule('/', './a', mockResolver, {
      resolveDirectories: true,
      resolveExtensions: null
    })
  ).resolves.toEqual([false, '/a'])
})

test('Checks the module manifest when importing source modules', async () => {
  const result = await resolveModule('/', 'one_module', () => false, {
    resolveDirectories: true,
    resolveExtensions: ['js']
  })

  expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(1)
  expect(result).toEqual([true, 'one_module'])
})

test('Returns false on failing to resolve a source module', async () => {
  const result = await resolveModule('/', 'unknown_module', () => true, {
    resolveDirectories: true,
    resolveExtensions: ['js']
  })

  expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(1)
  expect(result).toEqual([false, 'unknown_module'])
})
