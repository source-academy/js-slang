import { parseError, runInContext } from '../index'
import { mockContext } from '../mocks/context'

test('Undefined variable error is thrown', () => {
  const code = `
    im_undefined;
  `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Name im_undefined not declared')
  })
})

test('Error when assigning to builtin', () => {
  const code = `
    map = 5;
   `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot assign new value to constant map')
  })
})

test('Error when assigning to builtin', () => {
  const code = `
    undefined = 5;
   `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot assign new value to constant undefined')
  })
})

test('Error when assigning to property on undefined', () => {
  const code = `
    undefined.prop = 123;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot assign property prop of undefined')
  })
})

test('Error when assigning to property on variable with value undefined', () => {
  const code = `
    const u = undefined;
    u.prop = 123;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 3: Cannot assign property prop of undefined')
  })
})

test('Error when deeply assigning to property on variable with value undefined', () => {
  const code = `
    const u = undefined;
    u.prop.prop = 123;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 3: Cannot read property prop of undefined')
  })
})

test('Error when accessing property on undefined', () => {
  const code = `
    undefined.prop;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot read property prop of undefined')
  })
})

test('Error when deeply accessing property on undefined', () => {
  const code = `
    undefined.prop.prop;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 2: Cannot read property prop of undefined')
  })
})

test('In case a function ever returns null, should throw an error as well', () => {
  const code = `
    const myNull = pair.constructor("return null;")();
    myNull.prop;
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 3: Cannot read property prop of null')
  })
})

test('Nice errors when errors occur inside builtins', () => {
  const code = `
    parse_int("10");
   `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe(
      'Line 2: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive.'
    )
  })
})

test('Nice errors when errors occur inside builtins', () => {
  const code = `
    parse("'");
   `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test("Builtins don't create additional errors when it's not their fault", () => {
  const code = `
    function f(x) {
      return a;
    }
    map(f, list(1, 2));
   `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(context.errors).toMatchSnapshot()
    expect(parseError(context.errors)).toBe('Line 3: Name a not declared')
  })
})

test('Infinite recursion with a block bodied function', () => {
  const code = `
    function i(n) {
      return n === 0 ? 0 : 1 + i(n-1);
    }
    i(1000);
   `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toEqual(
      expect.stringMatching(/Infinite recursion\n *(i\(\d*\)[^i]{2,4}){3}/)
    )
  })
}, 10000)

test('Infinite recursion with function calls in argument', () => {
  const code = `
    function i(n, redundant) {
      return n === 0 ? 0 : 1 + i(n-1, r());
    }
    function r() {
      return 1;
    }
    i(1000, 1);
   `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toEqual(
      expect.stringMatching(/Infinite recursion\n *(i\(\d*, 1\)[^i]{2,4}){2}[ir]/)
    )
  })
}, 10000)

test('Infinite recursion of mutually recursive functions', () => {
  const code = `
    function f(n) {
      return n === 0 ? 0 : 1 + g(n - 1);
    }
    function g(n) {
      return 1 + f(n);
    }
    f(1000);
   `
  const context = mockContext(4)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toEqual(
      expect.stringMatching(/Infinite recursion\n([^f]*f[^g]*g[^f]*f|[^g]*g[^f]*f[^g]*g)/)
    )
  })
})

test('Error when calling non function value undefined', () => {
  const code = `
    undefined();
   `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling non function value null', () => {
  const code = `
    null();
   `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling non function value true', () => {
  const code = `
    true();
   `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling non function value 0', () => {
  const code = `
    0();
   `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling non function value "string"', () => {
  const code = `
    'string'();
   `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling non function value array', () => {
  const code = `
    [1]();
   `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling non function value object', () => {
  const code = `
    ({a: 1})();
   `
  const context = mockContext(100)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling function with too few arguments', () => {
  const code = `
    function f(x) {
      return x;
    }
    f();
   `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling function with too many arguments', () => {
  const code = `
    function f(x) {
      return x;
    }
    f(1, 2);
   `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling arrow function with too few arguments', () => {
  const code = `
    const f = x => x;
    f();
   `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when calling arrow function with too many arguments', () => {
  const code = `
    const f = x => x;
    f(1, 2);
   `
  const context = mockContext()
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when redeclaring constant', () => {
  const code = `
    const f = x => x;
    const f = x => x;
   `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when redeclaring constant as variable', () => {
  const code = `
    const f = x => x;
    let f = x => x;
   `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when redeclaring variable as constant', () => {
  const code = `
    let f = x => x;
    const f = x => x;
   `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Error when redeclaring variable', () => {
  const code = `
    let f = x => x;
    let f = x => x;
   `
  const context = mockContext(3)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(obj.status).toBe('error')
    expect(parseError(context.errors)).toMatchSnapshot()
  })
})

test('Runtime error when redeclaring constant', () => {
  const code1 = `
    const f = x => x;
  `
  const code2 = `
    const f = x => x;
   `
  const context = mockContext(3)
  return runInContext(code1, context, { scheduler: 'preemptive' }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('finished')
    expect(parseError(context.errors)).toMatchSnapshot()
    return runInContext(code2, context, { scheduler: 'preemptive' }).then(obj2 => {
      expect(obj2).toMatchSnapshot()
      expect(obj2.status).toBe('error')
      expect(parseError(context.errors)).toMatchSnapshot()
    })
  })
})

test('Runtime error when redeclaring constant as variable', () => {
  const code1 = `
    const f = x => x;
  `
  const code2 = `
    let f = x => x;
   `
  const context = mockContext(3)
  return runInContext(code1, context, { scheduler: 'preemptive' }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('finished')
    expect(parseError(context.errors)).toMatchSnapshot()
    return runInContext(code2, context, { scheduler: 'preemptive' }).then(obj2 => {
      expect(obj2).toMatchSnapshot()
      expect(obj2.status).toBe('error')
      expect(parseError(context.errors)).toMatchSnapshot()
    })
  })
})

test('Runtime error when redeclaring variable as constant', () => {
  const code1 = `
    let f = x => x;
  `
  const code2 = `
    const f = x => x;
   `
  const context = mockContext(3)
  return runInContext(code1, context, { scheduler: 'preemptive' }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(parseError(context.errors)).toMatchSnapshot()
    expect(obj1.status).toBe('finished')
    return runInContext(code2, context, { scheduler: 'preemptive' }).then(obj2 => {
      expect(obj2).toMatchSnapshot()
      expect(parseError(context.errors)).toMatchSnapshot()
      expect(obj2.status).toBe('error')
    })
  })
})

test('Runtime error when redeclaring variable', () => {
  const code1 = `
    let f = x => x;
  `
  const code2 = `
    let f = x => x;
   `
  const context = mockContext(3)
  return runInContext(code1, context, { scheduler: 'preemptive' }).then(obj1 => {
    expect(obj1).toMatchSnapshot()
    expect(obj1.status).toBe('finished')
    expect(parseError(context.errors)).toMatchSnapshot()
    return runInContext(code2, context, { scheduler: 'preemptive' }).then(obj2 => {
      expect(obj2).toMatchSnapshot()
      expect(obj2.status).toBe('error')
      expect(parseError(context.errors)).toMatchSnapshot()
    })
  })
})
