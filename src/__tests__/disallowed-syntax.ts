import { expectParsedError, expectWarning, stripIndent } from '../utils/testing'

test('Cannot leave blank init in for loop', () => {
  return expectParsedError(
    stripIndent`
    for(; i < 3; i = i + 1) {
      break;
    }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Missing init expression in for statement."`)
})

test('Cannot leave blank test in for loop', () => {
  return expectParsedError(
    stripIndent`
    for(let i = 0; ; i = i + 1) {
      break;
    }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Missing test expression in for statement."`)
})

test('Cannot leave blank update in for loop', () => {
  return expectParsedError(
    stripIndent`
    for(let i = 0; i < 3;) {
      break;
    }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Missing update expression in for statement."`)
})

test('Cannot leave blank expressions in for loop', () => {
  return expectParsedError(
    stripIndent`
    for(;;) {
      break;
    }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Missing init, test, update expressions in for statement."`)
})

test('Cannot leave while loop predicate blank', () => {
  return expectParsedError(
    stripIndent`
  while() {
    x;
  }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: Unexpected token (1:6)"`)
})

test('Cannot use update expressions', () => {
  return expectParsedError(
    stripIndent`
  let x = 3;
  x++;
  x;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 2: Update expressions are not allowed"`)
})

test('Cannot have incomplete statements', () => {
  return expectParsedError(
    stripIndent`
  5
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Missing semicolon at the end of statement"`)
})

test('Cannot have if without else', () => {
  return expectParsedError(
    stripIndent`
  if (true) { 5; }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Missing \\"else\\" in \\"if-else\\" statement"`)
})

test('Cannot use assignment expressions', () => {
  return expectParsedError(
    stripIndent`
  let x = 3;
  let y = x = 5;
  x;
  `,
    100
  ).toMatchInlineSnapshot(
    `"Line 2: Assignment inside an expression is not allowed. Only assignment in a statement is allowed."`
  )
})

test('Cannot use assignment expressions', () => {
  return expectParsedError(
    stripIndent`
  let x = 3;
  let y = 4;
  x = y = 5;
  x;
  `,
    100
  ).toMatchInlineSnapshot(
    `"Line 3: Assignment inside an expression is not allowed. Only assignment in a statement is allowed."`
  )
})

test('Cannot use assignment expressions', () => {
  return expectParsedError(
    stripIndent`
  let y = 4;
  for (let x = y = 1; x < 1; x = x + 1) {
    y;
  }
  `,
    100
  ).toMatchInlineSnapshot(
    `"Line 2: Assignment inside an expression is not allowed. Only assignment in a statement is allowed."`
  )
})

test('Cannot use multiple declarations', () => {
  return expectParsedError(
    stripIndent`
  let x = 3, y = 5;
  x;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Multiple declaration in a single statement"`)
})

test('Cannot use destructuring declarations', () => {
  return expectParsedError(
    stripIndent`
  let x = [1, 2];
  let [a, b] = x;
  a;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 2: Array patterns are not allowed"`)
})

test('no declaration without assignment', () => {
  return expectParsedError(
    stripIndent`
  let x;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Missing value in variable declaration"`)
})

test('Cannot use update statements', () => {
  return expectParsedError(
    stripIndent`
  let x = 3;
  x += 5;
  x;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 2: The assignment operator += is not allowed. Use = instead"`)
})

test('Cannot use function expressions', () => {
  return expectParsedError(
    stripIndent`
  (function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); })(4);
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Function expressions are not allowed"`)
})

test('Cannot use function expressions', () => {
  return expectParsedError(
    stripIndent`
  (function(x) { return x + 1; })(4);
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Function expressions are not allowed"`)
})

test('if needs braces', () => {
  return expectParsedError(
    stripIndent`
    if (true)
      true;
    else
      false;
  `,
    100
  ).toMatchInlineSnapshot(`
"Line 1: Missing curly braces around \\"if\\" block
Line 1: Missing curly braces around \\"else\\" block"
`)
})

test('for needs braces', () => {
  return expectParsedError(
    stripIndent`
    for (let i = 0; i < 1; i = i + 1)
      i;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Missing curly braces around \\"for\\" block"`)
})

test('while needs braces', () => {
  return expectParsedError(
    stripIndent`
    let i = 0;
    while (i < 1)
      i = i + 1;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 2: Missing curly braces around \\"while\\" block"`)
})

test('No empty statements', () => {
  return expectParsedError(
    stripIndent`
    ;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Empty statements are not allowed"`)
})

test('No array expressions in chapter 2', () => {
  return expectParsedError(
    stripIndent`
    [];
  `,
    2
  ).toMatchInlineSnapshot(`"Line 1: Array expressions are not allowed"`)
})

test('No trailing commas in arrays', () => {
  return expectWarning(
    stripIndent`
    [1,];
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Trailing comma"`)
})

test('No trailing commas in objects', () => {
  return expectWarning(
    stripIndent`
    ({
      a: 1,
      b: 2,
    });
  `,
    100
  ).toMatchInlineSnapshot(`"Line 3: Trailing comma"`)
})

test('No rest pattern', () => {
  return expectParsedError(
    stripIndent`
    function f(...rest) {
      return rest;
    }
    f(1, 2);
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Rest elements are not allowed"`)
})

