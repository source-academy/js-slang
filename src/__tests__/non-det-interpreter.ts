/* tslint:disable:max-line-length */
import { runInContext, resume, IOptions, Result, parseError } from '../index'
import { mockContext } from '../mocks/context'
import { SuspendedNonDet, Finished } from '../types'

test('Empty code returns undefined', async () => {
  await testDeterministicCode('', undefined)
})

test('Unary operations', async () => {
  await testDeterministicCode('-12 - 8;', -20)
  await testDeterministicCode('!true;', false)
  await testDeterministicCode('!(false);', true)
})

test('Unary operations with non deterministic terms', async () => {
  await testNonDeterministicCode('-amb(12, 24) - 8;', [-20, -32])
  await testNonDeterministicCode('!amb(true, false);', [false, true])
})

test('Unary operations on the wrong type should cause error', async () => {
  await testDeterministicCode('!100;', 'Line 1: Expected boolean, got number.', true)
})

test('Binary operations', async () => {
  await testDeterministicCode('1 + 4 - 10 * 5;', -45)
  await testDeterministicCode('"hello" + " world" + "!";', 'hello world!')
  await testDeterministicCode('(23 % 3) * (10 / 2);', 10)
})

test('Binary operations with non deterministic terms', async () => {
  await testNonDeterministicCode('1 + amb(4) - 10 * 5;', [-45])
  await testNonDeterministicCode('amb("hello", "bye") + " world" + "!";', [
    'hello world!',
    'bye world!'
  ])
  await testNonDeterministicCode('amb((23 % 3), 7) * amb((10 / 2), 19 - 5);', [10, 28, 35, 98])
})

test('Binary operations on the wrong types should cause error', async () => {
  await testDeterministicCode(
    'false + 4;',
    'Line 1: Expected string or number on left hand side of operation, got boolean.',
    true
  )
})

test('Assignment', async () => {
  await testDeterministicCode('let a = 5; a = 10; a;', 10)
})

test('Assignment with non deterministic terms', async () => {
  await testNonDeterministicCode('let a = amb(1, 2); a = amb(4, 5); a;', [4, 5, 4, 5])

  await testNonDeterministicCode(
    `let num = 5;
    function reassign_num() { num = 10; return num; }
    amb(reassign_num(), num);`,
    [10, 5]
  )
})

test('Re-assignment to constant should cause error', async () => {
  await testDeterministicCode(
    `const f = 10; { f = 20; }`,
    'Line 1: Cannot assign new value to constant f.',
    true
  )
})

test('Accessing un-declared variable should cause error', async () => {
  await testDeterministicCode(`let g = 100; f;`, 'Line -1: Name f not declared.', true)
})

test('If-else and conditional expressions with non deterministic terms', async () => {
  await testNonDeterministicCode('amb(false, true) ? 4 - 10 : 6;', [6, -6])
  await testNonDeterministicCode(
    `if (amb(true, false)) {
      -100;
     } else {
      200 / 2;
      210;
     }`,
    [-100, 210]
  )
  await testNonDeterministicCode(
    `if (amb(100 * 2 === 2, 40 % 2 === 0)) {
      amb(false, 'test' === 'test') ? amb(false === false, false) ? "hello" : false : amb(5, "world");
    } else {
      9 * 10 / 5;
    }`,
    [18, 5, 'world', 'hello', false]
  )
})

test('Conditional expression with non boolean predicate should cause error', async () => {
  await testDeterministicCode(
    '100 ? 5 : 5;',
    'Line 1: Expected boolean as condition, got number.',
    true
  )
})

test('Logical expressions', async () => {
  await testDeterministicCode(`true && (false || true) && (true && false);`, false)

  await testDeterministicCode(
    `function foo() { return foo(); }\
      true || foo();`,
    true
  )

  await testDeterministicCode(
    `function foo() { return foo(); }\
    false && foo();`,
    false
  )
})

test('Logical expressions with non deterministic terms', async () => {
  await testNonDeterministicCode(
    `amb(true, false) && amb(false, true) || amb(false);
    `,
    [false, true, false]
  )
})

test('Function applications', async () => {
  await testDeterministicCode(
    `function factorial(n) {
      return n === 0 ? 1 : n * factorial(n - 1);
     }
     factorial(5);
    `,
    120
  )

  await testDeterministicCode(
    'function f(x) { function subfunction(y) {  return y * 2; } return x * subfunction(10); } f(6);',
    120
  )

  await testDeterministicCode(
    `function noReturnStatement_returnsUndefined() {
       20 + 40 - 6;
       5 - 5;
       list();
       reverse(list(1));
     }`,
    undefined
  )
})

test('Applying functions with wrong number of arguments should cause error', async () => {
  await testDeterministicCode(
    `function foo(a, b) {
       return a + b;
     }
     foo(1);
     `,
    `Line 4: Expected 2 arguments, but got 1.`,
    true
  )
})

test('Builtin list functions', async () => {
  await testDeterministicCode('pair(false, 10);', [false, 10])
  await testDeterministicCode('list();', null)
  await testDeterministicCode('list(1);', [1, null])
  await testDeterministicCode('head(list(1));', 1)
  await testDeterministicCode('tail(list(1));', null)
})

