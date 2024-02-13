import { mockContext } from '../../../mocks/context'
import { MissingSemicolonError } from '../../../parser/errors'
import { Chapter, type Context } from '../../../types'
import { CircularImportError } from '../../errors'
import parseProgramsAndConstructImportGraph from '../linker'

import * as resolver from '../resolver'
jest.spyOn(resolver, 'default')

beforeEach(() => {
  jest.clearAllMocks()
})

async function testCode<T extends Record<string, string>>(files: T, entrypointFilePath: keyof T) {
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

test('Adds CircularImportError and returns undefined when imports are circular', async () => {
  const [ctx, result] = await testCode(
    {
      '/a.js': `import { b } from "./b.js";`,
      '/b.js': `import { a } from "./a.js";`
    },
    '/a.js'
  )

  expect(result).toBeUndefined()
  expect(ctx.errors[0]).toBeInstanceOf(CircularImportError)
})

test('Longer cycle causes also causes CircularImportError', async () => {
  const [context, result] = await testCode(
    {
      '/a.js': `
      import { c } from "./c.js";
      
    `,
      '/b.js': 'import { a } from "./a.js";',
      '/c.js': 'import { b } from "./b.js";',
      '/d.js': 'import { c } from "./c.js";'
    },
    '/d.js'
  )

  expect(result).toBeUndefined()
  expect(resolver.default).not.toHaveBeenCalledWith('./e.js')
  expect(context.errors[0]).toBeInstanceOf(CircularImportError)
})

test('Self Circular Imports cause a short circuiting of the linker', async () => {
  const [context, result] = await testCode(
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

  expect(result).toBeUndefined()
  expect(context.errors[0]).toBeInstanceOf(CircularImportError)
  expect(resolver.default).not.toHaveBeenCalledWith('./c.js')
  expect(resolver.default).not.toHaveBeenCalledWith('./b.js')
})

test('Parse errors cause a short circuiting of the linker', async () => {
  const [context, result] = await testCode(
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
  expect(result).toBeUndefined()
  expect(context.errors[0]).toBeInstanceOf(MissingSemicolonError)
  expect(resolver.default).not.toHaveBeenCalledWith('./a.js')
})

test('Linker does tree-shaking', async () => {
  const [{ errors }, result] = await testCode({
    '/a.js': 'export const a = 5;',
    '/b.js': 'import { a } from "./a.js";'
  }, '/a.js')

  expect(errors.length).toEqual(0)
  expect(result).toBeDefined()
  expect(resolver.default).not.toHaveBeenCalledWith('./b.js')
  expect(Object.keys(result!.programs)).not.toContain('/b.js')
})