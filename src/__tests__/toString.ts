import { stripIndent } from 'common-tags'
import { defineSymbol } from '../createContext'
import { runInContext } from '../index'
import { toString } from '../interop'
import { mockContext } from '../mocks/context'
import { Finished } from '../types'

test('String representation of numbers are nice', () => {
  const code = stripIndent`
  toString(0);
  `
  const context = mockContext()
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of strings are nice', () => {
  const code = stripIndent`
  toString('a string');
  `
  const context = mockContext()
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of booleans are nice', () => {
  const code = stripIndent`
  toString('true');
  `
  const context = mockContext()
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of functions are nice', () => {
  const code = stripIndent`
  function f(x, y) {
    return z;
  }
  toString(f);
  `
  const context = mockContext()
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of arrow functions are nice', () => {
  const code = stripIndent`
  const f = (x, y) => z;
  toString(f);
  `
  const context = mockContext()
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of arrays are nice', () => {
  const code = stripIndent`
  const xs = [1, 'true', true, () => x];
  toString(xs);
  `
  const context = mockContext(3)
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of empty arrays are nice', () => {
  const code = stripIndent`
  const xs = [];
  toString(xs);
  `
  const context = mockContext(3)
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of lists are nice', () => {
  const code = stripIndent`
  toString(enum_list(1, 10));
  `
  const context = mockContext(2)
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of huge lists are nice', () => {
  const code = stripIndent`
  toString(enum_list(1, 1000));
  `
  const context = mockContext(2)
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of objects are nice', () => {
  const code = stripIndent`
  const o = { a: 1, b: true, c: () => x };
  toString(o);
  `
  const context = mockContext(100)
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of builtins are nice', () => {
  const code = stripIndent`
  toString(pair);
  `
  const context = mockContext(2)
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of builtins without __SOURCE__ are nice', () => {
  const code = stripIndent`
  toString(prompt);
  `
  const context = mockContext()
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of null is nice', () => {
  const code = stripIndent`
  toString(null);
  `
  const context = mockContext(2)
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of undefined is nice', () => {
  const code = stripIndent`
  toString(undefined);
  `
  const context = mockContext()
  defineSymbol(context, 'toString', toString)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})
