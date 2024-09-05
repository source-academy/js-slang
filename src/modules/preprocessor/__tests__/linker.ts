import { mockContext } from '../../../mocks/context'
import { MissingSemicolonError } from '../../../parser/errors'
import { Chapter, type Context } from '../../../types'
import { CircularImportError, ModuleNotFoundError } from '../../errors'
import type { SourceFiles } from '../../moduleTypes'
import parseProgramsAndConstructImportGraph from '../linker'
import { expectNodeType, expectTrue } from '../../../utils/testing/misc'
import { asMockedFunc } from '../../../utils/testing/misc'

import * as resolver from '../resolver'
jest.spyOn(resolver, 'default')

import * as parser from '../../../parser/parser'
jest.spyOn(parser, 'parse')

beforeEach(() => {
  jest.clearAllMocks()
})

async function testCode<T extends SourceFiles>(files: T, entrypointFilePath: keyof T) {
  const context = mockContext(Chapter.SOURCE_4)
  const result = await parseProgramsAndConstructImportGraph(
    p => Promise.resolve(files[p]),
    entrypointFilePath as string,
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
  expect(result.ok).toEqual(false)
  expect(context.errors.length).toBeGreaterThanOrEqual(1)
  return context.errors
}

async function expectSuccess<T extends SourceFiles>(files: T, entrypointFilePath: keyof T) {
  const [, result] = await testCode(files, entrypointFilePath)
  expectTrue(result.ok)
  return result
}

describe('Test self circular import errors', () => {
  async function expectCircularError<T extends SourceFiles>(files: T, entrypoint: keyof T) {
    const [error] = await expectError(files, entrypoint)
    expect(error).toBeInstanceOf(CircularImportError)
  }

  test('Causes CircularImportError when imports are circular', async () => {
    await expectCircularError(
      {
        '/a.js': `import { b } from "./b.js";`,
        '/b.js': `import { a } from "./a.js";`
      },
      '/a.js'
    )
  })

  // TODO: https://github.com/source-academy/js-slang/issues/1535
  test.skip('Longer cycle causes also causes CircularImportError', async () => {
    await expectCircularError(
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

    expect(resolver.default).not.toHaveBeenCalledWith('./e.js')
  })

  test('Self circular imports for not the entrypoint', async () => {
    await expectCircularError(
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

    expect(resolver.default).not.toHaveBeenCalledWith('./c.js')
    expect(resolver.default).not.toHaveBeenCalledWith('./b.js')
  })

  test('Self circular imports for a relative entrypoint', () =>
    expectCircularError(
      {
        '/a.js': `import { a } from './dir/../a.js';`
      },
      '/a.js'
    ))

  test('Self circular imports for an absolute entrypoint', async () => {
    await expectCircularError(
      {
        '/a.js': 'import { a } from "/a.js";',
        '/c.js': `
          import { b } from "./b.js";
          export const c = "c";
        `,
        '/d.js': `
          import { a } from "./a.js";
          import { c } from "./c.js";
        `
      },
      '/a.js'
    )

    expect(resolver.default).not.toHaveBeenCalledWith('./c.js')
    expect(resolver.default).not.toHaveBeenCalledWith('./b.js')
    expect(resolver.default).not.toHaveBeenCalledWith('./d.js')
  })
})

test('Parse errors cause a short circuiting of the linker', async () => {
  const [error] = await expectError(
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
  expect(resolver.default).not.toHaveBeenCalledWith('./c.js')
})

test('ModuleNotFoundErrors short circuit the linker', async () => {
  const [error] = await expectError(
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
  const [{ errors }, result] = await testCode(
    {
      '/a.js': 'export const a = 5;',
      '/b.js': 'import { a } from "./a.js";'
    },
    '/a.js'
  )

  expect(errors.length).toEqual(0)
  expectTrue(result.ok)
  expect(resolver.default).not.toHaveBeenCalledWith('./b.js')
  expect(Object.keys(result.programs)).not.toContain('/b.js')
})

test('Linker parses each file once and only once', async () => {
  const files: SourceFiles = {
    '/a.js': `
    import { b } from './b.js';
    import { c } from './c.js';
    `,
    '/b.js': `
    import { d } from './d.js';
    export function b() { return d; }
    `,
    '/c.js': `
    import { e } from './d.js';
    export function c() { return e; }
    `,
    '/d.js': `
    export const d = "d";
    export const e = "e";
    `
  }

  await expectSuccess(files, '/a.js')
  const mockedParse = asMockedFunc(parser.parse)

  for (const fileName of Object.keys(files)) {
    // Assert that parse was only called once and only once for each file
    const calls = mockedParse.mock.calls.filter(([, , options]) => options?.sourceFile === fileName)
    expect(calls.length).toEqual(1)
  }
})

test("Linker updates AST's import source values", async () => {
  const result = await expectSuccess(
    {
      '/dir/a.js': `import { b } from '../b.js';`,
      '/b.js': 'export function b() {}'
    },
    '/dir/a.js'
  )

  const aNode = result.programs['/dir/a.js'].body[0]
  expectNodeType('ImportDeclaration', aNode)
  expect(aNode.source.value).toEqual('/b.js')
})

describe('Test checking if verbose errors should be enabled', () => {
  test('When the entrypoint file has the directive', async () => {
    const result = await expectSuccess(
      {
        '/a.js': `
        'enable verbose';
        0;
      `
      },
      '/a.js'
    )

    expect(result.verboseErrors).toEqual(true)
  })

  test('When the entrypoint file has the directive but has parser errors', async () => {
    const [{ errors }, result] = await testCode(
      {
        '/a.js': `
        'enable verbose';
        0
      `
      },
      '/a.js'
    )

    expect(errors.length).toEqual(1)
    expect(errors[0]).toBeInstanceOf(MissingSemicolonError)

    expect(result.ok).toEqual(false)
    expect(result.verboseErrors).toEqual(true)
  })

  test('Does not enable verbose errors if directive is not in entrypoint file', async () => {
    const result = await expectSuccess(
      {
        '/a.js': `
        import { b } from './b.js';
        b();
      `,
        '/b.js': `
        'enable verbose';
        export function b() {}
      `
      },
      '/a.js'
    )

    expect(result.verboseErrors).toEqual(false)
  })

  test('Does not enable verbose errors if directive is not the first statement', async () => {
    const result = await expectSuccess(
      {
        '/a.js': `
        const x = 0;
        'enable verbose';
      `
      },
      '/a.js'
    )

    expect(result.verboseErrors).toEqual(false)
  })

  test('Does not enable verbose errors for unknown entrypoint', async () => {
    const [{ errors }, result] = await testCode(
      { '/a.js': '"enable verbose";\nconst x = 0;' },
      '/b.js' as any
    )

    expect(errors.length).toEqual(1)
    expect(errors[0]).toBeInstanceOf(ModuleNotFoundError)

    expect(result.ok).toEqual(false)
    expect(result.verboseErrors).toEqual(false)
  })
})
