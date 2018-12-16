import { parseError, runInContext } from '../../index'
import { mockContext } from '../../mocks/context'
import { Finished } from '../../types'

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
    for_each(x => {
      sum = sum + x;
    }, list(1, 2, 3));
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
  const context = mockContext(2)
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
  const context = mockContext(2)
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
  const context = mockContext(2)
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
  const context = mockContext(2)
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
  const context = mockContext(2)
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
    equal(
      member("string", list(1, 2, 3, "string", 123, 456, null, undefined)),
      list("string", 123, 456, null, undefined));
  `
  const context = mockContext(2)
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
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(null)
  })
})

test('remove not found', () => {
  const code = `
    remove(2, list(1));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toEqual([1, null])
  })
})

test('remove_all', () => {
  const code = `
    equal(remove_all(1, list(1, 2, 3, 4, 1, 1, "1", 5, 1, 1, 6)), list(2, 3, 4, "1", 5, 6));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('remove_all not found', () => {
  const code = `
    equal(remove_all(1, list(2, 3, "1")), list(2, 3, "1"));
  `
  const context = mockContext(2)
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
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('enum_list with floats', () => {
  const code = `
    equal(enum_list(1.5, 5), list(1.5, 2.5, 3.5, 4.5));
  `
  const context = mockContext(2)
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
  const context = mockContext(2)
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
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(10)
  })
})

test('list_to_string', () => {
  const code = `
    list_to_string(list(1, 2, 3));
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('[1, [2, [3, null]]]')
  })
})

test('assoc', () => {
  const code = `
    equal(assoc(3, list(pair(1, 2), pair(3, 4))), pair(3, 4));
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('assoc not found', () => {
  const code = `
    equal(assoc(2, list(pair(1, 2), pair(3, 4))), false);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('')
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('set_head', () => {
  const code = `
    let p = pair(1, 2);
    const q = p;
    set_head(p, 3);
    p === q && equal(p, pair(3, 2));
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

test('set_tail', () => {
  const code = `
    let p = pair(1, 2);
    const q = p;
    set_tail(p, 3);
    p === q && equal(p, pair(1, 3));
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

test('non-list error head', () => {
  const code = `
    head([1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error tail', () => {
  const code = `
    tail([1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error length', () => {
  const code = `
    length([1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error map', () => {
  const code = `
    map(x=>x, [1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error for_each', () => {
  const code = `
    for_each(x=>x, [1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error reverse', () => {
  const code = `
    reverse([1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error append', () => {
  const code = `
    append([1, 2, 3], list(1, 2, 3));
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error member', () => {
  const code = `
    member(1, [1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error remove', () => {
  const code = `
    remove(1, [1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error remove_all', () => {
  const code = `
    remove_all(1, [1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error assoc', () => {
  const code = `
    assoc(1, [1, 2, 3]);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error filter', () => {
  const code = `
    filter(x => true, [1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error accumulate', () => {
  const code = `
    accumulate((x, y) => x + y, [1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error accumulate', () => {
  const code = `
    accumulate((x, y) => x + y, [1, 2, 3]);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error set_head', () => {
  const code = `
    set_head([1, 2, 3], 4);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('non-list error set_tail', () => {
  const code = `
    set_tail([1, 2, 3], 4);
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad number error build_list', () => {
  const code = `
    build_list(-1, x => x);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad number error build_list', () => {
  const code = `
    build_list(1.5, x => x);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad number error build_list', () => {
  const code = `
    build_list('1', x => x);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad number error enum_list', () => {
  const code = `
    enum_list('1', '5');
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad number error enum_list', () => {
  const code = `
    enum_list('1', 5);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad number error enum_list', () => {
  const code = `
    enum_list(1, '5');
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad index error list_ref', () => {
  const code = `
    list_ref(list(1, 2, 3), 3);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad index error list_ref', () => {
  const code = `
    list_ref(list(1, 2, 3), -1);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad index error list_ref', () => {
  const code = `
    list_ref(list(1, 2, 3), 1.5);
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})

test('bad index error list_ref', () => {
  const code = `
    list_ref(list(1, 2, 3), '1');
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj.status).toBe('error')
  })
})
