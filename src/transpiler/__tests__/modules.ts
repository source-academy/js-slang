import type { Identifier } from 'estree'

import { runInContext } from '../..'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, Value } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { transformImportDeclarations } from '../transpiler'
import { NATIVE_STORAGE_ID } from '../../constants'
import * as ast from '../../utils/ast/astCreator'

jest.mock('../../modules/loader/loaders')

test('Transform import declarations into variable declarations', async () => {
  const code = stripIndent`
    import { foo } from "one_module";
    import { bar } from "another_module";
    foo(bar);
  `
  const context = mockContext(Chapter.SOURCE_4)
  const program = parse(code, context)!
  const [importNodes] = transformImportDeclarations(program, ast.identifier(NATIVE_STORAGE_ID))

  expect(importNodes[0].type).toBe('VariableDeclaration')
  expect((importNodes[0].declarations[0].id as Identifier).name).toEqual('foo')

  expect(importNodes[1].type).toBe('VariableDeclaration')
  expect((importNodes[1].declarations[0].id as Identifier).name).toEqual('bar')
})

// test('Transpiler accounts for user variable names when transforming import statements', async () => {
//   const code = stripIndent`
//     import { foo } from "one_module";
//     import { bar as __MODULE__2 } from "another_module";
//     const __MODULE__ = 'test0';
//     const __MODULE__0 = 'test1';
//     foo(bar);
//   `
//   const context = mockContext(4)
//   const program = parse(code, context)!
//   const [[varDecl0, varDecl1]] = transformImportDeclarations(
//     program,
//     new Set<string>(['__MODULE__', '__MODULE__0']),
//     false,
//     false
//   )

//   expect(importNodes[0].type).toBe('VariableDeclaration')
//   expect(
//     ((importNodes[0].declarations[0].init as MemberExpression).object as Identifier).name
//   ).toEqual('__MODULE__1')

//   expect(varDecl0.type).toBe('VariableDeclaration')
//   expect(((varDecl0 as VariableDeclaration).declarations[0].init as Literal).value).toEqual('test0')

//   expect(varDecl1.type).toBe('VariableDeclaration')
//   expect(((varDecl1 as VariableDeclaration).declarations[0].init as Literal).value).toEqual('test1')

//   expect(importNodes[1].type).toBe('VariableDeclaration')
//   expect(
//     ((importNodes[1].declarations[0].init as MemberExpression).object as Identifier).name
//   ).toEqual('__MODULE__3')
// })

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
