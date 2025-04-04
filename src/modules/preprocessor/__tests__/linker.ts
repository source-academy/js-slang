import { mockContext } from '../../../utils/testing/mocks'
import { MissingSemicolonError } from '../../../parser/errors'
import { Chapter, type Context } from '../../../types'
import { CircularImportError, ModuleNotFoundError } from '../../errors'
import type { SourceFiles } from '../../moduleTypes'
import parseProgramsAndConstructImportGraph from '../linker'

import * as resolver from '../resolver'
import { assertNodeType, assertTrue } from '../../../utils/testing/misc'
jest.spyOn(resolver, 'default')

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

test('Adds CircularImportError and returns undefined when imports are circular', async () => {
  const [error] = await expectError(
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
  const [error] = await expectError(
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
  assertTrue(result.ok)
  expect(resolver.default).not.toHaveBeenCalledWith('./b.js')
  expect(Object.keys(result.programs)).not.toContain('/b.js')
})

test('Linker updates the source paths of Import Declaration nodes', async () => {
  const [, result] = await testCode(
    {
      '/dir0/a.js': 'export const x = 0;',
      '/b.js': `import { x } from "./dir0/a.js";
        export { x };
      `,
      '/dir1/c.js': 'import { x } from "../b.js";',
    },
    '/dir1/c.js'
  )

  assertTrue(result.ok)
  const [bNode] = result.programs['/b.js'].body
  assertNodeType('ImportDeclaration', bNode)
  expect(bNode.source.value).toEqual('/dir0/a.js')

  const [cNode] = result.programs['/dir1/c.js'].body
  assertNodeType('ImportDeclaration', cNode)
  expect(cNode.source.value).toEqual('/b.js')
})

describe('Test determining verbose errors', () => {
   test('Verbose errors is normally false', async () => {
    const [, result] = await testCode({
      '/a.js': "const a = 0;"
    }, '/a.js')
    
    assertTrue(result.ok)
    assertTrue(!result.verboseErrors)
  })

  test('Verbose errors enables normally', async () => {
    const [, result] = await testCode({
      '/a.js': "'enable verbose';"
    }, '/a.js')
    
    assertTrue(result.ok)
    assertTrue(result.verboseErrors)
  })

  test('Verbose errors does not enable when it is not the entrypoint', async () => {
    const [, result] = await testCode({
      '/a.js': `
        'enable verbose';
        export const a = "a";
      `,
      '/b.js': "import { a } from './a.js';"
    }, '/b.js')
    
    assertTrue(result.ok)
    assertTrue(!result.verboseErrors)
  })

  test('Verbose errors does not enable when it is not the first statement', async () => {
    const [, result] = await testCode({
      '/a.js': `
      export const a = "a";
      'enable verbose';
      `,
    }, '/a.js')
    
    assertTrue(result.ok)
    assertTrue(!result.verboseErrors)
  })

  test('Verbose errors does not enable when it is an unknown entrypoint', async () => {
    const [, result] = await testCode({
      '/a.js': `
      export const a = "a";
      'enable verbose';
      `,
    }, '/d.js' as any)
    
    assertTrue(!result.ok)
    assertTrue(!result.verboseErrors)
  })

  test('Verbose errors enables even if other files have parse errors', async () => {
    const [{ errors }, result] = await testCode({
      '/a.js': `
      'enable verbose';
      import { b } from "./b.js";
      `,
      '/b.js': `export const b = "b"`
    }, '/a.js')
    
    assertTrue(!result.ok)
    assertTrue(result.verboseErrors)
    expect(errors.length).toEqual(1)
    expect(errors[0]).toBeInstanceOf(MissingSemicolonError)
  })

  test('Verbose errors enables even if the entrypoint has parse errors', async () => {
    const [{ errors }, result] = await testCode({
      '/a.js': `
      'enable verbose';
      const x = 0
      `,
    }, '/a.js')
    
    assertTrue(!result.ok)
    assertTrue(result.verboseErrors)
    expect(errors.length).toEqual(1)
    expect(errors[0]).toBeInstanceOf(MissingSemicolonError)
  })

  test('Verbose errors enables even if there is a module resolution problem', async () => {
    const [{ errors }, result] = await testCode({
      '/a.js': `
      'enable verbose';
      import { b } from "./b.js";
      `,
     '/b.js': `
        import { c } from "./c.js";
        export { c as b };
      `
    }, '/a.js')
    
    assertTrue(!result.ok)
    assertTrue(result.verboseErrors)
    expect(errors.length).toEqual(1)
    expect(errors[0]).toBeInstanceOf(ModuleNotFoundError)
  })
})