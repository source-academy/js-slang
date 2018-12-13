import { stripIndent } from 'common-tags'
import { mockContext } from '../mocks/context'
import { runInContext } from '../index'
import { Finished } from '../types'

test('String representation of numbers are nice', () => {
  const code = stripIndent`
  stringify(0);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of strings are nice', () => {
  const code = stripIndent`
  stringify('a string');
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of booleans are nice', () => {
  const code = stripIndent`
  stringify('true');
  `
  const context = mockContext()
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
  stringify(f);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of arrow functions are nice', () => {
  const code = stripIndent`
  const f = (x, y) => z;
  stringify(f);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of arrays are nice', () => {
  const code = stripIndent`
  const xs = [1, 'true', true, () => x];
  stringify(xs);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of multidimensional arrays are nice', () => {
  const code = stripIndent`
  const xs = [1, 'true', [true, () => x, [[]]]];
  stringify(xs);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of empty arrays are nice', () => {
  const code = stripIndent`
  const xs = [];
  stringify(xs);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of lists are nice', () => {
  const code = stripIndent`
  stringify(enum_list(1, 10));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of huge lists are nice', () => {
  const code = stripIndent`
  stringify(enum_list(1, 1000));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of huge arrays are nice', () => {
  const code = stripIndent`
  const arr = [];
  for (let i = 0; i < 100; i = i + 1) {
    arr[i] = i;
  }
  stringify(arr);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of objects are nice', () => {
  const code = stripIndent`
  const o = { a: 1, b: true, c: () => x };
  stringify(o);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of nested objects are nice', () => {
  const code = stripIndent`
  const o = { a: 1, b: true, c: () => x, d: { e: 5, f: 6 } };
  stringify(o);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of big objects are nice', () => {
  const code = stripIndent`
  const o = { a: 1, b: true, c: () => x, d: { e: 5, f: 6 }, g: 0, h: 0, i: 0, j: 0, k: 0, l: 0, m: 0, n: 0};
  stringify(o);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of nested objects are nice', () => {
  const code = stripIndent`
  let o = {};
  o.o = o;
  stringify(o);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of builtins are nice', () => {
  const code = stripIndent`
  stringify(pair);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of null is nice', () => {
  const code = stripIndent`
  stringify(null);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation of undefined is nice', () => {
  const code = stripIndent`
  stringify(undefined);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation with no indent', () => {
  const code = stripIndent`
  stringify(parse('x=>x;'), 0);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation with 1 space indent', () => {
  const code = stripIndent`
  stringify(parse('x=>x;'), 1);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation with default (2 space) indent', () => {
  const code = stripIndent`
  stringify(parse('x=>x;'));
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation with more than 10 space indent should trim to 10 space indent', () => {
  const code = stripIndent`
  stringify(parse('x=>x;'), 100);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('String representation with custom indent', () => {
  const code = stripIndent`
  stringify(parse('x=>x;'), ' ... ');
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})
