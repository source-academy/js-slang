import { parseError, runInContext } from '../index'
import { mockContext } from '../mocks/context'

test('Cannot leave blank expressions in for loops', () => {
  const code = [
    `
    for(; i < 3; i = i + 1) {
      break;
    }
  `,
    `
    for(let i = 0; ; i = i + 1) {
      break;
    }
  `,
    `
    for(let i = 0; i < 3;) {
      break;
    }
  `,
    `
    for(;;) {
      break;
    }
  `
  ]
  const scheduler = 'preemptive'
  const promises = code.map(c => {
    const context = mockContext(100)
    return runInContext(c, context, { scheduler }).then(obj => ({
      context,
      obj
    }))
  })
  return Promise.all(promises).then(results => {
    results.map(res => {
      const { context, obj } = res
      expect(obj.status).toBe('error')
      const errors = parseError(context.errors)
      expect(errors).toMatchSnapshot()
    })
  })
})

test('Cannot leave while loop predicate blank', () => {
  const code = `
  while() {
    x;
  }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot use update expressions', () => {
  const code = `
  let x = 3;
  x++;
  x;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot have incomplete statements', () => {
  const code = `
  5
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot have if without else', () => {
  const code = `
  if (true) { 5; }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot use assignment expressions', () => {
  const code = `
  let x = 3;
  let y = x = 5;
  x;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot use assignment expressions', () => {
  const code = `
  let x = 3;
  let y = 4;
  x = y = 5;
  x;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot use assignment expressions', () => {
  const code = `
  let y = 4;
  for (let x = y = 1; x < 1; x = x + 1) {
    y;
  }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot use multiple declarations', () => {
  const code = `
  let x = 3, y = 5;
  x;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot use destructuring declarations', () => {
  const code = `
  let x = [1, 2];
  let [a, b] = x;
  a;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no declaration without assignment', () => {
  const code = `
  let x;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot use update statements', () => {
  const code = `
  let x = 3;
  x += 5;
  x;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot use function expressions', () => {
  const code = `
  (function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); })(4);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('Cannot use function expressions', () => {
  const code = `
  (function(x) { return x + 1; })(4);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('if needs braces', () => {
  const code = `
    if (true)
      true;
    else
      false;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('for needs braces', () => {
  const code = `
    for (let i = 0; i < 1; i = i + 1)
      i;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('while needs braces', () => {
  const code = `
    let i = 0;
    while (i < 1)
      i = i + 1;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('No empty statements', () => {
  const code = `
    ;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('No array expressions in chapter 2', () => {
  const code = `
    [];
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('No trailing commas in arrays', () => {
  const code = `
    [1,];
  `
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('No trailing commas in objects', () => {
  const code = `
    {
      a: 1,
      b: 2,
    };
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('No rest pattern', () => {
  const code = `
    function f(...rest) {
      return rest;
    }
    f(1, 2);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('No spread operator', () => {
  const code = `
    function f(x, y) {
      return x + y;
    }
    f(...[1, 2]);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no try statements', () => {
  const code = `
    function f(x, y) {
      return x + y;
    }
    try {
      f(...[1, 2]);
    } catch (e) {
      display(e);
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no for of loops', () => {
  const code = `
    for (let i of list()) {
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no for in loops', () => {
  const code = `
    for (let i in { a: 1, b: 2 }) {
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no debugger statement', () => {
  const code = `
    debugger;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no generator functions', () => {
  const code = `
    function* gen() {
      yield 2;
      return 1;
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no classes', () => {
  const code = `
    class Box {
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no super', () => {
  const code = `
    class BoxError extends Error {
      constructor() {
        super(1);
      }
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
    expect(errors).toEqual(expect.stringContaining('Supers are not allowed'))
  })
})

test('no export function', () => {
  const code = `
    export function f(x) {
      return x;
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no export constant', () => {
  const code = `
    export const x = 1;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no export default', () => {
  const code = `
    const x = 1;
    export default x;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no import', () => {
  const code = `
    import { stripIndent } from 'common-tags';
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no sequence expression', () => {
  const code = `
    (1, 2);
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no interface', () => {
  const code = `
    interface Box {
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no template literals', () => {
  const code = '`hi`'
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no regexp', () => {
  const code = '/pattern/'
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no this, no new', () => {
  const code = `
    function Box() {
      this[0] = 5;
    }
    const box = new Box();
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no unspecified operators', () => {
  const code = `
    1 << 10;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no unspecified unary operators', () => {
  const code = `
    let x = 5;
    typeof x;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no implicit undefined return', () => {
  const code = `
    function f() {
      return;
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no repeated params', () => {
  const code = `
    function f(x, x) {
      return x;
    }
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no declaring reserved keywords', () => {
  const code = `
    let yield = 5;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test('no assigning to reserved keywords', () => {
  const code = `
    package = 5;
  `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})
