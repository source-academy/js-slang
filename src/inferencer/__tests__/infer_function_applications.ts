import { stripIndent } from '../../utils/formatters'
import {
  printTypeEnvironment,
  printTypeConstraints,
  printTypeAnnotation
} from '../../utils/inferencerUtils'
import { toTypeInferredAst } from '../../utils/testing'
import { parseError } from '../..'
import { SourceError } from '../../types'

beforeEach(() => jest.spyOn(console, 'log').mockImplementationOnce(() => {}))

afterEach(() => (console.log as any).mockRestore())

test('Function is correctly applied', async () => {
  const code = stripIndent`function simple(x) {
    const y = x - 2;
    return y;
  }
  simple(1);`
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
y <- number
simple <- (number) => number
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
x: T24
2: T23
x - 2: T26
y: T25
y: T27
return y: T28
{...}: T29
simple: (T30) => T29simple: T32
1: T31
simple(1): T33
"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T24 = T30
T23 = number
T30 = number
T26 = number
T25 = number
T27 = number
T28 = number
T29 = number
T31 = number
T32 = (number) => number
T33 = number

"
`)
})

test('Polymorphic functions can be applied to different types of variables', async () => {
  const code = stripIndent`function identity(x) {
  return x;
}
const num = identity(3);
const str = identity("string") + "string";`
  const [, typeEnvironment] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
y <- number
simple <- (number) => number
identity <- (T37) => T37
num <- number
str <- string
"
`)
})

test('Incorrect number of arguments supplied', async () => {
  const code = stripIndent`simple(1, 2);`
  const errors: SourceError[] = []
  try {
    toTypeInferredAst(code)
  } catch (err) {
    errors.push(err)
  }
  expect(errors).toHaveLength(1)
  expect(parseError(errors)).toMatchInlineSnapshot(
    `"Line 1: The function expects 1 argument(s) but 2 argument(s) are supplied."`
  )
})

test('Incorrect type of arguments supplied', async () => {
  const code = stripIndent`simple(true);`
  const errors: SourceError[] = []
  try {
    toTypeInferredAst(code)
  } catch (err) {
    errors.push(err)
  }
  expect(errors).toHaveLength(1)
  expect(parseError(errors)).toMatchInlineSnapshot(
    `"Line 1: The function expects argument #1 to be a number but got a boolean instead."`
  )
})
