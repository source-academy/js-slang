import { expectResult, stripIndent } from '../utils/testing'

test('String representation of numbers are nice', () => {
  return expectResult(stripIndent`
  stringify(0);
  `).toMatchInlineSnapshot(`"0"`)
})

test('String representation of strings are nice', () => {
  return expectResult(stripIndent`
  stringify('a string');
  `).toMatchInlineSnapshot(`"\\"a string\\""`)
})

test('String representation of booleans are nice', () => {
  return expectResult(stripIndent`
  stringify('true');
  `).toMatchInlineSnapshot(`"\\"true\\""`)
})

test('String representation of functions are nice', () => {
  return expectResult(stripIndent`
  function f(x, y) {
    return z;
  }
  stringify(f);
  `).toMatchInlineSnapshot(`
"function f(x, y) {
  return z;
}"
`)
})

test('String representation of arrow functions are nice', () => {
  return expectResult(stripIndent`
  const f = (x, y) => z;
  stringify(f);
  `).toMatchInlineSnapshot(`"(x, y) => z"`)
})

test('String representation of arrays are nice', () => {
  return expectResult(
    stripIndent`
  const xs = [1, 'true', true, () => x];
  stringify(xs);
  `,
    3
  ).toMatchInlineSnapshot(`"[1, \\"true\\", true, () => x]"`)
})

test('String representation of multidimensional arrays are nice', () => {
  return expectResult(
    stripIndent`
  const xs = [1, 'true', [true, () => x, [[]]]];
  stringify(xs);
  `,
    3
  ).toMatchInlineSnapshot(`"[1, \\"true\\", [true, () => x, [[]]]]"`)
})

test('String representation of empty arrays are nice', () => {
  return expectResult(
    stripIndent`
  const xs = [];
  stringify(xs);
  `,
    3
  ).toMatchInlineSnapshot(`"[]"`)
})

test('String representation of lists are nice', () => {
  return expectResult(
    stripIndent`
  stringify(enum_list(1, 10));
  `,
    2
  ).toMatchInlineSnapshot(`"[1, [2, [3, [4, [5, [6, [7, [8, [9, [10, null]]]]]]]]]]"`)
})

// tslint:disable:max-line-length
test('String representation of huge lists are nice', () => {
  return expectResult(
    stripIndent`
  stringify(enum_list(1, 1000));
  `,
    2
  ).toMatchInlineSnapshot(`
"[ 1,
[ 2,
[ 3,
[ 4,
[ 5,
[ 6,
[ 7,
[ 8,
[ 9,
[ 10,
[ 11,
[ 12,
[ 13,
[ 14,
[ 15,
[ 16,
[ 17,
[ 18,
[ 19,
[ 20,
[ 21,
[ 22,
[ 23,
[ 24,
[ 25,
[ 26,
[ 27,
[ 28,
[ 29,
[ 30,
[ 31,
[ 32,
[ 33,
[ 34,
[ 35,
[ 36,
[ 37,
[ 38,
[ 39,
[ 40,
[ 41,
[ 42,
[ 43,
[ 44,
[ 45,
[ 46,
[ 47,
[ 48,
[ 49,
[ 50,
[ 51,
[ 52,
[ 53,
[ 54,
[ 55,
[ 56,
[ 57,
[ 58,
[ 59,
[ 60,
[ 61,
[ 62,
[ 63,
[ 64,
[ 65,
[ 66,
[ 67,
[ 68,
[ 69,
[ 70,
[ 71,
[ 72,
[ 73,
[ 74,
[ 75,
[ 76,
[ 77,
[ 78,
[ 79,
[ 80,
[ 81,
[ 82,
[ 83,
[ 84,
[ 85,
[ 86,
[ 87,
[ 88,
[ 89,
[ 90,
[91, [92, [93, [94, [95, [96, [97, [98, [99, [100, [101, ...<truncated>]]]]]]]]]]] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ] ]"
`)
})
// tslint:enable:max-line-length

