import { transformSingleImportDeclaration, transformImportDeclarations } from '../transpiler'
import { stripIndent } from '../../utils/formatters'
import { parse } from '../../parser/parser'
import { mockContext } from '../../mocks/context'
import { ImportDeclaration, Identifier } from 'estree'

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
