import { expectParsedError, expectResult, stripIndent } from '../../utils/testing'

test('list creates list', () => {
  return expectResult(
    stripIndent`
    function f() { return 1; }
    list(1, 'a string ""', () => a, f, true, 3.14);
  `,
    2
  ).toMatchInlineSnapshot(`
Array [
  1,
  Array [
    "a string \\"\\"",
    Array [
      [Function],
      Array [
        [Function],
        Array [
          true,
          Array [
            3.14,
            null,
          ],
        ],
      ],
    ],
  ],
]
`)
})

test('pair creates pair', () => {
  return expectResult(
    stripIndent`
    pair(1, 'a string ""');
  `,
    2
  ).toMatchInlineSnapshot(`
Array [
  1,
  "a string \\"\\"",
]
`)
})

test('head works', () => {
  return expectResult(
    stripIndent`
    head(pair(1, 'a string ""'));
  `,
    2
  ).toMatchInlineSnapshot(`1`)
})

test('tail works', () => {
  return expectResult(
    stripIndent`
    tail(pair(1, 'a string ""'));
  `,
    2
  ).toMatchInlineSnapshot(`"a string \\"\\""`)
})

test('tail of a 1 element list is null', () => {
  return expectResult(
    stripIndent`
    tail(list(1));
  `,
    2
  ).toMatchInlineSnapshot(`null`)
})

test('empty list is null', () => {
  return expectResult(
    stripIndent`
    list();
  `,
    2
  ).toMatchInlineSnapshot(`null`)
})

test('for_each', () => {
  return expectResult(
    stripIndent`
    let sum = 0;
    for_each(x => {
      sum = sum + x;
    }, list(1, 2, 3));
    sum;
  `,
    3
  ).toMatchInlineSnapshot(`6`)
})

