import { Value } from '../types'
import {
  expectParsedError,
  expectParsedErrorNoErrorSnapshot,
  expectParsedErrorNoSnapshot,
  expectResult,
  expectToLooselyMatchJS,
  expectToMatchJS,
  stripIndent
} from '../utils/testing'

const toString = (x: Value) => '' + x

test('Empty code returns undefined', () => {
  return expectResult('').toBe(undefined)
})

test('Single string self-evaluates to itself', () => {
  return expectResult("'42';").toBe('42')
})

test('Allow display to return value it is displaying', () => {
  return expectResult('25*(display(1+1));').toBe(50)
})

test('Single number self-evaluates to itself', () => {
  return expectResult('42;').toBe(42)
})

test('Single boolean self-evaluates to itself', () => {
  return expectResult('true;').toBe(true)
})

test('Arrow function definition returns itself', () => {
  return expectResult('() => 42;').toMatchInlineSnapshot(`[Function]`)
})

test('Builtins hide their implementation when stringify', () => {
  return expectResult('stringify(pair);', { chapter: 2, native: true }).toMatchInlineSnapshot(`
"function pair(left, right) {
	[implementation hidden]
}"
`)
})

test('Builtins hide their implementation when toString', () => {
  return expectResult('toString(pair);', { chapter: 2, native: true, testBuiltins: { toString } })
    .toMatchInlineSnapshot(`
"function pair(left, right) {
	[implementation hidden]
}"
`)
})

test('Objects toString matches up with JS', () => {
  return expectToMatchJS('toString({a: 1});', {
    chapter: 100,
    native: true,
    testBuiltins: { toString }
  })
})

test('Arrays toString matches up with JS', () => {
  return expectToMatchJS('toString([1, 2]);', {
    chapter: 3,
    native: true,
    testBuiltins: { toString }
  })
})

test('functions toString (mostly) matches up with JS', () => {
  return expectToLooselyMatchJS(
    stripIndent`
  function f(x) {
    return 5;
  }
  toString(a=>b) + toString(f);
  `,
    { native: true, testBuiltins: { toString } }
  )
})

test('primitives toString matches up with JS', () => {
  return expectToMatchJS(
    stripIndent`
    toString(true) +
    toString(false) +
    toString(1) +
    toString(1.5) +
    toString(null) +
    toString(undefined) +
    toString(NaN);
    `,
    { chapter: 2, native: true, testBuiltins: { toString } }
  )
})

test('Factorial arrow function', () => {
  return expectResult(
    stripIndent`
    const fac = (i) => i === 1 ? 1 : i * fac(i-1);
    fac(5);
  `,
    { native: true }
  ).toBe(120)
})

test('parseError for missing semicolon', () => {
  return expectParsedError('42').toMatchInlineSnapshot(
    `"Line 1: Missing semicolon at the end of statement"`
  )
})

test('Simple arrow function infinite recursion represents CallExpression well', () => {
  return expectParsedErrorNoErrorSnapshot('(x => x(x)(x))(x => x(x)(x));').toMatchInlineSnapshot(`
"Line 1: Maximum call stack size exceeded
  x(x => x(x)(x))..  x(x => x(x)(x))..  x(x => x(x)(x)).."
`)
}, 30000)

test('Simple function infinite recursion represents CallExpression well', () => {
  return expectParsedErrorNoErrorSnapshot('function f(x) {return x(x)(x);} f(f);')
    .toMatchInlineSnapshot(`
"Line 1: Maximum call stack size exceeded
  x(function f(x) {
  return x(x)(x);
})..  x(function f(x) {
  return x(x)(x);
})..  x(function f(x) {
  return x(x)(x);
}).."
`)
}, 30000)

