import { transformImportDeclarations } from '../transpiler'
import { stripIndent } from '../../utils/formatters'
import { parse } from '../../parser/parser'
import { mockContext } from '../../mocks/context'

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