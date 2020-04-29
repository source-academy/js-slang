import { stripIndent } from '../../utils/formatters'
import {
  printTypeEnvironment,
  printTypeConstraints,
  printTypeAnnotation
} from '../../utils/inferencerUtils'
import { toTypeInferredAst } from '../../utils/testing'

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementationOnce(() => {})
})

// TODO: Check how I can clear the type environment
afterEach(() => {
  ;(console.log as any).mockRestore()
})

test('Infer unary operators correctly', async () => {
  const code = stripIndent`const num = 2;
  const bool = true;
  const negative = -2;
  const applyMinusToVariable = -num;
  const negated = !bool;
  const applyNegationToVariable = !bool;
  `
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
num <- number
bool <- boolean
negative <- number
applyMinusToVariable <- number
negated <- boolean
applyNegationToVariable <- boolean
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
2: T18
num: T19
true: T20
bool: T21
2: T22
2: T22
-2: T24
negative: T23
num: T25
num: T25
-num: T27
applyMinusToVariable: T26
bool: T28
bool: T28
!bool: T30
negated: T29
bool: T31
bool: T31
!bool: T33
applyNegationToVariable: T32
"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T18 = number
T19 = number
T20 = boolean
T21 = boolean
T22 = number
T24 = number
T23 = number
T25 = number
T27 = number
T26 = number
T28 = boolean
T30 = boolean
T29 = boolean
T31 = boolean
T33 = boolean
T32 = boolean

"
`)
})