test('No spread operator', () => {
  return expectParsedError(
    stripIndent`
    function f(x, y) {
      return x + y;
    }
    f(...[1, 2]);
  `,
    100
  ).toMatchInlineSnapshot(`"Line 4: Spread elements are not allowed"`)
})

test('no try statements', () => {
  return expectParsedError(
    stripIndent`
    function f(x, y) {
      return x + y;
    }
    try {
      f(...[1, 2]);
    } catch (e) {
      display(e);
    }
  `,
    100
  ).toMatchInlineSnapshot(`
"Line 5: Spread elements are not allowed
Line 6: Catch clauses are not allowed
Line 4: Try statements are not allowed"
`)
})

test('no for of loops', () => {
  return expectParsedError(
    stripIndent`
    for (let i of list()) {
    }
  `,
    100
  ).toMatchInlineSnapshot(`
"Line 1: Missing value in variable declaration
Line 1: For of statements are not allowed"
`)
})

test('no for in loops', () => {
  return expectParsedError(
    stripIndent`
    for (let i in { a: 1, b: 2 }) {
    }
  `,
    100
  ).toMatchInlineSnapshot(`
"Line 1: Missing value in variable declaration
Line 1: For in statements are not allowed"
`)
})

test('no debugger statement', () => {
  return expectParsedError(
    stripIndent`
    debugger;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Debugger statements are not allowed"`)
})

test('no generator functions', () => {
  return expectParsedError(
    stripIndent`
    function* gen() {
      yield 2;
      return 1;
    }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 2: Yield expressions are not allowed"`)
})

test('no classes', () => {
  return expectParsedError(
    stripIndent`
    class Box {
    }
  `,
    100
  ).toMatchInlineSnapshot(`
"Line 1: Class bodys are not allowed
Line 1: Class declarations are not allowed"
`)
})

test('no super', () => {
  return expectParsedError(
    stripIndent`
    class BoxError extends Error {
      constructor() {
        super(1);
      }
    }
  `,
    100
  ).toMatchInlineSnapshot(`
"Line 3: Supers are not allowed
Line 2: Function expressions are not allowed
Line 2: Method definitions are not allowed
Line 1: Class bodys are not allowed
Line 1: Class declarations are not allowed"
`)
})

test('no export function', () => {
  return expectParsedError(
    stripIndent`
    export function f(x) {
      return x;
    }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Export named declarations are not allowed"`)
})

test('no export constant', () => {
  return expectParsedError(
    stripIndent`
    export const x = 1;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Export named declarations are not allowed"`)
})

test('no export default', () => {
  return expectParsedError(
    stripIndent`
    const x = 1;
    export default x;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 2: Export default declarations are not allowed"`)
})

test('no import', () => {
  return expectParsedError(
    stripIndent`
    import { stripIndent } from 'common-tags';
  `,
    100
  ).toMatchInlineSnapshot(`
"Line 1: Import specifiers are not allowed
Line 1: Import declarations are not allowed"
`)
})

test('no sequence expression', () => {
  return expectParsedError(
    stripIndent`
    (1, 2);
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Sequence expressions are not allowed"`)
})

test('no interface', () => {
  return expectParsedError(
    stripIndent`
    interface Box {
    }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: The keyword 'interface' is reserved (1:0)"`)
})

test('no template literals', () => {
  return expectParsedError('`hi`', 100).toMatchInlineSnapshot(`
"Line 1: Missing semicolon at the end of statement
Line 1: Template elements are not allowed
Line 1: Template literals are not allowed"
`)
})

test('no regexp', () => {
  return expectParsedError('/pattern/', 100).toMatchInlineSnapshot(`
"Line 1: Missing semicolon at the end of statement
Line 1: 'RegExp' literals are not allowed"
`)
})

test('no this, no new', () => {
  return expectParsedError(
    stripIndent`
    function Box() {
      this[0] = 5;
    }
    const box = new Box();
  `,
    100
  ).toMatchInlineSnapshot(`"Line 2: 'this' expressions are not allowed"`)
})

test('no unspecified operators', () => {
  return expectParsedError(
    stripIndent`
    1 << 10;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: Operator '<<' is not allowed."`)
})

test('no unspecified unary operators', () => {
  return expectParsedError(
    stripIndent`
    let x = 5;
    typeof x;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 2: Operator 'typeof' is not allowed."`)
})

test('no implicit undefined return', () => {
  return expectParsedError(
    stripIndent`
    function f() {
      return;
    }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 2: Missing value in return statement"`)
})

test('no repeated params', () => {
  return expectParsedError(
    stripIndent`
    function f(x, x) {
      return x;
    }
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: Argument name clash (1:14)"`)
})

test('no declaring reserved keywords', () => {
  return expectParsedError(
    stripIndent`
    let yield = 5;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: The keyword 'yield' is reserved (1:4)"`)
})

test('no assigning to reserved keywords', () => {
  return expectParsedError(
    stripIndent`
    package = 5;
  `,
    100
  ).toMatchInlineSnapshot(`"Line 1: SyntaxError: The keyword 'package' is reserved (1:0)"`)
})
