import { mockContext } from '../mocks/context'
import { parseError, runInContext } from '../index'
import { Finished } from '../types'

test('Check that stack is at most 10k in size', () => {
  const code = `
    function f(x) {
      if (x <= 0) {
        return 0;
      } else {
        return 1 + f(x-1);
      }
    }
    f(10000);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Simple tail call returns work', () => {
  const code = `
    function f(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+1);
      }
    }
    f(5000, 5000);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(10000)
    expect(context.errors).toEqual([])
  })
})

test('Tail call in conditional expressions work', () => {
  const code = `
    function f(x, y) {
      return x <= 0 ? y : f(x-1, y+1);
    }
    f(5000, 5000);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(10000)
    expect(context.errors).toEqual([])
  })
})

test('Tail call in boolean operators work', () => {
  const code = `
    function f(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return false || f(x-1, y+1);
      }
    }
    f(5000, 5000);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(10000)
    expect(context.errors).toEqual([])
  })
})

test('Tail call in nested mix of conditional expressions boolean operators work', () => {
  const code = `
    function f(x, y) {
      return x <= 0 ? y : false || x > 0 ? f(x-1, y+1) : 'unreachable';
    }
    f(5000, 5000);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(10000)
    expect(context.errors).toEqual([])
  })
})
