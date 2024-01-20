import type { Identifier, Literal, MemberExpression, VariableDeclaration } from 'estree'

import { runInContext } from '../..'
import { mockContext } from '../../mocks/context'
import { UndefinedImportError } from '../../modules/errors'
import { parse } from '../../parser/parser'
import { Chapter, Value } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { transformImportDeclarations, transpile } from '../transpiler'

jest.mock('../../modules/moduleLoaderAsync')
jest.mock('../../modules/moduleLoader')

// One import declaration is transformed into two AST nodes
const IMPORT_DECLARATION_NODE_COUNT = 2

test('Transform import declarations to correct number of nodes', async () => {
  const code = stripIndent`
    import { foo } from "one_module";
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  const [, importNodes] = await transformImportDeclarations(program, new Set<string>(), {
    wrapSourceModules: true,
    loadTabs: false,
    checkImports: true
  })
  expect(importNodes.length).toEqual(IMPORT_DECLARATION_NODE_COUNT)
})

test('Transform import declarations into variable declarations', async () => {
  const code = stripIndent`
    import { foo } from "one_module";
    import { bar } from "another_module";
    foo(bar);
  `
  const identifiers = ['foo', 'bar'] as const
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  const [, importNodes] = await transformImportDeclarations(program, new Set<string>(), {
    wrapSourceModules: true,
    loadTabs: false,
    checkImports: true
  })

  identifiers.forEach((ident, index) => {
    const idx = IMPORT_DECLARATION_NODE_COUNT * index
    expect(importNodes[idx].type).toBe('VariableDeclaration')
    const node = importNodes[idx] as VariableDeclaration
    expect((node.declarations[0].id as Identifier).name).toEqual(ident)
  })
})

test('Transform import declarations with correctly aliased names (expression statements)', async () => {
  const code = stripIndent`
    import { foo } from "one_module";
    import { bar as alias } from "another_module";
    foo(bar);
  `
  const aliases = ['foo', 'alias'] as const
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  const [, importNodes] = await transformImportDeclarations(program, new Set<string>(), {
    wrapSourceModules: true,
    loadTabs: false,
    checkImports: true
  })

  aliases.forEach((_, index) => {
    const idx = IMPORT_DECLARATION_NODE_COUNT * index + 1
    expect(importNodes[idx].type).toBe('ExpressionStatement')
  })
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
    new Set<string>(['__MODULE__', '__MODULE__0']),
    {
      loadTabs: false,
      wrapSourceModules: false,
      checkImports: false
    }
  )

  expect(importNodes[0].type).toBe('VariableDeclaration')
  expect(
    (
      ((importNodes[0] as VariableDeclaration).declarations[0].init as MemberExpression)
        .object as Identifier
    ).name
  ).toEqual('__MODULE__1')

  expect(varDecl0.type).toBe('VariableDeclaration')
  expect(((varDecl0 as VariableDeclaration).declarations[0].init as Literal).value).toEqual('test0')

  expect(varDecl1.type).toBe('VariableDeclaration')
  expect(((varDecl1 as VariableDeclaration).declarations[0].init as Literal).value).toEqual('test1')

  expect(importNodes[2].type).toBe('VariableDeclaration')
  expect(
    (
      ((importNodes[2] as VariableDeclaration).declarations[0].init as MemberExpression)
        .object as Identifier
    ).name
  ).toEqual('__MODULE__3')
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
    await transpile(
      program,
      context,
      { checkImports: true, loadTabs: false, wrapSourceModules: false },
      false
    )
  } catch (error) {
    expect(error).toBeInstanceOf(UndefinedImportError)
    expect((error as UndefinedImportError).symbol).toEqual('hello')
  }
})
