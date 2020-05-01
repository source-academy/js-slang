import { stripIndent } from '../../utils/formatters'
import { expectResult } from '../../utils/testing'

/**
 * Testing plan
 *
 * Lazy-evaluation requirements:
 * 1. Each expression is only evaluated when needed
 * 2. Each expression is only evaluated at least once
 *
 */

describe('lazy evaluation mode', () => {
  it('evaluates each expression at most once', () => {
    return expectResult(
      stripIndent`
        function f() { display("this line should be printed exactly once"); return 1; }
        const a = f();
        a+a+a;
      `,
      { chapter: 2, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`3`)
  })

  it('evaluates each expression only when needed', () => {
    return expectResult(
      stripIndent`
        function f() { display("f"); return 1; }
        function g() { display("g"); return 2; }
        function h() { display("h"); return 3; }
        const a=f();
        const b=g();
        const c=h();
        display(c); // "h", 3
        display(b); // "g", 2
        display(c); // 3
      `,
      { chapter: 2, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`3`)
  })

  it('delays expressions in variable declarations', () => {
    return expectResult(
      stripIndent`
        const a = error(); // delayed
      `,
      { chapter: 2, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`undefined`)
  })

  it('delays arguments in function calls', () => {
    return expectResult(
      stripIndent`
        function f(x, y) { return y; }
        f(error(), 1);
      `,
      { chapter: 2, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`1`)
  })
})

test('infinite functions with pair', () => {
  return expectResult(
    stripIndent`
      function f(x) { return pair(x,f(x+1)); }
      head(f(0))+head(tail(tail(f(0))));
    `,
    { chapter: 2, variant: 'lazy', native: false }
  ).toMatchInlineSnapshot(`2`)
})
