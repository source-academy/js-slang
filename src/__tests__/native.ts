import { stripIndent } from 'common-tags'
import { parseError, runInContext } from '../index'
import { mockContext } from '../mocks/context'

test('Proper stringify-ing of arguments during potentially infinite iterative function calls', () => {
  const code = stripIndent`
    function f(x) {
      return f(x);
    }
    const array = [1, 2, 3];
    f(list(1, 2, f, () => 1, array));
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, {
    scheduler: 'preemptive',
    executionMethod: 'native'
  })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(errors).toMatch(stripIndent`
    Line 2: Potential infinite recursion detected: f([ 1,
    [ 2,
    [ function f(x) {
        return f(x);
      },
    [() => 1, [[1, 2, 3], null]] ] ] ]) ...`)
  })
})

test('test increasing time limit for functions', () => {
  const code = stripIndent`
    function f(a, b) {
      return f(a + 1, b + 1);
    }
    f(1, 2);
  `
  const context = mockContext()
  const start = Date.now()
  const promise = runInContext(code, context, {
    scheduler: 'preemptive',
    executionMethod: 'native'
  })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    const timeTaken = Date.now() - start
    expect(errors).toMatch('Line 2: Potential infinite recursion detected')
    expect(errors).toMatch(/f\(\d+, \d+\) \.\.\. f\(\d+, \d+\) \.\.\. f\(\d+, \d+\)/)
    expect(timeTaken).toBeLessThan(2000)
    expect(timeTaken).toBeGreaterThanOrEqual(1000)
    const longerContext = mockContext()
    const longerPromise = runInContext(code, longerContext, {
      scheduler: 'preemptive',
      executionMethod: 'native'
    })
    return longerPromise.then(longerObj => {
      const longerErrors = parseError(longerContext.errors)
      const longerTimeTaken = Date.now() - start
      expect(longerErrors).toMatch('Line 2: Potential infinite recursion detected')
      expect(errors).toMatch(/f\(\d+, \d+\) \.\.\. f\(\d+, \d+\) \.\.\. f\(\d+, \d+\)/)
      expect(longerTimeTaken).toBeLessThan(20000)
      expect(longerTimeTaken).toBeGreaterThanOrEqual(10000)
    })
  })
})

test('test increasing time limit for mutual recursion', () => {
  const code = stripIndent`
    function f(a, b) {
      return g(a + 1, b + 1);
    }
    function g(a, b) {
      return f(a + 1, b + 1);
    }
    f(1, 2);
  `
  const context = mockContext()
  const start = Date.now()
  const promise = runInContext(code, context, {
    scheduler: 'preemptive',
    executionMethod: 'native'
  })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    const timeTaken = Date.now() - start
    expect(errors).toMatch(/Line [52]: Potential infinite recursion detected/)
    expect(errors).toMatch(/f\(\d+, \d+\) \.\.\. g\(\d+, \d+\)/)
    expect(timeTaken).toBeLessThan(2000)
    expect(timeTaken).toBeGreaterThanOrEqual(1000)
    const longerContext = mockContext()
    const longerPromise = runInContext(code, longerContext, {
      scheduler: 'preemptive',
      executionMethod: 'native'
    })
    return longerPromise.then(longerObj => {
      const longerErrors = parseError(longerContext.errors)
      const longerTimeTaken = Date.now() - start
      expect(longerErrors).toMatch(/Line [52]: Potential infinite recursion detected/)
      expect(longerErrors).toMatch(/f\(\d+, \d+\) \.\.\. g\(\d+, \d+\)/)
      expect(longerTimeTaken).toBeLessThan(20000)
      expect(longerTimeTaken).toBeGreaterThanOrEqual(10000)
    })
  })
})

test('test increasing time limit for while loops', () => {
  const code = stripIndent`
    while (true) {
    }
  `
  const context = mockContext(4)
  const start = Date.now()
  const promise = runInContext(code, context, {
    scheduler: 'preemptive',
    executionMethod: 'native'
  })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    const timeTaken = Date.now() - start
    expect(errors).toMatch('Line 1: Potential infinite loop detected')
    expect(timeTaken).toBeLessThan(2000)
    expect(timeTaken).toBeGreaterThanOrEqual(1000)
    const longerContext = mockContext(4)
    const longerPromise = runInContext(code, longerContext, {
      scheduler: 'preemptive',
      executionMethod: 'native'
    })
    return longerPromise.then(longerObj => {
      const longerErrors = parseError(longerContext.errors)
      const longerTimeTaken = Date.now() - start
      expect(longerErrors).toMatch('Line 1: Potential infinite loop detected')
      expect(longerTimeTaken).toBeLessThan(20000)
      expect(longerTimeTaken).toBeGreaterThanOrEqual(10000)
    })
  })
})
