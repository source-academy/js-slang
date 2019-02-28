import { parseError, runInContext } from '../index'
import { mockContext } from '../mocks/context'
import {
  expectParsedError,
  expectParsedErrorNoSnapshot,
  expectResult,
  stripIndent
} from '../utils/testing'

test('Undefined variable error is thrown', () => {
  return expectParsedError(stripIndent`
    im_undefined;
  `).toMatchInlineSnapshot(`"Line 1: Name im_undefined not declared"`)
})

test('Error when assigning to builtin', () => {
  return expectParsedError(
    stripIndent`
    map = 5;
  `,
    { chapter: 3 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot assign new value to constant map"`)
})

test('Error when assigning to builtin', () => {
  return expectParsedError(
    stripIndent`
    undefined = 5;
  `,
    { chapter: 3 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot assign new value to constant undefined"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when assigning to property on undefined', () => {
  return expectParsedError(
    stripIndent`
    undefined.prop = 123;
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot assign property prop of undefined"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when assigning to property on variable with value undefined', () => {
  return expectParsedError(
    stripIndent`
    const u = undefined;
    u.prop = 123;
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 2: Cannot assign property prop of undefined"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when deeply assigning to property on variable with value undefined', () => {
  return expectParsedError(
    stripIndent`
    const u = undefined;
    u.prop.prop = 123;
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 2: Cannot read property prop of undefined"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when accessing property on undefined', () => {
  return expectParsedError(
    stripIndent`
    undefined.prop;
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot read property prop of undefined"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when deeply accessing property on undefined', () => {
  return expectParsedError(
    stripIndent`
    undefined.prop.prop;
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot read property prop of undefined"`)
})

test('Nice errors when errors occur inside builtins', () => {
  return expectParsedError(
    stripIndent`
    parse_int("10");
  `,
    { chapter: 4 }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: parse_int expects two arguments a string s, and a positive integer i between 2 and 36, inclusive."`
  )
})

test('Nice errors when errors occur inside builtins', () => {
  return expectParsedError(
    stripIndent`
    parse("'");
  `,
    { chapter: 4 }
  ).toMatchInlineSnapshot(`"Line 1: ParseError: SyntaxError: Unterminated string constant (1:0)"`)
})

test("Builtins don't create additional errors when it's not their fault", () => {
  return expectParsedError(
    stripIndent`
    function f(x) {
      return a;
    }
    map(f, list(1, 2));
  `,
    { chapter: 4 }
  ).toMatchInlineSnapshot(`"Line 2: Name a not declared"`)
})

test('Infinite recursion with a block bodied function', () => {
  return expectParsedErrorNoSnapshot(
    stripIndent`
    function i(n) {
      return n === 0 ? 0 : 1 + i(n-1);
    }
    i(1000);
  `,
    { chapter: 4 }
  ).toEqual(expect.stringMatching(/Maximum call stack size exceeded\n *(i\(\d*\)[^i]{2,4}){3}/))
}, 10000)

test('Infinite recursion with function calls in argument', () => {
  return expectParsedErrorNoSnapshot(
    stripIndent`
    function i(n, redundant) {
      return n === 0 ? 0 : 1 + i(n-1, r());
    }
    function r() {
      return 1;
    }
    i(1000, 1);
  `,
    { chapter: 4 }
  ).toEqual(
    expect.stringMatching(/Maximum call stack size exceeded\n *(i\(\d*, 1\)[^i]{2,4}){2}[ir]/)
  )
}, 10000)

test('Infinite recursion of mutually recursive functions', () => {
  return expectParsedErrorNoSnapshot(
    stripIndent`
    function f(n) {
      return n === 0 ? 0 : 1 + g(n - 1);
    }
    function g(n) {
      return 1 + f(n);
    }
    f(1000);
  `,
    { chapter: 4 }
  ).toEqual(
    expect.stringMatching(
      /Maximum call stack size exceeded\n([^f]*f[^g]*g[^f]*f|[^g]*g[^f]*f[^g]*g)/
    )
  )
})

// should not be different when error passing is fixed
test('Error when calling non function value undefined', () => {
  return expectParsedError(
    stripIndent`
    (() => undefined())();
  `,
    { native: true }
  ).toMatchInlineSnapshot(`
"native:\\"Line -1: TypeError: Calling non-function value undefined\\"
interpreted:\\"Line 1: Calling non-function value undefined\\""
`)
})

test('Error when calling non function value null', () => {
  return expectParsedError(stripIndent`
    null();
  `).toMatchInlineSnapshot(`"Line 1: null literals are not allowed"`)
})

test('Error when calling non function value true', () => {
  return expectParsedError(stripIndent`
    true();
  `).toMatchInlineSnapshot(`"Line 1: Calling non-function value true"`)
})

test('Error when calling non function value 0', () => {
  return expectParsedError(stripIndent`
    0();
  `).toMatchInlineSnapshot(`"Line 1: Calling non-function value 0"`)
})

test('Error when calling non function value "string"', () => {
  return expectParsedError(stripIndent`
    'string'();
  `).toMatchInlineSnapshot(`"Line 1: Calling non-function value \\"string\\""`)
})

test('Error when calling non function value array', () => {
  return expectParsedError(
    stripIndent`
    [1]();
  `,
    { chapter: 3 }
  ).toMatchInlineSnapshot(`"Line 1: Calling non-function value [1]"`)
})

test('Error when calling non function value object', () => {
  return expectParsedError(
    stripIndent`
    ({a: 1})();
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Calling non-function value {\\"a\\": 1}"`)
})

test('Error when calling function with too few arguments', () => {
  return expectParsedError(stripIndent`
    function f(x) {
      return x;
    }
    f();
  `).toMatchInlineSnapshot(`"Line 4: Expected 1 arguments, but got 0"`)
})

test('Error when calling function with too many arguments', () => {
  return expectParsedError(stripIndent`
    function f(x) {
      return x;
    }
    f(1, 2);
  `).toMatchInlineSnapshot(`"Line 4: Expected 1 arguments, but got 2"`)
})

test('Error when calling arrow function with too few arguments', () => {
  return expectParsedError(stripIndent`
    const f = x => x;
    f();
  `).toMatchInlineSnapshot(`"Line 2: Expected 1 arguments, but got 0"`)
})

test('Error when calling arrow function with too many arguments', () => {
  return expectParsedError(stripIndent`
    const f = x => x;
    f(1, 2);
  `).toMatchInlineSnapshot(`"Line 2: Expected 1 arguments, but got 2"`)
})

test('Error when redeclaring constant', () => {
  return expectParsedError(
    stripIndent`
    const f = x => x;
    const f = x => x;
  `,
    { chapter: 3 }
  ).toMatchInlineSnapshot(`"Line 2: SyntaxError: Identifier 'f' has already been declared (2:6)"`)
})

test('Error when redeclaring constant as variable', () => {
  return expectParsedError(
    stripIndent`
    const f = x => x;
    let f = x => x;
  `,
    { chapter: 3 }
  ).toMatchInlineSnapshot(`"Line 2: SyntaxError: Identifier 'f' has already been declared (2:4)"`)
})

test('Error when redeclaring variable as constant', () => {
  return expectParsedError(
    stripIndent`
    let f = x => x;
    const f = x => x;
  `,
    { chapter: 3 }
  ).toMatchInlineSnapshot(`"Line 2: SyntaxError: Identifier 'f' has already been declared (2:6)"`)
})

test('Error when redeclaring variable', () => {
  return expectParsedError(
    stripIndent`
    let f = x => x;
    let f = x => x;
  `,
    { chapter: 3 }
  ).toMatchInlineSnapshot(`"Line 2: SyntaxError: Identifier 'f' has already been declared (2:4)"`)
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

test('Runtime error when redeclaring constant as function', () => {
  const code1 = `
    const f = x => x;
  `
  const code2 = `
    function f(x) { return x; }
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

test('Runtime error when redeclaring variable as function', () => {
  const code1 = `
    let f = x => x;
  `
  const code2 = `
    function f(x) { return x; }
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

test('Runtime error when redeclaring function as constant', () => {
  const code1 = `
    function f(x) { return x; }
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

test('Runtime error when redeclaring function as variable', () => {
  const code1 = `
    function f(x) { return x; }
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

test('Runtime error when redeclaring function', () => {
  const code1 = `
    function f(x) { return x; }
  `
  const code2 = `
    function f(x) { return x; }
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

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when accessing property of null', () => {
  return expectParsedError(
    stripIndent`
    null["prop"];
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot read property prop of null"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when accessing property of undefined', () => {
  return expectParsedError(
    stripIndent`
    undefined["prop"];
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot read property prop of undefined"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when accessing inherited property of builtin', () => {
  return expectParsedError(
    stripIndent`
    pair["constructor"];
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`
"Line 1: Cannot read inherited property constructor of function pair(left, right) {
	[implementation hidden]
}"
`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when accessing inherited property of function', () => {
  return expectParsedError(
    stripIndent`
    function f() {}
    f["constructor"];
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 2: Cannot read inherited property constructor of function f() {}"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when accessing inherited property of arrow function', () => {
  return expectParsedError(
    stripIndent`
    (() => 1)["constructor"];
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot read inherited property constructor of () => 1"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when accessing inherited property of array', () => {
  return expectParsedError(
    stripIndent`
    [].push;
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot read inherited property push of []"`)
})

test('Error when accessing inherited property of object', () => {
  return expectParsedError(
    stripIndent`
    ({}).valueOf;
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot read inherited property valueOf of {}"`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when accessing inherited property of string', () => {
  return expectParsedError(
    stripIndent`
    'hi'.includes;
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot read inherited property includes of \\"hi\\""`)
})

// NOTE: Obsoleted due to strict types on member access
test.skip('Error when accessing inherited property of number', () => {
  return expectParsedError(
    stripIndent`
    (1).toPrecision;
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Cannot read inherited property toPrecision of 1"`)
})

test('Access local property', () => {
  return expectResult(
    stripIndent`
    ({a: 0})["a"];
  `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`0`)
})

test('Type error when accessing property of null', () => {
  return expectParsedError(
    stripIndent`
    null.prop;
    `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Expected object or array, got null."`)
})

test('Type error when accessing property of string', () => {
  return expectParsedError(
    stripIndent`
    'hi'.length;
    `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Expected object or array, got string."`)
})

test('Type error when accessing property of function', () => {
  return expectParsedError(
    stripIndent`
    function f() {
      return 1;
    }
    f.prototype;
    `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 4: Expected object or array, got function."`)
})

test('Type error when assigning property of string', () => {
  return expectParsedError(
    stripIndent`
    'hi'.prop = 5;
    `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 1: Expected object or array, got string."`)
})

test('Type error when assigning property of function', () => {
  return expectParsedError(
    stripIndent`
    function f() {
      return 1;
    }
    f.prop = 5;
    `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`"Line 4: Expected object or array, got function."`)
})

test('Type error with non boolean in if statement, error line at if statement, not at 1', () => {
  return expectParsedError(
    stripIndent`
    if (
    1
    ) {
      2;
    } else {}
    `,
    { chapter: 1 }
  ).toMatchInlineSnapshot(`"Line 1: Expected boolean as condition, got number."`)
})

test('Type error with <number> * <nonnumber>, error line at <number>, not <nonnumber>', () => {
  return expectParsedError(
    stripIndent`
    12
    *
    'string';
    `,
    { chapter: 1 }
  ).toMatchInlineSnapshot(`"Line 1: Expected number on right hand side of operation, got string."`)
})
