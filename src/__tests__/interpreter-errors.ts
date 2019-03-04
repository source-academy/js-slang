/* tslint:disable:max-line-length */
import { parseError, runInContext } from '../index'
import { mockContext } from '../mocks/context'
import {
  expectDifferentParsedErrors,
  expectParsedError,
  expectParsedErrorNoSnapshot,
  expectResult,
  stripIndent
} from '../utils/testing'

const undefinedVariable = stripIndent`
im_undefined;
`
const undefinedVariableVerbose = stripIndent`
"enable verbose";
im_undefined;
`

test('Undefined variable error is thrown', () => {
  return expectParsedError(undefinedVariable).toMatchInlineSnapshot(
    `"Line 1: Name im_undefined not declared."`
  )
})

test('Undefined variable error is thrown - verbose', () => {
  return expectParsedError(undefinedVariableVerbose).toMatchInlineSnapshot(`
"Line 2, Column 0: Name im_undefined not declared.
Before you can read the value of im_undefined, you need to declare it as a variable or a constant. You can do this \
using the let or const keywords.
"
`)
})

test('Undefined variable error message differs from verbose version', () => {
  return expectDifferentParsedErrors(undefinedVariable, undefinedVariableVerbose).toBe(undefined)
})

const assignToBuiltin = stripIndent`
map = 5;
`

const assignToBuiltinVerbose = stripIndent`
  "enable verbose";
  map = 5;
`

test('Error when assigning to builtin', () => {
  return expectParsedError(assignToBuiltin, { chapter: 3 }).toMatchInlineSnapshot(
    `"Line 1: Cannot assign new value to constant map."`
  )
})

test('Error when assigning to builtin - verbose', () => {
  return expectParsedError(assignToBuiltinVerbose, { chapter: 3 }).toMatchInlineSnapshot(`
"Line 2, Column 0: Cannot assign new value to constant map.
As map was declared as a constant, its value cannot be changed. You will have to declare a new variable.
"
`)
})

test('Assigning to builtin error message differs from verbose version', () => {
  return expectDifferentParsedErrors(assignToBuiltin, assignToBuiltinVerbose).toBe(undefined)
})

const assignToBuiltin1 = stripIndent`
undefined = 5;
`

const assignToBuiltinVerbose1 = stripIndent`
  "enable verbose";
  undefined = 5;
`

test('Error when assigning to builtin', () => {
  return expectParsedError(assignToBuiltin1, { chapter: 3 }).toMatchInlineSnapshot(
    `"Line 1: Cannot assign new value to constant undefined."`
  )
})

test('Error when assigning to builtin - verbose', () => {
  return expectParsedError(assignToBuiltinVerbose1, { chapter: 3 }).toMatchInlineSnapshot(`
"Line 2, Column 0: Cannot assign new value to constant undefined.
As undefined was declared as a constant, its value cannot be changed. You will have to declare a new variable.
"
`)
})

