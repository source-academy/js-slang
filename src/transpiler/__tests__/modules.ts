import { Identifier, ImportDeclaration } from 'estree'

import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { stripIndent } from '../../utils/formatters'
import {
  transformImportDeclarations,
  transformSingleImportDeclaration,
  transpile
} from '../transpiler'

jest.mock('../../modules/moduleLoader', () => ({
  ...jest.requireActual('../../modules/moduleLoader'),
  memoizedGetModuleFile: () => 'undefined;'
}))

test('Transform single import decalration', () => {
  const code = `import { foo, bar } from "test/one_module";`
  const context = mockContext(4)
  const program = parse(code, context)!
  const result = transformSingleImportDeclaration(123, program.body[0] as ImportDeclaration)
  const names = result.map(decl => (decl.declarations[0].id as Identifier).name)
  expect(names[0]).toStrictEqual('foo')
  expect(names[1]).toStrictEqual('bar')
})

test('Transform import decalrations variable decalarations', () => {
  const code = stripIndent`
    import { foo } from "test/one_module";
    import { bar } from "test/another_module";
    foo(bar);
  `
  const context = mockContext(4)
  const program = parse(code, context)!
  transformImportDeclarations(program)
  expect(program.body[0].type).toBe('VariableDeclaration')
  expect(program.body[1].type).toBe('VariableDeclaration')
})

test('checkForUndefinedVariables accounts for import statements', () => {
  const code = stripIndent`
    import { hello } from "module";
    hello;
  `
  const context = mockContext(4)
  const program = parse(code, context)!
  transpile(program, context, false)
})
