import { stripIndent } from '../utils/formatters'
import { expectNativeToTimeoutAndError } from '../utils/testing'

test('Proper stringify-ing of arguments during potentially infinite iterative function calls', async () => {
  const code = stripIndent`
    function f(x) {
      return f(x);
    }
    const array = [1, 2, 3];
    f(list(1, 2, f, () => 1, array));
  `
  const error = await expectNativeToTimeoutAndError(code, 1000)
  expect(error).toMatch(stripIndent`
  Line 2: Potential infinite recursion detected: f([ 1,
  [ 2,
  [ function f(x) {
      return f(x);
    },
  [() => 1, [[1, 2, 3], null]] ] ] ]) ...`)
})

test('test increasing time limit for functions', async () => {
  const code = stripIndent`
    function f(a, b) {
      return f(a + 1, b + 1);
    }
    f(1, 2);
  `
  const firstError = await expectNativeToTimeoutAndError(code, 1000)
  expect(firstError).toMatch('Line 2: Potential infinite recursion detected')
  expect(firstError).toMatch(/f\(\d+, \d+\) \.\.\. f\(\d+, \d+\) \.\.\. f\(\d+, \d+\)/)
  const secondError = await expectNativeToTimeoutAndError(code, 10000)
  expect(secondError).toMatch('Line 2: Potential infinite recursion detected')
  expect(secondError).toMatch(/f\(\d+, \d+\) \.\.\. f\(\d+, \d+\) \.\.\. f\(\d+, \d+\)/)
})

test('test increasing time limit for mutual recursion', async () => {
  const code = stripIndent`
    function f(a, b) {
      return g(a + 1, b + 1);
    }
    function g(a, b) {
      return f(a + 1, b + 1);
    }
    f(1, 2);
  `
  const firstError = await expectNativeToTimeoutAndError(code, 1000)
  expect(firstError).toMatch(/Line [52]: Potential infinite recursion detected/)
  expect(firstError).toMatch(/f\(\d+, \d+\) \.\.\. g\(\d+, \d+\)/)
  const secondError = await expectNativeToTimeoutAndError(code, 10000)
  expect(secondError).toMatch(/Line [52]: Potential infinite recursion detected/)
  expect(secondError).toMatch(/f\(\d+, \d+\) \.\.\. g\(\d+, \d+\)/)
})

test('test increasing time limit for while loops', async () => {
  const code = stripIndent`
    while (true) {
    }
  `
  const firstError = await expectNativeToTimeoutAndError(code, 1000)
  expect(firstError).toMatch('Line 1: Potential infinite loop detected')
  const secondError = await expectNativeToTimeoutAndError(code, 10000)
  expect(secondError).toMatch('Line 1: Potential infinite loop detected')
})
