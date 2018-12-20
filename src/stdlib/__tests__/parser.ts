import { expectResult, oneLine, stripIndent } from '../../utils/testing'

test('Parses empty program', () => {
  return expectResult(
    stripIndent`
    stringify(parse(""), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses literals', () => {
  return expectResult(
    stripIndent`
    stringify(parse("3; true; false; ''; \\"\\"; 'bob'; 1; 20;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses name expression', () => {
  return expectResult(
    stripIndent`
    stringify(parse("x;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses name expressions', () => {
  return expectResult(
    stripIndent`
    stringify(parse("x; moreNames; undefined;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses infix expressions', () => {
  return expectResult(
    stripIndent`
    stringify(parse("3 + 5 === 8 || !true && false;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses declaration statements', () => {
  return expectResult(
    stripIndent`
    stringify(parse("const x = 5; let y = x;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses assignment statements', () => {
  return expectResult(
    stripIndent`
    stringify(parse("x = 5; x = x; if (true) { x = 5; } else {}"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses if statements', () => {
  return expectResult(
    stripIndent`
    stringify(parse("if (true) { hi; } else { haha; } if (false) {} else {}"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses multi-argument arrow function expressions properly', () => {
  return expectResult(
    stripIndent`
    stringify(parse("(x, y) => x + 1;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses multi-argument arrow function expressions properly', () => {
  return expectResult(
    stripIndent`
    stringify(parse("(x, y) => x + 1;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses multi-argument arrow function assignments properly', () => {
  return expectResult(
    stripIndent`
    stringify(parse("const y = (x, y) => x + 1;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses arrow function expressions properly', () => {
  return expectResult(
    stripIndent`
    stringify(parse("x => x + 1;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses arrow function assignments properly', () => {
  return expectResult(
    stripIndent`
    stringify(parse("const y = x => x + 1;"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses function calls', () => {
  return expectResult(
    stripIndent`
    stringify(parse("f(x); thrice(thrice)(plus_one)(0);"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses fibonacci', () => {
  return expectResult(
    stripIndent`
    stringify(parse("function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); } fib(4);"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})

test('Parses object notation', () => {
  return expectResult(
    stripIndent`
    stringify(parse("let x = {a: 5, b: 10, 'key': value};"), undefined, 2);
  `,
    100
  ).toEqual(expect.anything())
})

test('Parses property access', () => {
  return expectResult(
    stripIndent`
    stringify(parse("a[b]; a.b; a[5]; a['b'];"), undefined, 2);
  `,
    100
  ).toEqual(expect.anything())
})

test('Parses property assignment', () => {
  return expectResult(
    stripIndent`
    stringify(parse("a[b] = 5; a.b = value; a[5] = 'value'; a['b'] = 42;"), undefined, 2);
  `,
    100
  ).toEqual(expect.anything())
})

test('Parses loops', () => {
  return expectResult(
    oneLine`
    stringify(parse(
      "while (true) {
        continue;
        break;
      }
      for (let i = 0; i < 1; i = i + 1) {
        continue;
        break;
      }
      for (i = 0; i < 1; i = i + 1) {
        continue;
        break;
      }"), undefined, 2);
  `,
    4
  ).toEqual(expect.anything())
})