test('Builtin list functions with non deterministic terms', async () => {
  await testNonDeterministicCode('pair(amb(false, true), 10);', [
    [false, 10],
    [true, 10]
  ])
  await testNonDeterministicCode('list(amb());', [])
  await testNonDeterministicCode('list(amb(1,2));', [
    [1, null],
    [2, null]
  ])
  await testNonDeterministicCode('head(amb(list(100), list(20, 30)));', [100, 20])
})

test('Prelude list functions', async () => {
  await testDeterministicCode('is_null(null);', true)
  await testDeterministicCode('is_null(list(null));', false)
  await testDeterministicCode(
    `function increment(n) { return n + 1; }
     map(increment, list(100, 101, 200));
    `,
    [101, [102, [201, null]]]
  )
  await testDeterministicCode('append(list(5), list(6,20));', [5, [6, [20, null]]])
  await testDeterministicCode('append(list(4,5), list());', [4, [5, null]])
  await testDeterministicCode('reverse(list("hello", true, 0));', [0, [true, ['hello', null]]])
})

test('Empty amb application', async () => {
  await testNonDeterministicCode('amb();', [])
})

test('Simple amb application', async () => {
  await testNonDeterministicCode('amb(1, 4 + 5, 3 - 10);', [1, 9, -7])
})

test('Functions with non deterministic terms', async () => {
  await testNonDeterministicCode(
    `function foo() {
      return amb(true, false) ? 'a string' : amb(10, 20);
     }
     foo();`,
    ['a string', 10, 20]
  )
})

test('Functions as amb arguments', async () => {
  await testNonDeterministicCode(
    ' const is_even = num => (num % 2) === 0;\
      const add_five = num => num + 5;\
      const nondet_func = amb(is_even, add_five, num => !is_even(num));\
      nondet_func(5);\
    ',
    [false, 10, true]
  )
})

test('Combinations of amb', async () => {
  await testNonDeterministicCode('list(amb(1, 2, 3), amb("a", "b"));', [
    [1, ['a', null]],
    [1, ['b', null]],
    [2, ['a', null]],
    [2, ['b', null]],
    [3, ['a', null]],
    [3, ['b', null]]
  ])
})

test('Require operator', async () => {
  await testNonDeterministicCode(
    ' \
      function int_between(low, high) { \
        return low > high ? amb() : amb(low, int_between(low + 1, high)); \
      } \
      let integer = int_between(5, 10);\
      require(integer % 3 === 0); \
      integer;\
    ',
    [6, 9]
  )

  await testNonDeterministicCode(
    `const f = an_integer_between(1, 10); require(f > 3, true); f;`,
    ['Line 1: Expected 1 arguments, but got 2.'],
    true
  )
})

/*  Deterministic block scoping tests taken from block-scoping.ts */

test('Block statements', async () => {
  await testDeterministicCode(
    `
    function test(){
      const x = true;
      {
          const x = false;
      }
      return x;
    }
    test();
    `,
    true
  )

  await testDeterministicCode(
    `
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
    `,
    true
  )

  await testDeterministicCode(
    `
    const v = f();
    function f() {
      return 1;
    }
    v;
    `,
    'Line -1: Name f declared later in current scope but not yet assigned',
    true
  )

  await testDeterministicCode(
    `
    const a = 1;
    function f() {
      display(a);
      const a = 5;
    }
    f();
    `,
    'Line -1: Name a declared later in current scope but not yet assigned',
    true
  )

  await testDeterministicCode(
    `
    const a = 1;
    {
      a + a;
      const a = 10;
    }
    `,
    'Line -1: Name a declared later in current scope but not yet assigned',
    true
  )

  await testDeterministicCode(
    `
    let variable = 1;
    function test(){
      variable = 100;
      let variable = true;
      return variable;
    }
    test();
    `,
    'Line -1: Name variable not declared.',
    true
  )
})

// ---------------------------------- Helper functions  -------------------------------------------

const nonDetTestOptions = {
  scheduler: 'non-det',
  executionMethod: 'interpreter'
} as Partial<IOptions>

export async function testDeterministicCode(
  code: string,
  expectedValue: any,
  hasError: boolean = false
) {
  /* a deterministic program is equivalent to a non deterministic program
     that returns a single value */
  await testNonDeterministicCode(code, [expectedValue], hasError)
}

/* Assumes the error message (if any) is at the last index of expectedValues */
export async function testNonDeterministicCode(
  code: string,
  expectedValues: any[],
  hasError: boolean = false
) {
  const context = makeNonDetContext()
  let result: Result = await runInContext(code, context, nonDetTestOptions)

  const numOfRuns = hasError ? expectedValues.length - 1 : expectedValues.length
  for (let i = 0; i < numOfRuns; i++) {
    expect((result as SuspendedNonDet).value).toEqual(expectedValues[i])
    expect(result.status).toEqual('suspended-non-det')

    result = await resume(result)
  }

  if (!hasError) {
    // all non deterministic programs have a final result whose value is undefined
    expect(result.status).toEqual('finished')
    expect((result as Finished).value).toEqual(undefined)
  } else {
    expect(result.status).toEqual('error')
    const message: string = parseError(context.errors)
    expect(message).toEqual(expectedValues[expectedValues.length - 1])
  }
}

function makeNonDetContext() {
  const context = mockContext(4.3)
  context.executionMethod = 'interpreter'
  return context
}
