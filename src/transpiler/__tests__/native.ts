import { runInContext } from '../../index'
import { mockContext } from '../../mocks/context'
import { Chapter, Finished } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectNativeToTimeoutAndError } from '../../utils/testing'

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
  [() => 1, [[1, 2, 3], null]]]]]) ...`)
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

test('test proper setting of variables in an outer scope', async () => {
  const context = mockContext(Chapter.SOURCE_3)
  await runInContext(
    stripIndent`
    let a = 'old';
    function f() {
      return a;
    }
  `,
    context
  )
  const result = await runInContext('a = "new"; f();', context)
  expect(result.status).toBe('finished')
  expect((result as Finished).value).toBe('new')
})

test('using internal names still work', async () => {
  const context = mockContext(Chapter.SOURCE_3)
  let result = await runInContext(
    stripIndent`
    const boolOrErr = 1;
    const program = 2;
    function wrap() {
      return boolOrErr;
    }
    wrap();
  `,
    context
  )
  expect(result.status).toBe('finished')
  expect((result as Finished).value).toBe(1)
  result = await runInContext('program;', context)
  expect(result.status).toBe('finished')
  expect((result as Finished).value).toBe(2)
})

test('assigning a = b where b was from a previous program call works', async () => {
  const context = mockContext(Chapter.SOURCE_3)
  const result = await runInContext(
    stripIndent`
    let b = null;
    b = pair;
    b = 1;
  `,
    context
  )
  expect(result.status).toBe('finished')
  expect((result as Finished).value).toBe(1)
})
