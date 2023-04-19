import type { Identifier, Literal, MemberExpression, VariableDeclaration } from 'estree'

import { runInContext } from '../..'
import { mockContext } from '../../mocks/context'
import { UndefinedImportError } from '../../modules/errors'
import * as moduleLoader from '../../modules/moduleLoaderAsync'
import { parse } from '../../parser/parser'
import { Chapter, Value } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { transformImportDeclarations, transpile } from '../transpiler'

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  memoize: jest.fn(f => f)
}))

jest.spyOn(moduleLoader, 'memoizedGetModuleManifestAsync').mockResolvedValue({
  one_module: { tabs: [] },
  another_module: { tabs: [] }
})
jest.spyOn(moduleLoader, 'memoizedGetModuleBundleAsync').mockResolvedValue(`
  require => ({
    foo: () => 'foo',
    bar: () => 'bar'
  })
`)
jest
  .spyOn(moduleLoader, 'memoizedGetModuleDocsAsync')
  .mockImplementation(name =>
    Promise.resolve<Record<string, string>>(name === 'one_module' ? { foo: 'foo' } : { bar: 'bar' })
  )

test('Transform import declarations into variable declarations', async () => {
  const code = stripIndent`
    import { foo } from "test/one_module";
    import { bar } from "test/another_module";
    foo(bar);
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  const [, importNodes] = await transformImportDeclarations(program, context, new Set<string>(), {
    checkImports: false,
    loadTabs: false,
    wrapModules: false
  })

  expect(importNodes[0].type).toBe('VariableDeclaration')
  expect((importNodes[0].declarations[0].id as Identifier).name).toEqual('foo')

  expect(importNodes[1].type).toBe('VariableDeclaration')
  expect((importNodes[1].declarations[0].id as Identifier).name).toEqual('bar')
})

test('Transpiler accounts for user variable names when transforming import statements', async () => {
  const code = stripIndent`
    import { foo } from "one_module";
    import { bar as __MODULE__2 } from "another_module";
    const __MODULE__ = 'test0';
    const __MODULE__0 = 'test1';
    foo(bar);
  `
  const context = mockContext(4)
  const program = parse(code, context)!
  const [, importNodes, [varDecl0, varDecl1]] = await transformImportDeclarations(
    program,
    context,
    new Set<string>(['__MODULE__', '__MODULE__0']),
    {
      checkImports: false,
      loadTabs: false,
      wrapModules: false
    }
  )

  expect(importNodes[0].type).toBe('VariableDeclaration')
  expect(
    ((importNodes[0].declarations[0].init as MemberExpression).object as Identifier).name
  ).toEqual('__MODULE__1')

  expect(varDecl0.type).toBe('VariableDeclaration')
  expect(((varDecl0 as VariableDeclaration).declarations[0].init as Literal).value).toEqual('test0')

  expect(varDecl1.type).toBe('VariableDeclaration')
  expect(((varDecl1 as VariableDeclaration).declarations[0].init as Literal).value).toEqual('test1')

  expect(importNodes[1].type).toBe('VariableDeclaration')
  expect(
    ((importNodes[1].declarations[0].init as MemberExpression).object as Identifier).name
  ).toEqual('__MODULE__3')
})

test('checkForUndefinedVariables accounts for import statements', async () => {
  const code = stripIndent`
    import { foo } from "one_module";
    foo;
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  await transpile(program, context, false)
})

test('importing undefined variables should throw errors', async () => {
  const code = stripIndent`
    import { hello } from 'one_module';
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  try {
    await transpile(program, context, false)
  } catch (error) {
    expect(error).toBeInstanceOf(UndefinedImportError)
    expect((error as UndefinedImportError).symbol).toEqual('hello')
  }
})

test('Module loading functionality', async () => {
  const code = stripIndent`
    import { foo } from 'one_module';
    foo();
  `
  const context = mockContext(Chapter.SOURCE_4)
  const result = await runInContext(code, context)
  expect(result.status).toEqual('finished')

  expect((result as Value).value).toEqual('foo')
})

test('importing undefined variables should throw errors', async () => {
  const code = stripIndent`
    import { hello } from 'one_module';
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  try {
    await transpile(program, context, false)
  } catch (error) {
    expect(error).toBeInstanceOf(UndefinedImportError)
    expect((error as UndefinedImportError).symbol).toEqual('hello')
  }
})
