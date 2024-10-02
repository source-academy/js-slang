import { memoizedGetModuleManifestAsync } from '../../loader/loaders'
import resolveFile, { type ImportResolutionOptions, defaultResolutionOptions } from '../resolver'

jest.mock('../../loader/loaders')

beforeEach(() => {
  jest.clearAllMocks()
})

const resolveModule = (
  fromPath: string,
  toPath: string,
  pred: (p: string) => boolean,
  options: ImportResolutionOptions
) => resolveFile(fromPath, toPath, p => Promise.resolve(pred(p) ? '' : undefined), options)

test('If only local imports are used, the module manifest is not loaded', async () => {
  await resolveModule('/a.js', '/b.js', () => true, defaultResolutionOptions)

  expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(0)
})

it('Returns false and resolved path of source file when resolution fails', () => {
  return expect(
    resolveModule('/', './a', () => false, {
      extensions: ['js']
    })
  ).resolves.toBeUndefined()
})

it('Will resolve extensions', () => {
  const mockResolver = (p: string) => p === '/a.ts'

  return expect(
    resolveModule('/', '/a', mockResolver, {
      extensions: ['js', 'ts']
    })
  ).resolves.toMatchObject({
    type: 'local',
    absPath: '/a.ts',
    contents: ''
  })
})

it('Will not resolve if the corresponding options are given as false', () => {
  const mockResolver = (p: string) => p === '/a.js'
  return expect(
    resolveModule('/', './a', mockResolver, {
      extensions: null
    })
  ).resolves.toBeUndefined()
})

it('Checks the module manifest when importing source modules', async () => {
  const result = await resolveModule('/', 'one_module', () => false, {
    extensions: ['js']
  })

  expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(1)
  expect(result).toMatchObject({ type: 'source' })
})

it('Returns undefined on failing to resolve a source module', async () => {
  const result = await resolveModule('/', 'unknown_module', () => true, {
    extensions: ['js']
  })

  expect(memoizedGetModuleManifestAsync).toHaveBeenCalledTimes(1)
  expect(result).toBeUndefined()
})

test('Resolving an absolute path from a local module', () => {
  return expect(
    resolveFile(
      './dir0/dir1/a.js',
      '/b.js',
      p =>
        Promise.resolve(
          {
            '/b.js': 'contents'
          }[p]
        ),
      {
        extensions: null
      }
    )
  ).resolves.toMatchObject({
    type: 'local',
    contents: 'contents',
    absPath: '/b.js'
  })
})