test('Assigning to builtin error message differs from verbose version', () => {
  return expectDifferentParsedErrors(assignToBuiltin1, assignToBuiltinVerbose1).toBe(undefined)
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
  ).toMatchInlineSnapshot(`"Line 2: Name a not declared."`)
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

const callingNonFunctionValueUndefined = stripIndent`
undefined();
`

const callingNonFunctionValueUndefinedVerbose = stripIndent`
"enable verbose";
  undefined();
`
// should not be different when error passing is fixed
test('Error when calling non function value undefined', () => {
  return expectParsedError(callingNonFunctionValueUndefined, {
    native: true
  }).toMatchInlineSnapshot(`"Line 1: Calling non-function value undefined."`)
})

test('Error when calling non function value undefined - verbose', () => {
  return expectParsedError(callingNonFunctionValueUndefinedVerbose).toMatchInlineSnapshot(`
"Line 2, Column 2: Calling non-function value undefined.
Because undefined is not a function, you cannot run undefined().
"
`)
})

test('Calling non function value undefined error message differs from verbose version', () => {
  return expectDifferentParsedErrors(
    callingNonFunctionValueUndefined,
    callingNonFunctionValueUndefinedVerbose
  ).toBe(undefined)
})

const callingNonFunctionValueUndefinedArgs = stripIndent`
undefined(1, true);
`

const callingNonFunctionValueUndefinedArgsVerbose = stripIndent`
"enable verbose";
  undefined(1, true);
`
// should not be different when error passing is fixed
test('Error when calling non function value undefined with arguments', () => {
  return expectParsedError(callingNonFunctionValueUndefinedArgs, {
    native: false
  }).toMatchInlineSnapshot(`"Line 1: Calling non-function value undefined."`)
})

test('Error when calling non function value undefined with arguments - verbose', () => {
  return expectParsedError(callingNonFunctionValueUndefinedArgsVerbose).toMatchInlineSnapshot(`
"Line 2, Column 2: Calling non-function value undefined.
Because undefined is not a function, you cannot run undefined(1, true).
"
`)
})

test('Calling non function value undefined with arguments error message differs from verbose version', () => {
  return expectDifferentParsedErrors(
    callingNonFunctionValueUndefinedArgs,
    callingNonFunctionValueUndefinedArgsVerbose
  ).toBe(undefined)
})

const callingNonFunctionValueNull = stripIndent`
null();
`

const callingNonFunctionValueNullVerbose = stripIndent`
"enable verbose";
  null();
`

test('Error when calling non function value null', () => {
  return expectParsedError(callingNonFunctionValueNull).toMatchInlineSnapshot(`
"Line 1, Column 0: null literals are not allowed.
They're not part of the Source §1 specs.
"
`)
})

test('Error when calling non function value null - verbose', () => {
  return expectParsedError(callingNonFunctionValueNullVerbose).toMatchInlineSnapshot(`
"Line 2, Column 2: null literals are not allowed.
They're not part of the Source §1 specs.
"
`)
})

test('Calling non function value null error message differs from verbose version', () => {
  return expectDifferentParsedErrors(
    callingNonFunctionValueNull,
    callingNonFunctionValueNullVerbose
  ).toBe(undefined)
})

const callingNonFunctionValueTrue = stripIndent`
true();
`
const callingNonFunctionValueTrueVerbose = stripIndent`
"enable verbose";
  true();
`

test('Error when calling non function value true', () => {
  return expectParsedError(callingNonFunctionValueTrue, { native: true }).toMatchInlineSnapshot(
    `"Line 1: Calling non-function value true."`
  )
})

test('Error when calling non function value true - verbose', () => {
  return expectParsedError(callingNonFunctionValueTrueVerbose).toMatchInlineSnapshot(`
"Line 2, Column 2: Calling non-function value true.
Because true is not a function, you cannot run true().
"
`)
})

test('Calling non function value true error message differs from verbose version', () => {
  return expectDifferentParsedErrors(
    callingNonFunctionValueTrue,
    callingNonFunctionValueTrueVerbose
  ).toBe(undefined)
})

const callingNonFunctionValue0 = stripIndent`
0();
`

const callingNonFunctionValue0Verbose = stripIndent`
"enable verbose";
  0();
`

test('Error when calling non function value 0', () => {
  return expectParsedError(callingNonFunctionValue0, { native: true }).toMatchInlineSnapshot(
    `"Line 1: Calling non-function value 0."`
  )
})

test('Error when calling non function value 0 - verbose', () => {
  return expectParsedError(callingNonFunctionValue0Verbose).toMatchInlineSnapshot(`
"Line 2, Column 2: Calling non-function value 0.
Because 0 is not a function, you cannot run 0(). If you were planning to perform multiplication by 0, you need to use \
the * operator.
"
`)
})

test('Calling non function value 0 error message differs from verbose version', () => {
  return expectDifferentParsedErrors(
    callingNonFunctionValue0,
    callingNonFunctionValue0Verbose
  ).toBe(undefined)
})

const callingNonFunctionValueString = stripIndent`
'string'();
`

const callingNonFunctionValueStringVerbose = stripIndent`
"enable verbose";
  'string'();
`

test('Error when calling non function value "string"', () => {
  return expectParsedError(callingNonFunctionValueString, { native: true }).toMatchInlineSnapshot(
    `"Line 1: Calling non-function value \\"string\\"."`
  )
})

test('Error when calling non function value "string" - verbose', () => {
  return expectParsedError(callingNonFunctionValueStringVerbose).toMatchInlineSnapshot(`
"Line 2, Column 2: Calling non-function value \\"string\\".
Because \\"string\\" is not a function, you cannot run \\"string\\"().
"
`)
})

test('Calling non function value string error message differs from verbose version', () => {
  return expectDifferentParsedErrors(
    callingNonFunctionValueString,
    callingNonFunctionValueStringVerbose
  ).toBe(undefined)
})

const callingNonFunctionValueArray = stripIndent`
[1]();
`

const callingNonFunctionValueArrayVerbose = stripIndent`
"enable verbose";
[1]();
`

test('Error when calling non function value array', () => {
  return expectParsedError(callingNonFunctionValueArray, {
    chapter: 3,
    native: true
  }).toMatchInlineSnapshot(`"Line 1: Calling non-function value [1]."`)
})

test('Error when calling non function value array - verbose', () => {
  return expectParsedError(callingNonFunctionValueArrayVerbose, { chapter: 3 })
    .toMatchInlineSnapshot(`
"Line 2, Column 0: Calling non-function value [1].
Because [1] is not a function, you cannot run [1]().
"
`)
})

test('Calling non function value array error message differs from verbose version', () => {
  return expectDifferentParsedErrors(
    callingNonFunctionValueArray,
    callingNonFunctionValueArrayVerbose
  ).toBe(undefined)
})

const callingNonFunctionValueObject = stripIndent`
({a: 1})();
`

const callingNonFunctionValueObjectVerbose = stripIndent`
"enable verbose";
({a: 1})();
`

test('Error when calling non function value object', () => {
  return expectParsedError(callingNonFunctionValueObject, { chapter: 100 }).toMatchInlineSnapshot(
    `"Line 1: Calling non-function value {\\"a\\": 1}."`
  )
})

test('Error when calling non function value object - verbose', () => {
  return expectParsedError(callingNonFunctionValueObjectVerbose, { chapter: 100 })
    .toMatchInlineSnapshot(`
"Line 2, Column 0: Calling non-function value {\\"a\\": 1}.
Because {\\"a\\": 1} is not a function, you cannot run {\\"a\\": 1}().
"
`)
})

test('Calling non function value object error message differs from verbose version', () => {
  return expectDifferentParsedErrors(
    callingNonFunctionValueObject,
    callingNonFunctionValueObjectVerbose
  ).toBe(undefined)
})

test('Error when calling non function value object - verbose', () => {
  return expectParsedError(
    stripIndent`
      "enable verbose";
      ({a: 1})();
    `,
    { chapter: 100 }
  ).toMatchInlineSnapshot(`
"Line 2, Column 0: Calling non-function value {\\"a\\": 1}.
Because {\\"a\\": 1} is not a function, you cannot run {\\"a\\": 1}().
"
`)
})

test('Error when calling function with too few arguments', () => {
  return expectParsedError(
    stripIndent`
    function f(x) {
      return x;
    }
    f();
  `,
    { native: true }
  ).toMatchInlineSnapshot(`"Line 4: Expected 1 arguments, but got 0."`)
})

test('Error when calling function with too few arguments - verbose', () => {
  return expectParsedError(stripIndent`
    "enable verbose";
      function f(x) {
        return x;
      }
      f();
    `).toMatchInlineSnapshot(`
"Line 5, Column 2: Expected 1 arguments, but got 0.
Try calling function f again, but with 1 argument instead. Remember that arguments are separated by a ',' (comma).
"
`)
})

test('Error when calling function with too many arguments', () => {
  return expectParsedError(
    stripIndent`
    function f(x) {
      return x;
    }
    f(1, 2);
  `,
    { native: true }
  ).toMatchInlineSnapshot(`"Line 4: Expected 1 arguments, but got 2."`)
})

test('Error when calling function with too many arguments - verbose', () => {
  return expectParsedError(stripIndent`
    "enable verbose";
      function f(x) {
        return x;
      }
      f(1, 2);
    `).toMatchInlineSnapshot(`
"Line 5, Column 2: Expected 1 arguments, but got 2.
Try calling function f again, but with 1 argument instead. Remember that arguments are separated by a ',' (comma).
"
`)
})

test('Error when calling arrow function with too few arguments', () => {
  return expectParsedError(
    stripIndent`
    const f = x => x;
    f();
  `,
    { native: true }
  ).toMatchInlineSnapshot(`"Line 2: Expected 1 arguments, but got 0."`)
})

test('Error when calling arrow function with too few arguments - verbose', () => {
  return expectParsedError(stripIndent`
  "enable verbose";
    const f = x => x;
    f();
  `).toMatchInlineSnapshot(`
"Line 3, Column 2: Expected 1 arguments, but got 0.
Try calling function f again, but with 1 argument instead. Remember that arguments are separated by a ',' (comma).
"
`)
})

test('Error when calling arrow function with too many arguments', () => {
  return expectParsedError(
    stripIndent`
    const f = x => x;
    f(1, 2);
  `,
    { native: true }
  ).toMatchInlineSnapshot(`"Line 2: Expected 1 arguments, but got 2."`)
})

test('Error when calling arrow function with too many arguments - verbose', () => {
  return expectParsedError(stripIndent`
    "enable verbose";
      const f = x => x;
      f(1, 2);
    `).toMatchInlineSnapshot(`
"Line 3, Column 2: Expected 1 arguments, but got 2.
Try calling function f again, but with 1 argument instead. Remember that arguments are separated by a ',' (comma).
"
`)
})

test('Error when calling function from member expression with too many arguments', () => {
  return expectParsedError(
    stripIndent`
    const f = [x => x];
    f[0](1, 2);
  `,
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(`"Line 2: Expected 1 arguments, but got 2."`)
})

test('Error when calling function from member expression with too many arguments - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
      const f = [x => x];
      f[0](1, 2);
    `,
    { chapter: 3 }
  ).toMatchInlineSnapshot(`
"Line 3, Column 2: Expected 1 arguments, but got 2.
Try calling function f[0] again, but with 1 argument instead. Remember that arguments are separated by a ',' (comma).
"
`)
})

test('Error when calling arrow function in tail call with too many arguments - verbose', () => {
  return expectParsedError(
    stripIndent`
    "enable verbose";
    const g = () => 1;
    const f = x => g(x);
    f(1);
  `
  ).toMatchInlineSnapshot(`
"Line 3, Column 15: Expected 0 arguments, but got 1.
Try calling function g again, but with 0 arguments instead. Remember that arguments are separated by a ',' (comma).
"
`)
})

test('Error when calling arrow function in tail call with too many arguments', () => {
  return expectParsedError(
    stripIndent`
    const g = () => 1;
    const f = x => g(x);
    f(1);
  `,
    { native: true }
  ).toMatchInlineSnapshot(`"Line 2: Expected 0 arguments, but got 1."`)
})

test('Error when redeclaring constant', () => {
  return expectParsedError(
    stripIndent`
    const f = x => x;
    const f = x => x;
  `,
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(`"Line 2: SyntaxError: Identifier 'f' has already been declared (2:6)"`)
})

test('Error when redeclaring constant as variable', () => {
  return expectParsedError(
    stripIndent`
    const f = x => x;
    let f = x => x;
  `,
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(`"Line 2: SyntaxError: Identifier 'f' has already been declared (2:4)"`)
})

test('Error when redeclaring variable as constant', () => {
  return expectParsedError(
    stripIndent`
    let f = x => x;
    const f = x => x;
  `,
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(`"Line 2: SyntaxError: Identifier 'f' has already been declared (2:6)"`)
})

test('Error when redeclaring variable', () => {
  return expectParsedError(
    stripIndent`
    let f = x => x;
    let f = x => x;
  `,
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(`"Line 2: SyntaxError: Identifier 'f' has already been declared (2:4)"`)
})

test('Runtime error when redeclaring constant in interpreter', () => {
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

test('Runtime error when redeclaring constant in native', () => {
  const code1 = `
    const f = x => x;
  `
  const code2 = `
    const f = x => x;
  `
  const context = mockContext(3)
  return runInContext(code1, context, { scheduler: 'preemptive', isNativeRunnable: true }).then(
    obj1 => {
      expect(obj1).toMatchSnapshot()
      expect(obj1.status).toBe('finished')
      expect(parseError(context.errors)).toMatchSnapshot()
      return runInContext(code2, context, { scheduler: 'preemptive', isNativeRunnable: true }).then(
        obj2 => {
          expect(obj2).toMatchSnapshot()
          expect(obj2.status).toBe('error')
          expect(parseError(context.errors)).toMatchSnapshot()
        }
      )
    }
  )
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

test('Runtime error when redeclaring constant as variable - verbose', () => {
  const code1 = `
    const f = x => x;
  `
  const code2 = `
    "enable verbose";
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

test('Runtime error when redeclaring constant as function - verbose', () => {
  const code1 = `
    const f = x => x;
  `
  const code2 = `
    "enable verbose";
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

test('Runtime error when redeclaring variable as constant - verbose', () => {
  const code1 = `
    let f = x => x;
  `
  const code2 = `
    "enable verbose";
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

test('Runtime error when redeclaring variable - verbose', () => {
  const code1 = `
    let f = x => x;
  `
  const code2 = `
    "enable verbose";
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

test('Runtime error when redeclaring variable as function - verbose', () => {
  const code1 = `
    let f = x => x;
  `
  const code2 = `
    "enable verbose";
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

test('Runtime error when redeclaring function as constant - verbose', () => {
  const code1 = `
    function f(x) { return x; }
  `
  const code2 = `
    "enable verbose";
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

test('Runtime error when redeclaring function as variable - verbose', () => {
  const code1 = `
    function f(x) { return x; }
  `
  const code2 = `
    "enable verbose";
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

test('Runtime error when redeclaring function - verbose', () => {
  const code1 = `
    function f(x) { return x; }
  `
  const code2 = `
    "enable verbose";
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
  ).toMatchInlineSnapshot(`"Line 1: Cannot read inherited property valueOf of {}."`)
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
    { chapter: 1, native: true }
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
