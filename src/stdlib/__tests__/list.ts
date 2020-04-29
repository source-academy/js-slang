import { stripIndent } from '../../utils/formatters'
import { expectParsedError, expectResult } from '../../utils/testing'

test('list creates list', () => {
  return expectResult(
    stripIndent`
    function f() { return 1; }
    list(1, 'a string ""', () => f, f, true, 3.14);
  `,
    { chapter: 2, native: true }
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
    { chapter: 2, native: true }
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
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`1`)
})

test('tail works', () => {
  return expectResult(
    stripIndent`
    tail(pair(1, 'a string ""'));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`"a string \\"\\""`)
})

test('tail of a 1 element list is null', () => {
  return expectResult(
    stripIndent`
    tail(list(1));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`null`)
})

test('empty list is null', () => {
  return expectResult(
    stripIndent`
    list();
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot('null')
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
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(`6`)
})

test('map', () => {
  return expectResult(
    stripIndent`
    equal(map(x => 2 * x, list(12, 11, 3)), list(24, 22, 6));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('filter', () => {
  return expectResult(
    stripIndent`
    equal(filter(x => x <= 4, list(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000)), list(2, 1, 3, 4, 2));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('build_list', () => {
  return expectResult(
    stripIndent`
    equal(build_list(5, x => x * x), list(0, 1, 4, 9, 16));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('reverse', () => {
  return expectResult(
    stripIndent`
    equal(reverse(list("string", null, undefined, null, 123)), list(123, null, undefined, null, "string"));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('append', () => {
  return expectResult(
    stripIndent`
    equal(append(list("string", 123), list(456, null, undefined)), list("string", 123, 456, null, undefined));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('member', () => {
  return expectResult(
    stripIndent`
    equal(
      member("string", list(1, 2, 3, "string", 123, 456, null, undefined)),
      list("string", 123, 456, null, undefined));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('remove', () => {
  return expectResult(
    stripIndent`
    remove(1, list(1));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`null`)
})

test('remove not found', () => {
  return expectResult(
    stripIndent`
    remove(2, list(1));
  `,
    { chapter: 2, native: true }
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
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('remove_all not found', () => {
  return expectResult(
    stripIndent`
    equal(remove_all(1, list(2, 3, "1")), list(2, 3, "1"));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('enum_list', () => {
  return expectResult(
    stripIndent`
    equal(enum_list(1, 5), list(1, 2, 3, 4, 5));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('enum_list with floats', () => {
  return expectResult(
    stripIndent`
    equal(enum_list(1.5, 5), list(1.5, 2.5, 3.5, 4.5));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('list_ref', () => {
  return expectResult(
    stripIndent`
    list_ref(list(1, 2, 3, "4", 4), 4);
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`4`)
})

test('accumulate', () => {
  return expectResult(
    stripIndent`
    accumulate((curr, acc) => curr + acc, 0, list(2, 3, 4, 1));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`10`)
})

test('list_to_string', () => {
  return expectResult(
    stripIndent`
    list_to_string(list(1, 2, 3));
  `,
    { chapter: 2, native: true }
  ).toMatchInlineSnapshot(`"[1,[2,[3,null]]]"`)
})

// assoc removed from Source
test.skip('assoc', () => {
  return expectResult(
    stripIndent`
    equal(assoc(3, list(pair(1, 2), pair(3, 4))), pair(3, 4));
  `,
    { chapter: 100, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test.skip('assoc not found', () => {
  return expectResult(
    stripIndent`
    equal(assoc(2, list(pair(1, 2), pair(3, 4))), false);
  `,
    { chapter: 100, native: true }
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
    { chapter: 3, native: true }
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
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(`true`)
})

test('non-list error head', () => {
  return expectParsedError(
    stripIndent`
    head([1, 2, 3]);
  `,
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error tail', () => {
  return expectParsedError(
    stripIndent`
    tail([1, 2, 3]);
  `,
    { chapter: 3, native: true }
  ).toMatchInlineSnapshot(
    `"Line 1: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

describe('These tests are reporting weird line numbers, as list functions are now implemented in Source.', () => {
  test('non-list error length', () => {
    return expectParsedError(
      stripIndent`
    length([1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 24: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error map', () => {
    return expectParsedError(
      stripIndent`
    map(x=>x, [1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 33: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error for_each', () => {
    return expectParsedError(
      stripIndent`
    for_each(x=>x, [1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 58: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error reverse', () => {
    return expectParsedError(
      stripIndent`
    reverse([1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 80: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error append', () => {
    return expectParsedError(
      stripIndent`
    append([1, 2, 3], list(1, 2, 3));
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 91: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error member', () => {
    return expectParsedError(
      stripIndent`
    member(1, [1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 100: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error remove', () => {
    return expectParsedError(
      stripIndent`
    remove(1, [1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 108: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error remove_all', () => {
    return expectParsedError(
      stripIndent`
    remove_all(1, [1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 117: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error assoc', () => {
    return expectParsedError(
      stripIndent`
    assoc(1, [1, 2, 3]);
  `,
      { chapter: 100 }
    ).toMatchInlineSnapshot(`"Line 1: Name assoc not declared."`)
  })

  test('non-list error filter', () => {
    return expectParsedError(
      stripIndent`
    filter(x => true, [1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 129: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error accumulate', () => {
    return expectParsedError(
      stripIndent`
    accumulate((x, y) => x + y, [1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(`"Line 1: Expected 3 arguments, but got 2."`)
  })

  test('non-list error accumulate', () => {
    return expectParsedError(
      stripIndent`
    accumulate((x, y) => x + y, [1, 2, 3]);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(`"Line 1: Expected 3 arguments, but got 2."`)
  })

  test('non-list error set_head', () => {
    return expectParsedError(
      stripIndent`
    set_head([1, 2, 3], 4);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 1: Error: set_head(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error set_tail', () => {
    return expectParsedError(
      stripIndent`
    set_tail([1, 2, 3], 4);
  `,
      { chapter: 3, native: true }
    ).toMatchInlineSnapshot(
      `"Line 1: Error: set_tail(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  // skipped as implementation does not check types, causing infinite recursion.
  test.skip('bad number error build_list', () => {
    return expectParsedError(
      stripIndent`
    build_list(-1, x => x);
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 1: Error: build_list(n, fun) expects a positive integer as argument n, but encountered -1"`
    )
  })

  // skipped as implementation does not check types, causing infinite recursion.
  test.skip('bad number error build_list', () => {
    return expectParsedError(
      stripIndent`
    build_list(1.5, x => x);
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 1: Error: build_list(n, fun) expects a positive integer as argument n, but encountered 1.5"`
    )
  })

  test('bad number error build_list', () => {
    return expectParsedError(
      stripIndent`
    build_list('1', x => x);
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 45: Expected number on left hand side of operation, got string."`
    )
  })

  test('bad number error enum_list', () => {
    return expectParsedError(
      stripIndent`
    enum_list('1', '5');
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 139: Expected string on right hand side of operation, got number."`
    )
  })

  test('bad number error enum_list', () => {
    return expectParsedError(
      stripIndent`
    enum_list('1', 5);
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 139: Expected string on right hand side of operation, got number."`
    )
  })

  test('bad number error enum_list', () => {
    return expectParsedError(
      stripIndent`
    enum_list(1, '5');
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 139: Expected number on right hand side of operation, got string."`
    )
  })

  test('bad index error list_ref', () => {
    return expectParsedError(
      stripIndent`
    list_ref(list(1, 2, 3), 3);
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 147: Error: head(xs) expects a pair as argument xs, but encountered null"`
    )
  })

  test('bad index error list_ref', () => {
    return expectParsedError(
      stripIndent`
    list_ref(list(1, 2, 3), -1);
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 147: Error: tail(xs) expects a pair as argument xs, but encountered null"`
    )
  })

  test('bad index error list_ref', () => {
    return expectParsedError(
      stripIndent`
    list_ref(list(1, 2, 3), 1.5);
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 147: Error: tail(xs) expects a pair as argument xs, but encountered null"`
    )
  })

  test('bad index error list_ref', () => {
    return expectParsedError(
      stripIndent`
    list_ref(list(1, 2, 3), '1');
  `,
      { chapter: 2, native: true }
    ).toMatchInlineSnapshot(
      `"Line 147: Expected number on left hand side of operation, got string."`
    )
  })
})
