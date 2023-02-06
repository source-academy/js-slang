import type { Identifier, Literal, MemberExpression, VariableDeclaration } from 'estree'

import { mockContext } from '../../mocks/context'
import { parse } from '../../parsers/parser'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { transformImportDeclarations, transpile } from '../transpiler'

jest.mock('../../modules/moduleLoader', () => ({
  ...jest.requireActual('../../modules/moduleLoader'),
  memoizedGetModuleFile: () => 'undefined;'
}))

test('Transform import declarations into variable declarations', () => {
  const code = stripIndent`
    import { foo } from "test/one_module";
    import { bar } from "test/another_module";
    foo(bar);
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  const [, importNodes] = transformImportDeclarations(program, new Set<string>())

  expect(importNodes[0].type).toBe('VariableDeclaration')
  expect((importNodes[0].declarations[0].id as Identifier).name).toEqual('foo')

  expect(importNodes[1].type).toBe('VariableDeclaration')
  expect((importNodes[1].declarations[0].id as Identifier).name).toEqual('bar')
})

test('Transpiler accounts for user variable names when transforming import statements', () => {
  const code = stripIndent`
    import { foo } from "test/one_module";
    import { bar } from "test/another_module";
    const __MODULE_0__ = 'test0';
    const __MODULE_2__ = 'test1';
    foo(bar);
  `
  const context = mockContext(4)
  const program = parse(code, context)!
  const [, importNodes, [varDecl0, varDecl1]] = transformImportDeclarations(
    program,
    new Set<string>(['__MODULE_0__', '__MODULE_2__'])
  )

  expect(importNodes[0].type).toBe('VariableDeclaration')
  expect(
    ((importNodes[0].declarations[0].init as MemberExpression).object as Identifier).name
  ).toEqual('__MODULE_1__')

  expect(varDecl0.type).toBe('VariableDeclaration')
  expect(((varDecl0 as VariableDeclaration).declarations[0].init as Literal).value).toEqual('test0')

  expect(varDecl1.type).toBe('VariableDeclaration')
  expect(((varDecl1 as VariableDeclaration).declarations[0].init as Literal).value).toEqual('test1')

  expect(importNodes[1].type).toBe('VariableDeclaration')
  expect(
    ((importNodes[1].declarations[0].init as MemberExpression).object as Identifier).name
  ).toEqual('__MODULE_3__')
})

test('checkForUndefinedVariables accounts for import statements', () => {
  const code = stripIndent`
    import { hello } from "module";
    hello;
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  transpile(program, context, false)
})