test('map', () => {
  return expectResult(
    stripIndent`
    equal(map(x => 2 * x, list(12, 11, 3)), list(24, 22, 6));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('filter', () => {
  return expectResult(
    stripIndent`
    equal(filter(x => x <= 4, list(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000)), list(2, 1, 3, 4, 2));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('build_list', () => {
  return expectResult(
    stripIndent`
    equal(build_list(5, x => x * x), list(0, 1, 4, 9, 16));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('reverse', () => {
  return expectResult(
    stripIndent`
    equal(reverse(list("string", null, undefined, null, 123)), list(123, null, undefined, null, "string"));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('append', () => {
  return expectResult(
    stripIndent`
    equal(append(list("string", 123), list(456, null, undefined)), list("string", 123, 456, null, undefined));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('member', () => {
  return expectResult(
    stripIndent`
    equal(
      member("string", list(1, 2, 3, "string", 123, 456, null, undefined)),
      list("string", 123, 456, null, undefined));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('remove', () => {
  return expectResult(
    stripIndent`
    remove(1, list(1));
  `,
    2
  ).toMatchInlineSnapshot(`null`)
})

test('remove not found', () => {
  return expectResult(
    stripIndent`
    remove(2, list(1));
  `,
    2
  ).toMatchInlineSnapshot(`
Array [
  1,
  null,
]
`)
})

test('remove_all', () => {
  return expectResult(
    stripIndent`
    equal(remove_all(1, list(1, 2, 3, 4, 1, 1, "1", 5, 1, 1, 6)), list(2, 3, 4, "1", 5, 6));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('remove_all not found', () => {
  return expectResult(
    stripIndent`
    equal(remove_all(1, list(2, 3, "1")), list(2, 3, "1"));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('enum_list', () => {
  return expectResult(
    stripIndent`
    equal(enum_list(1, 5), list(1, 2, 3, 4, 5));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('enum_list with floats', () => {
  return expectResult(
    stripIndent`
    equal(enum_list(1.5, 5), list(1.5, 2.5, 3.5, 4.5));
  `,
    2
  ).toMatchInlineSnapshot(`true`)
})

test('list_ref', () => {
  return expectResult(
    stripIndent`
    list_ref(list(1, 2, 3, "4", 4), 4);
  `,
    2
  ).toMatchInlineSnapshot(`4`)
})

test('accumulate', () => {
  return expectResult(
    stripIndent`
    accumulate((curr, acc) => curr + acc, 0, list(2, 3, 4, 1));
  `,
    2
  ).toMatchInlineSnapshot(`10`)
})

test('list_to_string', () => {
  return expectResult(
    stripIndent`
    list_to_string(list(1, 2, 3));
  `,
    2
  ).toMatchInlineSnapshot(`"[1, [2, [3, null]]]"`)
})

test('assoc', () => {
  return expectResult(
    stripIndent`
    equal(assoc(3, list(pair(1, 2), pair(3, 4))), pair(3, 4));
  `,
    100
  ).toMatchInlineSnapshot(`true`)
})

test('assoc not found', () => {
  return expectResult(
    stripIndent`
    equal(assoc(2, list(pair(1, 2), pair(3, 4))), false);
  `,
    100
  ).toMatchInlineSnapshot(`true`)
})

test('set_head', () => {
  return expectResult(
    stripIndent`
    let p = pair(1, 2);
    const q = p;
    set_head(p, 3);
    p === q && equal(p, pair(3, 2));
  `,
    3
  ).toMatchInlineSnapshot(`true`)
})

test('set_tail', () => {
  return expectResult(
    stripIndent`
    let p = pair(1, 2);
    const q = p;
    set_tail(p, 3);
    p === q && equal(p, pair(1, 3));
  `,
    3
  ).toMatchInlineSnapshot(`true`)
})

test('non-list error head', () => {
  return expectParsedError(
    stripIndent`
    head([1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error tail', () => {
  return expectParsedError(
    stripIndent`
    tail([1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error length', () => {
  return expectParsedError(
    stripIndent`
    length([1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error map', () => {
  return expectParsedError(
    stripIndent`
    map(x=>x, [1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error for_each', () => {
  return expectParsedError(
    stripIndent`
    for_each(x=>x, [1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: for_each expects a list as argument xs, but encountered 1,2,3"`
  )
})

test('non-list error reverse', () => {
  return expectParsedError(
    stripIndent`
    reverse([1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: reverse(xs) expects a list as argument xs, but encountered 1,2,3"`
  )
})

test('non-list error append', () => {
  return expectParsedError(
    stripIndent`
    append([1, 2, 3], list(1, 2, 3));
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error member', () => {
  return expectParsedError(
    stripIndent`
    member(1, [1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error remove', () => {
  return expectParsedError(
    stripIndent`
    remove(1, [1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error remove_all', () => {
  return expectParsedError(
    stripIndent`
    remove_all(1, [1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error assoc', () => {
  return expectParsedError(
    stripIndent`
    assoc(1, [1, 2, 3]);
  `,
    100
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error filter', () => {
  return expectParsedError(
    stripIndent`
    filter(x => true, [1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error accumulate', () => {
  return expectParsedError(
    stripIndent`
    accumulate((x, y) => x + y, [1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered undefined"`
  )
})

test('non-list error accumulate', () => {
  return expectParsedError(
    stripIndent`
    accumulate((x, y) => x + y, [1, 2, 3]);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered undefined"`
  )
})

test('non-list error set_head', () => {
  return expectParsedError(
    stripIndent`
    set_head([1, 2, 3], 4);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: set_head(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error set_tail', () => {
  return expectParsedError(
    stripIndent`
    set_tail([1, 2, 3], 4);
  `,
    3
  ).toMatchInlineSnapshot(
    `"Line 1: Error: set_tail(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('bad number error build_list', () => {
  return expectParsedError(
    stripIndent`
    build_list(-1, x => x);
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: build_list(n, fun) expects a positive integer as argument n, but encountered -1"`
  )
})

test('bad number error build_list', () => {
  return expectParsedError(
    stripIndent`
    build_list(1.5, x => x);
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: build_list(n, fun) expects a positive integer as argument n, but encountered 1.5"`
  )
})

test('bad number error build_list', () => {
  return expectParsedError(
    stripIndent`
    build_list('1', x => x);
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: build_list(n, fun) expects a positive integer as argument n, but encountered 1"`
  )
})

test('bad number error enum_list', () => {
  return expectParsedError(
    stripIndent`
    enum_list('1', '5');
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: enum_list(start, end) expects a number as argument start, but encountered 1"`
  )
})

test('bad number error enum_list', () => {
  return expectParsedError(
    stripIndent`
    enum_list('1', 5);
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: enum_list(start, end) expects a number as argument start, but encountered 1"`
  )
})

test('bad number error enum_list', () => {
  return expectParsedError(
    stripIndent`
    enum_list(1, '5');
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: enum_list(start, end) expects a number as argument start, but encountered 5"`
  )
})

test('bad index error list_ref', () => {
  return expectParsedError(
    stripIndent`
    list_ref(list(1, 2, 3), 3);
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered null"`
  )
})

test('bad index error list_ref', () => {
  return expectParsedError(
    stripIndent`
    list_ref(list(1, 2, 3), -1);
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: list_ref(xs, n) expects a positive integer as argument n, but encountered -1"`
  )
})

test('bad index error list_ref', () => {
  return expectParsedError(
    stripIndent`
    list_ref(list(1, 2, 3), 1.5);
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: list_ref(xs, n) expects a positive integer as argument n, but encountered 1.5"`
  )
})

test('bad index error list_ref', () => {
  return expectParsedError(
    stripIndent`
    list_ref(list(1, 2, 3), '1');
  `,
    2
  ).toMatchInlineSnapshot(
    `"Line 1: Error: list_ref(xs, n) expects a positive integer as argument n, but encountered 1"`
  )
})
