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


// This is bad practice. Don't do this!
test('let uses block scoping instead of function scoping', () => {
  const code = `
    function test(){
      let x = true;
      if(true) {
          let x = false;
      } else {
          let x = false;
      }
      return x;
    }
    test();
  `;
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})


// This is bad practice. Don't do this!
test('for loops use block scoping instead of function scoping', () => {
  const code = `
    function test(){
      let x = true;
      for (let x = 1; x > 0; x--) {
      }
      return x;
    }
    test();
  `;
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})

// This is bad practice. Don't do this!
test('while loops use block scoping instead of function scoping', () => {
  const code = `
    function test(){
      let x = true;
      while (true) {
        let x = false;
        break;
      }
      return x;
    }
    test();
  `;
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect(obj).toMatchSnapshot()
    expect((obj as Finished).value).toBe(true)
  })
})