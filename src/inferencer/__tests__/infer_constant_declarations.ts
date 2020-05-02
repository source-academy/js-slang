import { stripIndent } from '../../utils/formatters'
import {
  printTypeEnvironment,
  printTypeConstraints,
  printTypeAnnotation
} from '../../utils/inferencerUtils'
import { toTypeInferredAst } from '../../utils/testing'
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementationOnce(() => {})
  jest.resetModules()
})

afterEach(() => {
  (console.log as any).mockRestore()
  jest.restoreAllMocks()
})

test('Type of constant declaration is type of values assigned to it - literals', () => {
  const code = stripIndent`const x = 2;
  const y = true;
  const z = "something";
  const a = undefined;`
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
x <- number
y <- boolean
z <- string
a <- undefined
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
2: T23
x: T24
true: T25
y: T26
\\"something\\": T27
z: T28
undefined: T30
a: T29
"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T23 = number
T24 = number
T25 = boolean
T26 = boolean
T27 = string
T28 = string
T30 = undefined
T29 = undefined

"
`)
})
