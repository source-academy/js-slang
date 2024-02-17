import { mockContext } from '../../../mocks/context'
import { MissingSemicolonError } from '../../../parser/errors'
import { Chapter, type Context, type SourceError } from '../../../types'
import { CircularImportError, ModuleNotFoundError } from '../../errors'
import type { AbsolutePath, SourceFiles } from '../../moduleTypes'
import parseProgramsAndConstructImportGraph, {
  type LinkerErrorResult,
  type LinkerResult,
  type LinkerSuccessResult
} from '../linker'

import * as resolver from '../resolver'
jest.spyOn(resolver, 'default')

import * as parser from '../../../parser/parser'
jest.spyOn(parser, 'parse')

beforeEach(() => {
  jest.clearAllMocks()
})

function expectResultSuccess(result: LinkerResult): asserts result is LinkerSuccessResult {
  expect(result.ok).toEqual(true)
}

function expectResultFailure(result: LinkerResult): asserts result is LinkerErrorResult {
  expect(result.ok).toEqual(false)
}

async function testCode<T extends SourceFiles>(files: T, entrypointFilePath: keyof T) {
  const context = mockContext(Chapter.SOURCE_4)
  const result = await parseProgramsAndConstructImportGraph(
    p => Promise.resolve(files[p]),
    entrypointFilePath as AbsolutePath,
    context,
    {},
    true
  )
  return [context, result] as [
    Context,
    Awaited<ReturnType<typeof parseProgramsAndConstructImportGraph>>
  ]
}

async function expectError<T extends SourceFiles>(files: T, entrypointFilePath: keyof T) {
  const [context, result] = await testCode(files, entrypointFilePath)
  expectResultFailure(result)
  expect(context.errors.length).toBeGreaterThanOrEqual(1)
  return [context.errors, result] as [SourceError[], LinkerErrorResult]
}

async function expectSuccess<T extends SourceFiles>(files: T, entrypointFilePath: keyof T) {
  const [context, result] = await testCode(files, entrypointFilePath)
  expectResultSuccess(result)
  expect(context.errors.length).toBeGreaterThanOrEqual(0)
  return result
}

test('Adds CircularImportError and returns undefined when imports are circular', async () => {
  const [[error]] = await expectError(
    {
      '/a.js': `import { b } from "./b.js";`,
      '/b.js': `import { a } from "./a.js";`
    },
    '/a.js'
  )

  expect(error).toBeInstanceOf(CircularImportError)
})

test.skip('Longer cycle causes also causes CircularImportError', async () => {
  const [error] = await expectError(
    {
      '/a.js': `
      import { c } from "./c.js";
      
    `,
      '/b.js': 'import { a } from "./a.js";',
      '/c.js': 'import { b } from "./b.js";',
      '/d.js': 'import { c } from "./c.js";',
      '/e.js': 'import { d } from "./d.js";'
    },
    '/e.js'
  )

  expect(error).toBeInstanceOf(CircularImportError)
  expect(resolver.default).not.toHaveBeenCalledWith('./e.js')
})

test('Self Circular Imports cause a short circuiting of the linker', async () => {
  const [[error]] = await expectError(
    {
      '/a.js': 'import { a } from "./a.js";',
      '/c.js': `
        import { b } from "./b.js";
        export const c = "c";
      `,
      '/d.js': `
        import { a } from "./a.js";
        import { c } from "./c.js";
      `
    },
    '/d.js'
  )

  expect(error).toBeInstanceOf(CircularImportError)
  expect(resolver.default).not.toHaveBeenCalledWith('./c.js')
  expect(resolver.default).not.toHaveBeenCalledWith('./b.js')
})

test('Parse errors cause a short circuiting of the linker', async () => {
  const [[error]] = await expectError(
    {
      '/a.js': 'export const a = "a";',
      '/b.js': `
      import { a } from "./a.js";
      export function b() {
        return a
      }
    `,
      '/c.js': 'import { b } from "./b.js";'
    },
    '/b.js'
  )
  expect(error).toBeInstanceOf(MissingSemicolonError)
  expect(resolver.default).not.toHaveBeenCalledWith('./a.js')
})

test('ModuleNotFoundErrors short circuit the linker', async () => {
  const [[error]] = await expectError(
    {
      '/a.js': 'export const a = "a";',
      '/b.js': `
      import { c } from './c.js';
      import { a } from './a.js';
    `,
      '/d.js': 'import { b } from "./b.js";'
    },
    '/d.js'
  )

  expect(error).toBeInstanceOf(ModuleNotFoundError)
  expect(resolver.default).not.toHaveBeenCalledWith('./a.js')
})

test('Linker does tree-shaking', async () => {
  const result = await expectSuccess(
    {
      '/a.js': 'export const a = 5;',
      '/b.js': 'import { a } from "./a.js";'
    },
    '/a.js'
  )

  expect(resolver.default).not.toHaveBeenCalledWith('./b.js')
  expect(Object.keys(result.programs)).not.toContain('/b.js')
})

describe('Check verbose error detection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  test("with file that doesn't have verbose errors", async () => {
    const result = await expectSuccess(
      {
        '/a.js': `
        1 + 1;
      `
      },
      '/a.js'
    )

    expect(result.isVerboseErrorsEnabled).toEqual(false)
    expect(parser.parse).toHaveBeenCalledTimes(1)
  })

  it('outputs as per normal with files that have no errors', async () => {
    const result = await expectSuccess(
      {
        '/a.js': `
        'enable verbose';
        1 + 1;
      `
      },
      '/a.js'
    )

    expect(result.isVerboseErrorsEnabled).toEqual(true)
    expect(parser.parse).toHaveBeenCalledTimes(1)
  })

  it('outputs even if entrypoint file has syntax errors', async () => {
    const [[error], result] = await expectError(
      {
        '/a.js': `
        'enable verbose';
        1 + 1
      `
      },
      '/a.js'
    )

    expect(error).toBeInstanceOf(MissingSemicolonError)
    expect(parser.parse).toHaveBeenCalledTimes(1)
    expect(result.isVerboseErrorsEnabled).toEqual(true)
  })

  it('outputs even if other files have errors', async () => {
    const [[error], result] = await expectError(
      {
        '/a.js': `
        'enable verbose';
        import { b } from './b.js';
      `,
        '/b.js': 'export const b = 1 + 1'
      },
      '/a.js'
    )

    expect(error).toBeInstanceOf(MissingSemicolonError)
    expect(parser.parse).toHaveBeenCalledTimes(2)
    expect(result.isVerboseErrorsEnabled).toEqual(true)
  })
})
