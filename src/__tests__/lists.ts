import { mockContext } from '../mocks/context'
import { parseError, runInContext } from '../index'
import { Finished } from '../types'

test('list creates list', () => {
  const code = `
    function f() { return 1; }
    list(1, 'a string ""', () => a, f, true, 3.14);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
  })
})

test('pair creates pair', () => {
  const code = `
    pair(1, 'a string ""');
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
  })
})

test('head works', () => {
  const code = `
    head(pair(1, 'a string ""'));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(1)
  })
})

test('tail works', () => {
  const code = `
    tail(pair(1, 'a string ""'));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('a string ""')
  })
})

test('tail of a 1 element list is null', () => {
  const code = `
    tail(list(1));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(null)
  })
})

test('empty list is null', () => {
  const code = `
    list();
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(null)
  })
})

test('for_each', () => {
  const code = `
    let sum = 0;
    for_each(x => {sum = sum + x;}, list(1, 2, 3));
    sum;
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(6)
  })
})

test('map', () => {
  const code = `
    equal(map(x => 2 * x, list(12, 11, 3)), list(24, 22, 6));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('filter', () => {
  const code = `
    equal(filter(x => x <= 4, list(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000)), list(2, 1, 3, 4, 2));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('build_list', () => {
  const code = `
    equal(build_list(5, x => x * x), list(0, 1, 4, 9, 16));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('reverse', () => {
  const code = `
    equal(reverse(list("string", null, undefined, null, 123)), list(123, null, undefined, null, "string"));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('append', () => {
  const code = `
    equal(append(list("string", 123), list(456, null, undefined)), list("string", 123, 456, null, undefined));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('member', () => {
  const code = `
    equal(member("string", list(1, 2, 3, "string", 123, 456, null, undefined)), list("string", 123, 456, null, undefined));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('remove', () => {
  const code = `
    remove(1, list(1));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(null)
  })
})

test('remove_all', () => {
  const code = `
    equal(remove_all(1, list(1, 2, 3, 4, 1, 1, "1", 5, 1, 1, 6)), list(2, 3, 4, "1", 5, 6));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('enum_list', () => {
  const code = `
    equal(enum_list(1, 5), list(1, 2, 3, 4, 5));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('list_ref', () => {
  const code = `
    list_ref(list(1, 2, 3, "4", 4), 4);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(4)
  })
})

test('accumulate', () => {
  const code = `
    accumulate((curr, acc) => curr + acc, 0, list(2, 3, 4, 1));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(10)
  })
})

