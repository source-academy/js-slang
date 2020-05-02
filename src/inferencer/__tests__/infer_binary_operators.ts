import { stripIndent } from '../../utils/formatters'
import {
  printTypeEnvironment,
  printTypeConstraints,
  printTypeAnnotation
} from '../../utils/inferencerUtils'
import { toTypeInferredAst } from '../../utils/testing'
import { SourceError } from '../../types'
import { parseError } from '../..'

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementationOnce(() => {})
})

afterEach(() => {
  ;(console.log as any).mockRestore()
})

test('Infer binary arithmetic operators correctly', async () => {
  const code = stripIndent`const x = 1;
  x + 6;
  x - 2;
  (x / 2) * 3 - (10 % 4);
  `
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
1: T23
x: T24
x: T26
6: T25
x + 6: T27
x: T29
2: T28
x - 2: T30
x: T32
2: T31
x / 2: T34
3: T33
x / 2 * 3: T37
10: T35
4: T36
10 % 4: T38
x / 2 * 3 - 10 % 4: T39
"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T23 = number
T24 = number
T26 = number
T25 = number
A40 = number
T27 = number
T29 = number
T28 = number
T30 = number
T32 = number
T31 = number
T34 = number
T33 = number
T37 = number
T35 = number
T36 = number
T38 = number
T39 = number

"
`)
})

test('Infer binary boolean operators correctly', async () => {
  const code = stripIndent`const y = (x / 2) === 0;
    const z = 'string' === 'anotherstring';
    const a = 1 !== 2;
    const b = 'string1' !== 'string1';
    const c = 1 > 2;
    const d = 1 >= 2;
    const e = 2 < 1;
    const f = x <= 10;`
  const [, typeEnvironment] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
x <- number
y <- boolean
z <- boolean
a <- boolean
b <- boolean
c <- boolean
d <- boolean
e <- boolean
f <- boolean
"
`)
})

test('Binary operators should be applied to addables of the same type', async () => {
  const code = stripIndent`1 + 'string';`
  const errors: SourceError[] = []
  try {
    toTypeInferredAst(code)
  } catch (err) {
    errors.push(err)
  }
  expect(errors).toHaveLength(1)
  expect(parseError(errors)).toMatchInlineSnapshot(
    `"Line 1: The function expects argument 2 to be an addable but got a number"`
  )
})

test('Binary operators are applied to the wrong types', async () => {
  const code = stripIndent`x || false;
    1 && false;`
  const errors: SourceError[] = []
  try {
    toTypeInferredAst(code)
  } catch (err) {
    errors.push(err)
  }
  expect(errors).toHaveLength(1)
  expect(parseError(errors)).toMatchInlineSnapshot(
    `"Line 1: The function expects argument 1 to be a boolean but got a number"`
  )
})