test('String representation of huge arrays are nice', () => {
  return expectResult(
    stripIndent`
  const arr = [];
  for (let i = 0; i < 100; i = i + 1) {
    arr[i] = i;
  }
  stringify(arr);
  `,
    3
  ).toMatchInlineSnapshot(`
"[ 0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  64,
  65,
  66,
  67,
  68,
  69,
  70,
  71,
  72,
  73,
  74,
  75,
  76,
  77,
  78,
  79,
  80,
  81,
  82,
  83,
  84,
  85,
  86,
  87,
  88,
  89,
  90,
  91,
  92,
  93,
  94,
  95,
  96,
  97,
  98,
  99 ]"
`)
})

test('String representation of objects are nice', () => {
  return expectResult(
    stripIndent`
  const o = { a: 1, b: true, c: () => x };
  stringify(o);
  `,
    100
  ).toMatchInlineSnapshot(`"{\\"a\\": 1, \\"b\\": true, \\"c\\": () => x}"`)
})

test('String representation of nested objects are nice', () => {
  return expectResult(
    stripIndent`
  const o = { a: 1, b: true, c: () => x, d: { e: 5, f: 6 } };
  stringify(o);
  `,
    100
  ).toMatchInlineSnapshot(
    `"{\\"a\\": 1, \\"b\\": true, \\"c\\": () => x, \\"d\\": {\\"e\\": 5, \\"f\\": 6}}"`
  )
})

test('String representation of big objects are nice', () => {
  return expectResult(
    stripIndent`
  const o = { a: 1, b: true, c: () => x, d: { e: 5, f: 6 }, g: 0, h: 0, i: 0, j: 0, k: 0, l: 0, m: 0, n: 0};
  stringify(o);
  `,
    100
  ).toMatchInlineSnapshot(`
"{ \\"a\\": 1,
  \\"b\\": true,
  \\"c\\": () => x,
  \\"d\\": {\\"e\\": 5, \\"f\\": 6},
  \\"g\\": 0,
  \\"h\\": 0,
  \\"i\\": 0,
  \\"j\\": 0,
  \\"k\\": 0,
  \\"l\\": 0,
  \\"m\\": 0,
  \\"n\\": 0 }"
`)
})

test('String representation of nested objects are nice', () => {
  return expectResult(
    stripIndent`
  let o = {};
  o.o = o;
  stringify(o);
  `,
    100
  ).toMatchInlineSnapshot(`"{\\"o\\": ...<circular>}"`)
})

test('String representation of builtins are nice', () => {
  return expectResult(
    stripIndent`
  stringify(pair);
  `,
    2
  ).toMatchInlineSnapshot(`
"function pair(left, right) {
	[implementation hidden]
}"
`)
})

test('String representation of null is nice', () => {
  return expectResult(
    stripIndent`
  stringify(null);
  `,
    2
  ).toMatchInlineSnapshot(`"null"`)
})

test('String representation of undefined is nice', () => {
  return expectResult(stripIndent`
  stringify(undefined);
  `).toMatchInlineSnapshot(`"undefined"`)
})

// tslint:disable:max-line-length
test('String representation with no indent', () => {
  return expectResult(
    stripIndent`
  stringify(parse('x=>x;'), 0);
  `,
    4
  ).toMatchInlineSnapshot(
    `"[{\\"tag\\": \\"function_definition\\", \\"parameters\\": [{\\"tag\\": \\"name\\", \\"name\\": \\"x\\", \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 1}}}, null], \\"body\\": {\\"tag\\": \\"return_statement\\", \\"expression\\": {\\"tag\\": \\"name\\", \\"name\\": \\"x\\", \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}}}, \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}}}, \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 5}}}, null]"`
  )
})

