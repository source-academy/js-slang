import { stripIndent } from 'common-tags'
import { mockContext } from '../mocks/context'
import { parseError, runInContext } from '../index'
import { Finished } from '../types'
import { defineSymbol } from '../createContext'

test('Empty code returns undefined', () => {
  const code = ''
  const context = mockContext()
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(undefined)
  })
})

test('Single string self-evaluates to itself', () => {
  const code = '\'42\';'
  const context = mockContext()
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('42')
  })
})

test('Multi-dimensional arrays display properly', () => {
  const code = `
    function a() {} 
    ""+[1, a, 3, [() => 1, 5]];
   `
  const context = mockContext(4)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('[1, function a() {}, 3, [() => 1, 5]]')
  })
})

test('Single number self-evaluates to itself', () => {
  const code = '42;'
  const context = mockContext()
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(42)
  })
})

test('Single boolean self-evaluates to itself', () => {
  const code = 'true;'
  const context = mockContext()
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('Arrow function definition returns itself', () => {
  const code = '() => 42;'
  const context = mockContext()
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toMatchSnapshot()
  })
})

test('list now uses Source toString instead of native when +ed with another string', () => {
  const code = '"123" + list(4, 5, 6);'
  const context = mockContext(2)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('123[4, [5, [6, []]]]')
  })
})

test('__SOURCE__ functions now uses Source toString instead of native when +ed with another string', () => {
  const code = ' pair + "123";'
  const context = mockContext(2)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Factorial arrow function', () => {
  const code = stripIndent`
    const fac = (i) => i === 1 ? 1 : i * fac(i-1);
    fac(5);
  `
  const context = mockContext(4)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(120)
  })
})

test('parseError for missing semicolon', () => {
  const code = '42'
  const context = mockContext()
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
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
    const promise = runInContext(code, context, {scheduler: 'preemptive'})
    return promise.then(obj => {
      const errors = parseError(context.errors)
      expect(errors).toMatchSnapshot()
    })
  },
  30000
)

test('Cannot overwrite consts even when assignment is allowed', () => {
  const code = `
  function test(){
    const constant = 3;
    constant = 4;
    return constant;
  }
  test();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  })
})


test('Can overwrite lets when assignment is allowed', () => {
  const code = `
  function test(){
    let variable = false;
    variable = true;
    return variable;
  }
  test();
  `
  const context = mockContext(3)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test(
  'Inifinite recursion with list args represents CallExpression well',
  () => {
    const code = `
    const f = xs => f(xs);
    f(list(1, 2 ));
  `
    const context = mockContext(2)
    const promise = runInContext(code, context, {scheduler: 'preemptive'})
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
    const promise = runInContext(code, context, {scheduler: 'preemptive'})
    return promise.then(obj => {
      const errors = parseError(context.errors)
      expect(errors).toEqual(
        expect.stringMatching(/^Line 2: Infinite recursion\n\ *(f\(\d*\)[^f]{2,4}){3}/)
      )
    })
  },
  30000
)

test('Functions passed into non-source functions remain equal', () => {
  const code = `
  function t(x, y, z) {
    return x + y + z;
  }
  identity(t) === t && t(1, 2, 3) === 6;
  `
  const context = mockContext(4)
  defineSymbol(context, 'identity', (x: any) => x)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  })
})

test('Metacircular Interpreter parses Arrow Function Expressions properly', () => {
  const code = 'stringify(parse("x => x + 1;"));'
  const context = mockContext(4)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Metacircular Interpreter parses Arrow Function Assignments properly', () => {
  const code = 'stringify(parse("const y = x => x + 1;"));'
  const context = mockContext(4)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
  })
})

test('Multi-dimensional arrays display properly', () => {
  const code = `
    function a() {} 
    ""+[1, a, 3, [() => 1, 5]];
   `
  const context = mockContext(4)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('[1, function a() {}, 3, [() => 1, 5]]')
  })
})

test('Simple object assignment and retrieval', () => {
  // const code = `
  //   const o = {};
  //   o.a = 1;
  //   o.a;
  //  `;
  const code = `
    const o = {};
    o['a'] = 1;
    o['a'];
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(1)
  })
})

test('Deep object assignment and retrieval', () => {
  // const code = `
  //   const o = {};
  //   o.a = {};
  //   o.a.b = {};
  //   o.a.b.c = "string";
  //   o.a.b.c;
  //  `;
  const code = `
    const o = {};
    o['a'] = {};
    o['a']['b'] = {};
    o['a']['b']['c'] = "string";
    o['a']['b']['c'];
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, {scheduler: 'preemptive'})
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe('string')
  })
})