test('Cannot overwrite consts even when assignment is allowed', () => {
  return expectParsedError(
    stripIndent`
    function test(){
      const constant = 3;
      constant = 4;
      return constant;
    }
    test();
  `,
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(`"Line 3: Cannot assign new value to constant constant"`)
})

test('Can overwrite lets when assignment is allowed', () => {
  return expectResult(
    stripIndent`
    function test() {
      let variable = false;
      variable = true;
      return variable;
    }
    test();
  `,
    { chapter: 3, native: true }
  ).toBe(true)
})

test('Arrow function infinite recursion with list args represents CallExpression well', () => {
  return expectParsedErrorNoErrorSnapshot(
    stripIndent`
    const f = xs => append(f(xs), list());
    f(list(1, 2));
  `,
    { chapter: 2 }
  ).toMatchInlineSnapshot(`
"Line 1: Maximum call stack size exceeded
  f([1, [2, null]])..  f([1, [2, null]])..  f([1, [2, null]]).."
`)
}, 30000)

test('Function infinite recursion with list args represents CallExpression well', () => {
  return expectParsedErrorNoErrorSnapshot(
    stripIndent`
    function f(xs) { return append(f(xs), list()); }
    f(list(1, 2));
  `,
    { chapter: 2 }
  ).toMatchInlineSnapshot(`
"Line 1: Maximum call stack size exceeded
  f([1, [2, null]])..  f([1, [2, null]])..  f([1, [2, null]]).."
`)
}, 30000)

test('Arrow function infinite recursion with different args represents CallExpression well', () => {
  return expectParsedErrorNoSnapshot(stripIndent`
    const f = i => f(i+1) - 1;
    f(0);
  `).toEqual(
    expect.stringMatching(/^Line 1: Maximum call stack size exceeded\n\ *(f\(\d*\)[^f]{2,4}){3}/)
  )
}, 30000)

test('Function infinite recursion with different args represents CallExpression well', () => {
  return expectParsedErrorNoSnapshot(stripIndent`
    function f(i) { return f(i+1) - 1; }
    f(0);
  `).toEqual(
    expect.stringMatching(/^Line 1: Maximum call stack size exceeded\n\ *(f\(\d*\)[^f]{2,4}){3}/)
  )
}, 30000)

test('Functions passed into non-source functions remain equal', () => {
  return expectResult(
    stripIndent`
    function t(x, y, z) {
      return x + y + z;
    }
    identity(t) === t && t(1, 2, 3) === 6;
  `,
    { chapter: 1, testBuiltins: { 'identity(x)': (x: any) => x }, native: true }
  ).toBe(true)
})

test('Simple object assignment and retrieval', () => {
  return expectResult(
    stripIndent`
    const o = {};
    o.a = 1;
    o.a;
  `,
    { chapter: 100, native: true }
  ).toBe(1)
})

test('Deep object assignment and retrieval', () => {
  return expectResult(
    stripIndent`
    const o = {};
    o.a = {};
    o.a.b = {};
    o.a.b.c = "string";
    o.a.b.c;
  `,
    { chapter: 100, native: true }
  ).toBe('string')
})

test('Test apply_in_underlying_javascript', () => {
  return expectResult(
    stripIndent`
    apply_in_underlying_javascript((a, b, c) => a * b * c, list(2, 5, 6));
  `,
    { chapter: 4, native: true }
  ).toBe(60)
})

test('Test equal for primitives', () => {
  return expectResult(
    stripIndent`
    equal(1, 1) && equal("str", "str") && equal(null, null) && !equal(1, 2) && !equal("str", "");
  `,
    { chapter: 2, native: true }
  ).toBe(true)
})

test('Test equal for lists', () => {
  return expectResult(
    stripIndent`
    equal(list(1, 2), pair(1, pair(2, null))) && equal(list(1, 2, 3, 4), list(1, 2, 3, 4));
  `,
    { chapter: 2, native: true }
  ).toBe(true)
})

test('Test equal for different lists', () => {
  return expectResult(
    stripIndent`
    !equal(list(1, 2), pair(1, 2)) && !equal(list(1, 2, 3), list(1, list(2, 3)));
  `,
    { chapter: 2, native: true }
  ).toBe(true)
})

test('true if with empty if works', () => {
  return expectResult(
    stripIndent`
    if (true) {
    } else {
    }
  `,
    { native: true }
  ).toBe(undefined)
})

test('true if with nonempty if works', () => {
  return expectResult(
    stripIndent`
    if (true) {
      1;
    } else {
    }
  `,
    { native: true }
  ).toBe(1)
})

test('false if with empty else works', () => {
  return expectResult(
    stripIndent`
    if (false) {
    } else {
    }
  `,
    { native: true }
  ).toBe(undefined)
})

test('false if with nonempty if works', () => {
  return expectResult(
    stripIndent`
    if (false) {
    } else {
      2;
    }
  `,
    { native: true }
  ).toBe(2)
})

test('test true conditional expression', () => {
  return expectToMatchJS('true ? true : false;', { native: true })
})

test('test false conditional expression', () => {
  return expectToMatchJS('false ? true : false;', { native: true })
})

test('test false && true', () => {
  return expectToMatchJS('false && true;', { native: true })
})

test('test false && false', () => {
  return expectToMatchJS('false && false;', { native: true })
})

test('test true && false', () => {
  return expectToMatchJS('true && false;', { native: true })
})

test('test true && true', () => {
  return expectToMatchJS('true && true;', { native: true })
})

test('test && shortcircuiting', () => {
  return expectToMatchJS('false && 1();', { native: true })
})

test('test false || true', () => {
  return expectToMatchJS('false || true;', { native: true })
})

test('test false || false', () => {
  return expectToMatchJS('false || false;', { native: true })
})

test('test true || false', () => {
  return expectToMatchJS('true || false;', { native: true })
})

test('test true || true', () => {
  return expectToMatchJS('true || true;', { native: true })
})

test('test || shortcircuiting', () => {
  return expectToMatchJS('true || 1();', { native: true })
})