test('String representation with 1 space indent', () => {
  return expectResult(
    stripIndent`
  stringify(parse('x=>x;'), 1);
  `,
    4
  ).toMatchInlineSnapshot(`
"[{\\"tag\\": \\"function_definition\\",
  \\"parameters\\":
   [{\\"tag\\": \\"name\\",
     \\"name\\": \\"x\\",
     \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 1}}},
   null],
  \\"body\\":
   {\\"tag\\": \\"return_statement\\",
    \\"expression\\":
     {\\"tag\\": \\"name\\",
      \\"name\\": \\"x\\",
      \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}}},
    \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}}},
  \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 5}}},
null]"
`)
})

test('String representation with default (2 space) indent', () => {
  return expectResult(
    stripIndent`
  stringify(parse('x=>x;'));
  `,
    4
  ).toMatchInlineSnapshot(`
"[ { \\"tag\\": \\"function_definition\\",
    \\"parameters\\":
      [ { \\"tag\\": \\"name\\",
          \\"name\\": \\"x\\",
          \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 1}} },
      null ],
    \\"body\\":
      { \\"tag\\": \\"return_statement\\",
        \\"expression\\":
          { \\"tag\\": \\"name\\",
            \\"name\\": \\"x\\",
            \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}} },
        \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}} },
    \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 5}} },
null ]"
`)
})

test('String representation with more than 10 space indent should trim to 10 space indent', () => {
  return expectResult(
    stripIndent`
  stringify(parse('x=>x;'), 100);
  `,
    4
  ).toMatchInlineSnapshot(`
"[         {         \\"tag\\": \\"function_definition\\",
                    \\"parameters\\":
                              [         {         \\"tag\\": \\"name\\",
                                                  \\"name\\": \\"x\\",
                                                  \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 1}}         },
                              null         ],
                    \\"body\\":
                              {         \\"tag\\": \\"return_statement\\",
                                        \\"expression\\":
                                                  {         \\"tag\\": \\"name\\",
                                                            \\"name\\": \\"x\\",
                                                            \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}}         },
                                        \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}}         },
                    \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 5}}         },
null         ]"
`)
})

test('String representation with custom indent', () => {
  return expectResult(
    stripIndent`
  stringify(parse('x=>x;'), ' ... ');
  `,
    4
  ).toMatchInlineSnapshot(`
"[... {... \\"tag\\": \\"function_definition\\",
 ...  ... \\"parameters\\":
 ...  ...  ... [... {... \\"tag\\": \\"name\\",
 ...  ...  ...  ...  ... \\"name\\": \\"x\\",
 ...  ...  ...  ...  ... \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 1}} ...},
 ...  ...  ... null ...],
 ...  ... \\"body\\":
 ...  ...  ... {... \\"tag\\": \\"return_statement\\",
 ...  ...  ...  ... \\"expression\\":
 ...  ...  ...  ...  ... {... \\"tag\\": \\"name\\",
 ...  ...  ...  ...  ...  ... \\"name\\": \\"x\\",
 ...  ...  ...  ...  ...  ... \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}} ...},
 ...  ...  ...  ... \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}} ...},
 ...  ... \\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 5}} ...},
null ...]"
`)
})

test('String representation with long custom indent gets trimmed to 10 characters', () => {
  return expectResult(
    stripIndent`
  stringify(parse('x=>x;'), '.................................');
  `,
    4
  ).toMatchInlineSnapshot(`
"[.........{.........\\"tag\\": \\"function_definition\\",
....................\\"parameters\\":
..............................[.........{.........\\"tag\\": \\"name\\",
..................................................\\"name\\": \\"x\\",
..................................................\\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 1}}.........},
..............................null.........],
....................\\"body\\":
..............................{.........\\"tag\\": \\"return_statement\\",
........................................\\"expression\\":
..................................................{.........\\"tag\\": \\"name\\",
............................................................\\"name\\": \\"x\\",
............................................................\\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}}.........},
........................................\\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 3}, \\"end\\": {\\"line\\": 1, \\"column\\": 4}}.........},
....................\\"loc\\": {\\"start\\": {\\"line\\": 1, \\"column\\": 0}, \\"end\\": {\\"line\\": 1, \\"column\\": 5}}.........},
null.........]"
`)
})
// tslint:enable:max-line-length
