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
  ;(console.log as any).mockRestore()
  jest.restoreAllMocks()
})

test('Type of a function is comprised of its argument types and result types - monomorphic functions', () => {
  const code = stripIndent`function simple() {
         return 1;
     }
     simple();`
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
simple <- () => number
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
1: T23
return 1: T24
{...}: T25
simple: () => T25simple: T26
simple(): T27
"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T23 = number
T24 = number
T25 = number
T26 = () => number
T27 = number

"
`)
})

test('Type of a function is comprised of its argument types and result types - polymorphic functions', () => {
  const code = stripIndent`function identity(x) {
             return x;
        }
        identity(3);
        identity('string');
        identity(true);`
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
simple <- () => number
identity <- (T31) => T31
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
x: T28
return x: T29
{...}: T30
identity: (T31) => T30identity: T33
3: T32
identity(3): T34
identity: T36
'string': T35
identity('string'): T37
identity: T39
true: T38
identity(true): T40
"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T23 = number
T24 = number
T25 = number
T26 = () => number
T27 = number
T28 = T31
T29 = T31
T30 = T31
T32 = number
T33 = (T31) => T31
T41 = number
T34 = number
T35 = string
T36 = (T31) => T31
T42 = string
T37 = string
T38 = boolean
T39 = (T31) => T31
T43 = boolean
T40 = boolean

"
`)
})
