import { stripIndent } from '../../utils/formatters'
import {
  printTypeEnvironment,
  printTypeConstraints,
  printTypeAnnotation
} from '../../utils/inferencerUtils'
import { toTypeInferredAst } from '../../utils/testing'
beforeEach(() => jest.spyOn(console, 'log').mockImplementationOnce(() => {}))

afterEach(() => (console.log as any).mockRestore())

test('Identifiers with same names should have a type respective to their value in their respective scopes', () => {
  const code = stripIndent`const x = true;
  {
      const x = 1;
      x + 1; // this should not throw an error
  }`
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
x <- number
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
true: T23
x: T24
1: T25
x: T26
x: T28
1: T27
x + 1: T29
{...}: T30
"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T23 = boolean
T24 = boolean
T25 = number
T26 = number
T28 = number
T27 = number
A31 = number
T29 = number
T30 = undefined

"
`)
})
