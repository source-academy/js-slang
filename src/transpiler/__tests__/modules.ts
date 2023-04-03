import type { Identifier, Literal, MemberExpression, VariableDeclaration } from 'estree'
import type { FunctionLike, MockedFunction } from 'jest-mock'

import { mockContext } from '../../mocks/context'
import { UndefinedImportError } from '../../modules/errors'
import { memoizedGetModuleFile } from '../../modules/moduleLoader'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { transformImportDeclarations, transpile } from '../transpiler'

jest.mock('../../modules/moduleLoader', () => ({
  ...jest.requireActual('../../modules/moduleLoader'),
  memoizedGetModuleFile: jest.fn(),
  memoizedGetModuleManifest: jest.fn().mockReturnValue({
    one_module: {
      tabs: []
    },
    another_module: {
      tabs: []
    }
  }),
  memoizedloadModuleDocs: jest.fn().mockReturnValue({
    foo: 'foo',
    bar: 'bar'
  })
}))

const asMock = <T extends FunctionLike>(func: T) => func as MockedFunction<T>
const mockedModuleFile = asMock(memoizedGetModuleFile)

test('Transform import declarations into variable declarations', () => {
  mockedModuleFile.mockImplementation((name, type) => {
    if (type === 'json') {
      return name === 'one_module' ? "{ foo: 'foo' }" : "{ bar: 'bar' }"
    } else {
      return 'undefined'
    }
  })

  const code = stripIndent`
    import { foo } from "test/one_module";
    import { bar } from "test/another_module";
    foo(bar);
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  const [, importNodes] = transformImportDeclarations(program, new Set<string>(), false)

  expect(importNodes[0].type).toBe('VariableDeclaration')
  expect((importNodes[0].declarations[0].id as Identifier).name).toEqual('foo')

  expect(importNodes[1].type).toBe('VariableDeclaration')
  expect((importNodes[1].declarations[0].id as Identifier).name).toEqual('bar')
})

test('Transpiler accounts for user variable names when transforming import statements', () => {
  mockedModuleFile.mockImplementation((name, type) => {
    if (type === 'json') {
      return name === 'one_module' ? "{ foo: 'foo' }" : "{ bar: 'bar' }"
    } else {
      return 'undefined'
    }
  })

  const code = stripIndent`
    import { foo } from "test/one_module";
    import { bar as __MODULE__2 } from "test/another_module";
    const __MODULE__ = 'test0';
    const __MODULE__0 = 'test1';
    foo(bar);
  `
  const context = mockContext(4)
  const program = parse(code, context)!
  const [, importNodes, [varDecl0, varDecl1]] = transformImportDeclarations(
    program,
    new Set<string>(['__MODULE__', '__MODULE__0']),
    false
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

test('checkForUndefinedVariables accounts for import statements', () => {
  mockedModuleFile.mockImplementation((name, type) => {
    if (type === 'json') {
      return "{ hello: 'hello' }"
    } else {
      return 'undefined'
    }
  })

  const code = stripIndent`
    import { foo } from "one_module";
    foo;
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  transpile(program, context, false)
})

test('importing undefined variables should throw errors', () => {
  mockedModuleFile.mockImplementation((name, type) => {
    if (type === 'json') {
      return '{}'
    } else {
      return 'undefined'
    }
  })

  const code = stripIndent`
    import { hello } from 'one_module';
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  try {
    transpile(program, context, false)
  } catch (error) {
    expect(error).toBeInstanceOf(UndefinedImportError)
    expect((error as UndefinedImportError).symbol).toEqual('hello')
  }
})
