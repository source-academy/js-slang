import { stripIndent } from '../../utils/formatters'
import { expectResult, expectParsedError } from '../../utils/testing'

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
        function f() { display("print once"); return 1; }
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

  it('delays expressions in a variable declaration', () => {
    return expectResult(
      stripIndent`
        const a = error();
      `,
      { chapter: 2, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`undefined`)
  })

  it('delays arguments in a function call', () => {
    return expectResult(
      stripIndent`
        function f(x, y) { return y; }
        f(error(), 1);
      `,
      { chapter: 2, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`1`)
  })

  it('delays elements in an array', () => {
    return expectResult(
      stripIndent`
        const a = [1, error(), 2];
        a[0] + a[2];
      `,
      { chapter: 3, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`3`)
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

describe('force_it function', () => {
  it('forces evaluation in variable declarations', () => {
    return expectParsedError(
      stripIndent`
        const a = error();
        const b = force_it(error());
      `,
      { chapter: 2, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`"Line 2: Error: undefined"`)
  })

  it('forces evaluation in function calls', () => {
    return expectParsedError(
      stripIndent`
        function f(x) { return 0; }
        f(error());
        f(force_it(error()));
      `,
      { chapter: 2, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`"Line 3: Error: undefined"`)
  })

  it('forces evaluation of elements in array expressions', () => {
    return expectParsedError(
      stripIndent`
        const a = [0, error()];
        a[0];
        const b = [0, force_it(error())];
        b[0];
      `,
      { chapter: 3, variant: 'lazy', native: false }
    ).toMatchInlineSnapshot(`"Line 3: Error: undefined"`)
  })
})
