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

test('list now uses Source toString instead of native when +ed with another string', () => {
  const code = '"123" + list(4, 5, 6);'
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe("123[4, [5, [6, []]]]")
  })
})

test('__SOURCE__ functions now uses Source toString instead of native when +ed with another string', () => {
  const code = ' pair + "123";'
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
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

test("Cannot overwrite consts even when assignment is allowed", () => {
  const code = `
  function test(){
    const constant = 3;
    constant = 4;
    return constant;
  }
  test();
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe("error");
    const errors = parseError(context.errors)
    expect(errors).toMatchSnapshot()
  });
});


test("Can overwrite lets when assignment is allowed", () => {
  const code = `
  function test(){
    let variable = false;
    variable = true;
    return variable;
  }
  test();
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(true)
  });
});

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

test("Cannot redeclare variable", () => {
  const code = `
  function test(){
    let variable = false;
    let variable = true;
    return variable;
  }
  test();
  `;
  const context = mockContext(3);
  const promise = runInContext(code, context, { scheduler: "preemptive" });
  return promise.then(obj => {
    const errors = parseError(context.errors)
    expect(obj.status).toBe('error')
    expect(errors).toMatchSnapshot()
  });
});