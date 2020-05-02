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

test('Infer conditional expressions correctly', async () => {
  const code = stripIndent`const x = 1 === 2 ? 1 : 2;
    const y = 6 !== 5 ? 'string1' : 'string2';
    const cond = 1 === 1 ? x : -x === x ? x : -x;
    `
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
x <- number
y <- string
cond <- number
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
1: T23
2: T24
1 === 2: T27
1: T25
2: T26
1 === 2 ? 2 : 1: T28
x: T29
6: T30
5: T31
6 !== 5: T34
'string1': T32
'string2': T33
6 !== 5 ? 'string2' : 'string1': T35
y: T36
1: T37
1: T38
1 === 1: T47
x: T48
x: T39
x: T39
-x: T40
x: T41
-x === x: T43
x: T44
x: T42
x: T42
-x: T45
-x === x ? -x : x: T46
1 === 1 ? -x === x ? -x : x : x: T49
cond: T50
"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T23 = number
T24 = number
A51 = number
T27 = boolean
T26 = number
T25 = number
T28 = number
T29 = number
T30 = number
T31 = number
A52 = number
T34 = boolean
T33 = string
T32 = string
T35 = string
T36 = string
T37 = number
T38 = number
A53 = number
T47 = boolean
T39 = number
T40 = number
T41 = number
A54 = number
T43 = boolean
T42 = number
T45 = number
T44 = number
T46 = number
T48 = number
T49 = number
T50 = number

"
`)
})

test('Infer conditional statements correctly', async () => {
  const code = stripIndent`function someFunction2(x) {
             if (x !== 1) {
                 const y = 1;
                 return y;
             } else {
                 const y = 1 + 1;
                 return y;
             }
         }
    `
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
x <- number
y <- number
cond <- number
someFunction2 <- (A72) => number
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
x: T56
1: T55
x !== 1: T69
1: T57
y: T58
y: T59
return y: T60
{...}: T61
1: T62
1: T63
1 + 1: T65
y: T64
y: T66
return y: T67
{...}: T68
if x !== 1 {...} else {...}: T70
{...}: T71
someFunction2: (T72) => T71"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T23 = number
T24 = number
A51 = number
T27 = boolean
T26 = number
T25 = number
T28 = number
T29 = number
T30 = number
T31 = number
A52 = number
T34 = boolean
T33 = string
T32 = string
T35 = string
T36 = string
T37 = number
T38 = number
A53 = number
T47 = boolean
T39 = number
T40 = number
T41 = number
A54 = number
T43 = boolean
T42 = number
T45 = number
T44 = number
T46 = number
T48 = number
T49 = number
T50 = number
T56 = A72
T55 = number
A73 = number
T69 = boolean
T62 = number
T63 = number
A74 = number
T65 = number
T64 = number
T66 = number
T67 = number
T68 = number
T57 = number
T58 = number
T59 = number
T60 = number
T61 = number
T70 = number
T71 = number

"
`)
})

test('Infer conditional statements correctly -- polymorphic types', async () => {
  const code = stripIndent`function polyMorphicTypeConditional(x) {
        if (1 === 2) {
            return x;
        } else {
            return x;
        }
    }
    `
  const [program, typeEnvironment, constraintStore] = toTypeInferredAst(code)
  printTypeEnvironment(typeEnvironment)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Environment:
x <- number
y <- number
cond <- number
someFunction2 <- (A72) => number
polyMorphicTypeConditional <- (T86) => T86
"
`)

  printTypeAnnotation(program)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Initial Type Annotations:
1: T75
2: T76
1 === 2: T83
x: T77
return x: T78
{...}: T79
x: T80
return x: T81
{...}: T82
if 1 === 2 {...} else {...}: T84
{...}: T85
polyMorphicTypeConditional: (T86) => T85"
`)

  printTypeConstraints(constraintStore)
  expect((console.log as any).mock.calls[(console.log as any).mock.calls.length - 1][0])
    .toMatchInlineSnapshot(`
"Printing Type Constraints:
T23 = number
T24 = number
A51 = number
T27 = boolean
T26 = number
T25 = number
T28 = number
T29 = number
T30 = number
T31 = number
A52 = number
T34 = boolean
T33 = string
T32 = string
T35 = string
T36 = string
T37 = number
T38 = number
A53 = number
T47 = boolean
T39 = number
T40 = number
T41 = number
A54 = number
T43 = boolean
T42 = number
T45 = number
T44 = number
T46 = number
T48 = number
T49 = number
T50 = number
T56 = A72
T55 = number
A73 = number
T69 = boolean
T62 = number
T63 = number
A74 = number
T65 = number
T64 = number
T66 = number
T67 = number
T68 = number
T57 = number
T58 = number
T59 = number
T60 = number
T61 = number
T70 = number
T71 = number
T75 = number
T76 = number
A87 = number
T83 = boolean
T80 = T86
T81 = T86
T82 = T86
T77 = T86
T78 = T86
T79 = T86
T84 = T86
T85 = T86

"
`)
})

test('Throws errors when a different type is returned', async () => {
  const code = stripIndent`1 === 2 ? 1 : 'string';
  6 !== 5 ? true : 'string2';
  `
  const errors: SourceError[] = []
  try {
    toTypeInferredAst(code)
  } catch (err) {
    errors.push(err)
  }
  expect(errors).toHaveLength(1)
  expect(parseError(errors)).toMatchInlineSnapshot(
    `"Line 1: Expected consequent and alternative to return the same types, but the consequent returns a number and the alternative returns a string instead."`
  )
})

test('Conditional statement throws errors when a different type is returned', async () => {
  const code = stripIndent`function condStatementError(x) {
        if (x !== 1) {
            const y = 1;
            return y;
        } else {
            return true;
        }
    }
    `
  const errors: SourceError[] = []
  try {
    toTypeInferredAst(code)
  } catch (err) {
    errors.push(err)
  }
  expect(errors).toHaveLength(1)
  expect(parseError(errors)).toMatchInlineSnapshot(
    `"Line 2: Expected consequent and alternative to return the same types, but the consequent returns a number and the alternative returns a boolean instead."`
  )
})
