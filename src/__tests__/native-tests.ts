import { runInContext } from '../index'
import { mockContext } from '../mocks/context'
import { Finished } from '../types'
import { expectResult, stripIndent } from '../utils/testing'

function nativeTest(code: string, expectedResult: any) {
  return () => {
    const context = mockContext(4)
    const promise = runInContext(code, context, { scheduler: 'preemptive', isNativeRunnable: true })
    return promise.then(obj => {
      expect(obj).toMatchSnapshot()
      expect(obj.status).toBe('finished')
      expect((obj as Finished).value).toBe(expectedResult)
    })
  }
}

test('Empty code returns undefined', nativeTest('', undefined))

test('Single string self-evaluates to itself', nativeTest('"1";', '1'))

test('Allow display to return value it is displaying', nativeTest('25*(display(1+1));', 50))

test(
  'Factorial arrow function',
  nativeTest(
    stripIndent`
    const fac = (i) => i === 1 ? 1 : i * fac(i-1);
    fac(5);
  `,
    120
  )
)

test(
  'Test apply_in_underlying_javascript',
  nativeTest(
    stripIndent`
    apply_in_underlying_javascript((a, b, c) => a * b * c, list(2, 5, 6));
  `,
    60
  )
)

test(
  'Test equal for lists',
  nativeTest(
    stripIndent`
    equal(list(1, 2), pair(1, pair(2, null))) && equal(list(1, 2, 3, 4), list(1, 2, 3, 4));
  `,
    true
  )
)

test(
  'Test equal for different lists',
  nativeTest(
    stripIndent`
    !equal(list(1, 2), pair(1, 2)) && !equal(list(1, 2, 3), list(1, list(2, 3)));
  `,
    true
  )
)
test('Simple tail call returns work', () => {
  return expectResult(stripIndent`
    function f(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+1);
      }
    }
    f(5000, 5000);
  `).toMatchInlineSnapshot(`10000`)
})

test('Tail call in conditional expressions work', () => {
  return expectResult(stripIndent`
    function f(x, y) {
      return x <= 0 ? y : f(x-1, y+1);
    }
    f(5000, 5000);
  `).toMatchInlineSnapshot(`10000`)
})

test(
  'Tail call in boolean operators work',
  nativeTest(
    stripIndent`
    function f(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return false || f(x-1, y+1);
      }
    }
    f(5000, 5000);
  `,
    10000
  )
)

test(
  'Tail call in nested mix of conditional expressions boolean operators work',
  nativeTest(
    stripIndent`
    function f(x, y) {
      return x <= 0 ? y : false || x > 0 ? f(x-1, y+1) : 'unreachable';
    }
    f(5000, 5000);
  `,
    10000
  )
)

test(
  'Tail calls in arrow functions work',
  nativeTest(
    stripIndent`
    const f = (x, y) => x <= 0 ? y : f(x-1, y+1);
    f(5000, 5000);
  `,
    10000
  )
)

test(
  'Tail calls in mutual recursion work',
  nativeTest(
    stripIndent`
    function f(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return g(x-1, y+1);
      }
    }
    function g(x, y) {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+1);
      }
    }
    f(5000, 5000);
  `,
    10000
  )
)

test(
  'Tail calls in mixed tail-call/non-tail-call recursion work',
  nativeTest(
    stripIndent`
    function f(x, y, z) {
      if (x <= 0) {
        return y;
      } else {
        return f(x-1, y+f(0, z, 0), z);
      }
    }
    f(5000, 5000, 2);
  `,
    15000
  )
)

test(
  'Builtins work with source functions well',
  nativeTest(
    stripIndent`
    function double(x) { return x * 2; }
    accumulate((a, b) => a + b, 0, map(double, list(1, 2, 3)));
  `,
    12
  )
)
