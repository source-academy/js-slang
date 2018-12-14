import { oneLine } from 'common-tags'

import { mockContext } from '../../mocks/context'
import { runInContext } from '../../index'

test('Parses empty program', () => {
  const program = `
    stringify(parse(""), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses literals', () => {
  const program = `
    stringify(parse("3; true; false; ''; \\"\\"; 'bob'; 1; 20;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses name expression', () => {
  const program = `
    stringify(parse("x;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses name expressions', () => {
  const program = `
    stringify(parse("x; moreNames; undefined;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses infix expressions', () => {
  const program = `
    stringify(parse("3 + 5 === 8 || !true && false;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses declaration statements', () => {
  const program = `
    stringify(parse("const x = 5; let y = x;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses assignment statements', () => {
  const program = `
    stringify(parse("x = 5; x = x; if (true) { x = 5; } else {}"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses if statements', () => {
  const program = `
    stringify(parse("if (true) { hi; } else { haha; } if (false) {} else {}"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(program, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses multi-argument arrow function expressions properly', () => {
  const code = `
    stringify(parse("(x, y) => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses multi-argument arrow function expressions properly', () => {
  const code = `
    stringify(parse("(x, y) => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses multi-argument arrow function assignments properly', () => {
  const code = `
    stringify(parse("const y = (x, y) => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses arrow function expressions properly', () => {
  const code = `
    stringify(parse("x => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses arrow function assignments properly', () => {
  const code = `
    stringify(parse("const y = x => x + 1;"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses function calls', () => {
  const code = `
    stringify(parse("f(x); thrice(thrice)(plus_one)(0);"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Parses fibonacci', () => {
  const code = `
    stringify(parse("function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); } fib(4);"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

// TODO: Support objects in chapter 100, then re-enable these tests
// test('Parses object notation', () => {
//   const code = `
//     stringify(parse("let x = {a: 5, b: 10, 'key': value};"), undefined, 2);
//   `
//   const context = mockContext(4)
//   const promise = runInContext(code, context, { scheduler: 'preemptive' })
//   return promise.then(obj => {
//     expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
//     expect(obj).toMatchSnapshot()
//     expect(obj.status).toBe('finished')
//   })
// })

// test('Parses property access', () => {
//   const code = `
//     stringify(parse("a[b]; a.b; a[5]; a['b'];"), undefined, 2);
//   `
//   const context = mockContext(4)
//   const promise = runInContext(code, context, { scheduler: 'preemptive' })
//   return promise.then(obj => {
//     expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
//     expect(obj).toMatchSnapshot()
//     expect(obj.status).toBe('finished')
//   })
// })

// test('Parses property assignment', () => {
//   const code = `
//     stringify(parse("a[b] = 5; a.b = value; a[5] = 'value'; a['b'] = 42;"), undefined, 2);
//   `
//   const context = mockContext(4)
//   const promise = runInContext(code, context, { scheduler: 'preemptive' })
//   return promise.then(obj => {
//     expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
//     expect(obj).toMatchSnapshot()
//     expect(obj.status).toBe('finished')
//   })
// })

test('Parses loops', () => {
  const code = oneLine`
    stringify(parse(
      "while (true) {
        continue;
        break;
      }
      for (let i = 0; i < 1; i = i + 1) {
        continue;
        break;
      }
      for (i = 0; i < 1; i = i + 1) {
        continue;
        break;
      }"), undefined, 2);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(JSON.stringify(context.errors, undefined, 2)).toBe('[]')
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})
