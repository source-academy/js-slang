import { oneLine, snapshotSuccess, stripIndent } from '../../utils/testing'

test('Parses empty program', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse(""), undefined, 2);
  `,
    4
  )
})

test('Parses literals', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("3; true; false; ''; \\"\\"; 'bob'; 1; 20;"), undefined, 2);
  `,
    4
  )
})

test('Parses name expression', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("x;"), undefined, 2);
  `,
    4
  )
})

test('Parses name expressions', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("x; moreNames; undefined;"), undefined, 2);
  `,
    4
  )
})

test('Parses infix expressions', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("3 + 5 === 8 || !true && false;"), undefined, 2);
  `,
    4
  )
})

test('Parses declaration statements', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("const x = 5; let y = x;"), undefined, 2);
  `,
    4
  )
})

test('Parses assignment statements', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("x = 5; x = x; if (true) { x = 5; } else {}"), undefined, 2);
  `,
    4
  )
})

test('Parses if statements', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("if (true) { hi; } else { haha; } if (false) {} else {}"), undefined, 2);
  `,
    4
  )
})

test('Parses multi-argument arrow function expressions properly', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("(x, y) => x + 1;"), undefined, 2);
  `,
    4
  )
})

test('Parses multi-argument arrow function expressions properly', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("(x, y) => x + 1;"), undefined, 2);
  `,
    4
  )
})

test('Parses multi-argument arrow function assignments properly', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("const y = (x, y) => x + 1;"), undefined, 2);
  `,
    4
  )
})

test('Parses arrow function expressions properly', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("x => x + 1;"), undefined, 2);
  `,
    4
  )
})

test('Parses arrow function assignments properly', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("const y = x => x + 1;"), undefined, 2);
  `,
    4
  )
})

test('Parses function calls', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("f(x); thrice(thrice)(plus_one)(0);"), undefined, 2);
  `,
    4
  )
})

test('Parses fibonacci', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("function fib(x) { return x <= 1 ? x : fib(x-1) + fib(x-2); } fib(4);"), undefined, 2);
  `,
    4
  )
})

test('Parses object notation', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("let x = {a: 5, b: 10, 'key': value};"), undefined, 2);
  `,
    100
  )
})

test('Parses property access', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("a[b]; a.b; a[5]; a['b'];"), undefined, 2);
  `,
    100
  )
})

test('Parses property assignment', () => {
  return snapshotSuccess(
    stripIndent`
    stringify(parse("a[b] = 5; a.b = value; a[5] = 'value'; a['b'] = 42;"), undefined, 2);
  `,
    100
  )
})

test('Parses loops', () => {
  return snapshotSuccess(
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
  )
})
