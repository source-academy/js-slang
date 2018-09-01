import { stripIndent } from 'common-tags'
import { mockContext } from '../mocks/context'
import { parseError, runInContext } from '../index'
import { Finished } from '../types'

test('Empty code returns undefined', () => {
  const code = ''
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(undefined)
  })
})

test('Single string self-evaluates to itself', () => {
  const code = "'42';"
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('42')
  })
})

test('Single number self-evaluates to itself', () => {
  const code = '42;'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(42)
  })
})

test('Single boolean self-evaluates to itself', () => {
  const code = 'true;'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('Arrow function definition returns itself', () => {
  const code = '() => 42;'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('Factorial arrow function', () => {
  const code = stripIndent`
    const fac = (i) => i === 1 ? 1 : i * fac(i-1);
    fac(5);
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(120)
  })
})

test('parseError for missing semicolon', () => {
  const code = '42'
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})

test(
  'Simple inifinite recursion represents CallExpression well',
  () => {
    const code = '(x => x(x))(x => x(x));'
    const context = mockContext()
    const promise = runInContext(code, context, { scheduler: 'preemptive' })
    return promise.then(obj => {
      const errors = parseError(context.errors)
      expect(errors).toMatchSnapshot()
    })
  },
  30000
)

test(
  'Inifinite recursion with list args represents CallExpression well',
  () => {
    const code = `
    const f = xs => f(xs);
    f(list(1, 2 ));
  `
    const context = mockContext(2)
    const promise = runInContext(code, context, { scheduler: 'preemptive' })
    return promise.then(obj => {
      const errors = parseError(context.errors)
      expect(errors).toMatchSnapshot()
    })
  },
  30000
)

test(
  'Inifinite recursion with different args represents CallExpression well',
  () => {
    const code = `
    const f = i => f(i+1);
    f(0);
  `
    const context = mockContext()
    const promise = runInContext(code, context, { scheduler: 'preemptive' })
    return promise.then(obj => {
      const errors = parseError(context.errors)
      expect(errors).toEqual(
        expect.stringMatching(/^Line 2: Infinite recursion\n\ *(f\(\d*\)[^f]{2,4}){3}/)
      )
    })
  },
  30000
)

// This is bad practice. Don't do this!
test('const uses block scoping instead of function scoping', () => {
  const code = `
    function test(){
      const x = true;
      if(true) {
          const x = false;
      } else {
          const x = false;
      }
      return x;
    }
    test();
  `;
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test(
  'Hoisting of function declarations',
  () => {
    const code = `
      const v = f();
      function f() {
        return 1;
      }
      v;
    `
    const context = mockContext()
    const promise = runInContext(code, context, { scheduler: 'preemptive' })
    return promise.then(obj => {
      expect(obj).toMatchSnapshot()
      expect(obj.status).toBe('finished')
      expect((obj as Finished).value).toBe(1)
    })
  },
  30000
)
test(
  'In a block, every going-to-be-defined variable in the current scope that shadows another variable with the same name in an outer scope cannot be accessed until it has been defined in the current scope.',
  () => {
    const code = `
      
      const a = 1;
      {
        a + a;
        const a = 10;
      }
    `
    const context = mockContext()
    const promise = runInContext(code, context, { scheduler: 'preemptive' })
    return promise.then(obj => {
      const errors = parseError(context.errors)
      expect(errors).toEqual(
        expect.stringMatching(/^Line 5: Undefined Variable a/)
      )
    })
  },
  30000
)
