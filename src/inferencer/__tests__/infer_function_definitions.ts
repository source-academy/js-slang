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
  jest.resetModules()
})

afterEach(() => {
  ;(console.log as any).mockRestore()
  jest.restoreAllMocks()
})

test('Function definitions are type checked', () => {
  const code = stripIndent`function compose(f) {
    return i => f(i + 2);
}
const h = compose(x => x);
h(1);`
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
compose <- (T32) => (A28) => T27
h <- (A28) => T27
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
f: T26
i: T24
2: T23
i + 2: T25
f(i + 2): T27
T29: (T28) => T27
return T29: T30
{...}: T31
compose: (T32) => T31compose: T36
x: T34
T35: (T33) => T34
compose(T35): T37
h: T38
h: T40
1: T39
h(1): T41
"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T24 = A28
T23 = number
A42 = number
T25 = number
T26 = T32
T29 = (A28) => T27
T30 = (A28) => T27
T31 = (A28) => T27
T34 = T33
T35 = (T33) => T34
T36 = (T32) => (A28) => T27
T43 = (T33) => T34
T37 = (A28) => T27
T38 = (A28) => T27
T39 = number
T40 = (A28) => T27
A44 = number
T41 = T45

"
`)
})

test('Function definitions are typed checked (negative)', async () => {
  const code = stripIndent`function compose(f) {
    return i => f(i + 2);
}
const h = compose(x => x);
h(true);`
  const errors: SourceError[] = []
  try {
    toTypeInferredAst(code)
  } catch (err) {
    errors.push(err)
  }
  expect(parseError(errors)).toMatchInlineSnapshot(
    `"Line 5: The function expects argument #1 to be an addable (number or string) but got a boolean instead."`
  )
})
