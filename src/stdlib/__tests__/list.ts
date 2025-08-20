import { describe, expect, it, test } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testFailure, testSuccess } from '../../utils/testing'

test('list creates list', () => {
  return expect(testSuccess(
    stripIndent`
    function f() { return 1; }
    list(1, 'a string ""', () => f, f, true, 3.14);
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`
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
  return expect(testSuccess(
    stripIndent`
    pair(1, 'a string ""');
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`
            Array [
              1,
              "a string \\"\\"",
            ]
          `)
})

test('head works', () => {
  return expect(testSuccess(
    stripIndent`
    head(pair(1, 'a string ""'));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`1`)
})

test('tail works', () => {
  return expect(testSuccess(
    stripIndent`
    tail(pair(1, 'a string ""'));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`"a string \\"\\""`)
})

test('tail of a 1 element list is null', () => {
  return expect(testSuccess(
    stripIndent`
    tail(list(1));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`null`)
})

test('empty list is null', () => {
  return expect(testSuccess(
    stripIndent`
    list();
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot('null')
})

test('equal', () => {
  return expect(testSuccess(
    stripIndent`
  !equal(1, x => x) && !equal(x => x, 1);
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('for_each', () => {
  return expect(testSuccess(
    stripIndent`
    let sum = 0;
    for_each(x => {
      sum = sum + x;
    }, list(1, 2, 3));
    sum;
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`6`)
})

test('map', () => {
  return expect(testSuccess(
    stripIndent`
    equal(map(x => 2 * x, list(12, 11, 3)), list(24, 22, 6));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('filter', () => {
  return expect(testSuccess(
    stripIndent`
    equal(filter(x => x <= 4, list(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000)), list(2, 1, 3, 4, 2));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('build_list', () => {
  return expect(testSuccess(
    stripIndent`
    equal(build_list(x => x * x, 5), list(0, 1, 4, 9, 16));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('reverse', () => {
  return expect(testSuccess(
    stripIndent`
    equal(reverse(list("string", "null", "undefined", "null", 123)), list(123, "null", "undefined", "null", "string"));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('append', () => {
  return expect(testSuccess(
    stripIndent`
    equal(append(list(123, 123), list(456, 456, 456)), list(123, 123, 456, 456, 456));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('member', () => {
  return expect(testSuccess(
    stripIndent`
    equal(
      member(4, list(1, 2, 3, 4, 123, 456, 789)),
      list(4, 123, 456, 789));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('remove', () => {
  return expect(testSuccess(
    stripIndent`
    remove(1, list(1));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`null`)
})

test('remove not found', () => {
  return expect(testSuccess(
    stripIndent`
    remove(2, list(1));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`
            Array [
              1,
              null,
            ]
          `)
})

test('remove_all', () => {
  return expect(testSuccess(
    stripIndent`
    equal(remove_all(1, list(1, 2, 3, 4, 1, 1, 1, 5, 1, 1, 6)), list(2, 3, 4, 5, 6));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('remove_all not found', () => {
  return expect(testSuccess(
    stripIndent`
    equal(remove_all(1, list(2, 3, 4)), list(2, 3, 4));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('enum_list', () => {
  return expect(testSuccess(
    stripIndent`
    equal(enum_list(1, 5), list(1, 2, 3, 4, 5));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('enum_list with floats', () => {
  return expect(testSuccess(
    stripIndent`
    equal(enum_list(1.5, 5), list(1.5, 2.5, 3.5, 4.5));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('list_ref', () => {
  return expect(testSuccess(
    stripIndent`
    list_ref(list(1, 2, 3, "4", 4), 4);
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`4`)
})

test('accumulate', () => {
  return expect(testSuccess(
    stripIndent`
    accumulate((curr, acc) => curr + acc, 0, list(2, 3, 4, 1));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`10`)
})

test('list_to_string', () => {
  return expect(testSuccess(
    stripIndent`
    list_to_string(list(1, 2, 3));
  `,
    { chapter: Chapter.SOURCE_2 }
  )).resolves.toMatchInlineSnapshot(`"[1,[2,[3,null]]]"`)
})

describe('accumulate', () => {
  test('works properly', () => {
    return expect(testSuccess(
      stripIndent`
      accumulate((curr, acc) => curr + acc, 0, list(2, 3, 4, 1));
    `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(`10`)
  })

  it('works from right to left', () => {
    return expect(testSuccess(
      stripIndent`
      accumulate((curr, acc) => curr + acc, '1', list('4','3','2'));`,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot('"4321"')
  })
})

describe('length', () => {
  test('works with populated lists', () => {
    return expect(testSuccess(
      stripIndent`
      const xs = list(1,2,3,4);
      length(xs);
      `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot('4')
  })

  test('works with empty lists', () => {
    return expect(testSuccess(
      stripIndent`
      const xs = list();
      length(xs);
      `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot('0')
  })
})

// assoc removed from Source
test.skip('assoc', () => {
  return expect(testSuccess(
    stripIndent`
    equal(assoc(3, list(pair(1, 2), pair(3, 4))), pair(3, 4));
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test.skip('assoc not found', () => {
  return expect(testSuccess(
    stripIndent`
    equal(assoc(2, list(pair(1, 2), pair(3, 4))), false);
  `,
    { chapter: Chapter.LIBRARY_PARSER }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('set_head', () => {
  return expect(testSuccess(
    stripIndent`
    let p = pair(1, 2);
    const q = p;
    set_head(p, 3);
    p === q && equal(p, pair(3, 2));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('set_tail', () => {
  return expect(testSuccess(
    stripIndent`
    let p = pair(1, 2);
    const q = p;
    set_tail(p, 3);
    p === q && equal(p, pair(1, 3));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('non-list error head', () => {
  return expect(testFailure(
    stripIndent`
    head([1, 2, 3]);
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

test('non-list error tail', () => {
  return expect(testFailure(
    stripIndent`
    tail([1, 2, 3]);
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(
    `"Line 1: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
  )
})

describe('These tests are reporting weird line numbers, as list functions are now implemented in Source.', () => {
  test('non-list error length', () => {
    return expect(testFailure(
      stripIndent`
    length([1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 33: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error map', () => {
    return expect(testFailure(
      stripIndent`
    map(x=>x, [1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 47: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error for_each', () => {
    return expect(testFailure(
      stripIndent`
    for_each(x=>x, [1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 76: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error reverse', () => {
    return expect(testFailure(
      stripIndent`
    reverse([1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 106: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error append', () => {
    return expect(testFailure(
      stripIndent`
    append([1, 2, 3], list(1, 2, 3));
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 121: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error member', () => {
    return expect(testFailure(
      stripIndent`
    member(1, [1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 136: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error remove', () => {
    return expect(testFailure(
      stripIndent`
    remove(1, [1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 151: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error remove_all', () => {
    return expect(testFailure(
      stripIndent`
    remove_all(1, [1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 169: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error assoc', () => {
    return expect(testFailure(
      stripIndent`
    assoc(1, [1, 2, 3]);
  `,
      { chapter: Chapter.LIBRARY_PARSER }
    )).resolves.toMatchInlineSnapshot(`"Line 1: Name assoc not declared."`)
  })

  test('non-list error filter', () => {
    return expect(testFailure(
      stripIndent`
    filter(x => true, [1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 185: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error accumulate', () => {
    return expect(testFailure(
      stripIndent`
    accumulate((x, y) => x + y, [1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(`"Line 1: Expected 3 arguments, but got 2."`)
  })

  test('non-list error accumulate', () => {
    return expect(testFailure(
      stripIndent`
    accumulate((x, y) => x + y, [1, 2, 3]);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(`"Line 1: Expected 3 arguments, but got 2."`)
  })

  test('non-list error set_head', () => {
    return expect(testFailure(
      stripIndent`
    set_head([1, 2, 3], 4);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 1: Error: set_head(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  test('non-list error set_tail', () => {
    return expect(testFailure(
      stripIndent`
    set_tail([1, 2, 3], 4);
  `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 1: Error: set_tail(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]"`
    )
  })

  // skipped as implementation does not check types, causing infinite recursion.
  test.skip('bad number error build_list', () => {
    return expect(testFailure(
      stripIndent`
    build_list(x => x, -1);
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 1: Error: build_list(fun, n) expects a positive integer as argument n, but encountered -1"`
    )
  })

  // skipped as implementation does not check types, causing infinite recursion.
  test.skip('bad number error build_list', () => {
    return expect(testFailure(
      stripIndent`
    build_list(x => x, 1.5);
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 1: Error: build_list(fun, n) expects a positive integer as argument n, but encountered 1.5"`
    )
  })

  test('bad number error build_list', () => {
    return expect(testFailure(
      stripIndent`
    build_list(x => x, '1');
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 63: Expected number on left hand side of operation, got string."`
    )
  })

  test('bad number error enum_list', () => {
    return expect(testFailure(
      stripIndent`
    enum_list('1', '5');
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 203: Expected string on right hand side of operation, got number."`
    )
  })

  test('bad number error enum_list', () => {
    return expect(testFailure(
      stripIndent`
    enum_list('1', 5);
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 201: Expected string on right hand side of operation, got number."`
    )
  })

  test('bad number error enum_list', () => {
    return expect(testFailure(
      stripIndent`
    enum_list(1, '5');
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 201: Expected number on right hand side of operation, got string."`
    )
  })

  test('bad index error list_ref', () => {
    return expect(testFailure(
      stripIndent`
    list_ref(list(1, 2, 3), 3);
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 216: Error: head(xs) expects a pair as argument xs, but encountered null"`
    )
  })

  test('bad index error list_ref', () => {
    return expect(testFailure(
      stripIndent`
    list_ref(list(1, 2, 3), -1);
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 217: Error: tail(xs) expects a pair as argument xs, but encountered null"`
    )
  })

  test('bad index error list_ref', () => {
    return expect(testFailure(
      stripIndent`
    list_ref(list(1, 2, 3), 1.5);
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 217: Error: tail(xs) expects a pair as argument xs, but encountered null"`
    )
  })

  test('bad index error list_ref', () => {
    return expect(testFailure(
      stripIndent`
    list_ref(list(1, 2, 3), '1');
  `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 215: Expected string on right hand side of operation, got number."`
    )
  })
})

describe('display_list', () => {
  test('standard acyclic', async () => {
    const { context } = await testSuccess(
      stripIndent`
        display_list(build_list(i => i, 5));
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_2 }
    )
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list(0, 1, 2, 3, 4)",
]
`)
  })

  test('standard acyclic 2', async () => {
    const { context } = await testSuccess(
      stripIndent`
        display_list(build_list(i => build_list(j => j, i), 5));
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_2 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list(null, list(0), list(0, 1), list(0, 1, 2), list(0, 1, 2, 3))",
]
`)
  })

  test('standard acyclic with pairs', async () => {
    const { context } = await testSuccess(
      stripIndent`
        display_list(build_list(i => build_list(j => pair(j, j), i), 5));
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_2 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list(null,
     list([0, 0]),
     list([0, 0], [1, 1]),
     list([0, 0], [1, 1], [2, 2]),
     list([0, 0], [1, 1], [2, 2], [3, 3]))",
]
`)
  })

  test('standard acyclic with pairs 2', async () => {
    const { context } = await testSuccess(
      stripIndent`
        display_list(build_list(i => build_list(j => pair(build_list(k => k, j), j), i), 5));
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_2 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list(null,
     list([null, 0]),
     list([null, 0], [list(0), 1]),
     list([null, 0], [list(0), 1], [list(0, 1), 2]),
     list([null, 0], [list(0), 1], [list(0, 1), 2], [list(0, 1, 2), 3]))",
]
`)
  })

  test('returns argument', () => {
    return expect(testSuccess(
      stripIndent`
        const xs = build_list(i => i, 5);
        xs === display_list(xs);
        // Note reference equality
      `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(`true`)
  })

  test('returns cyclic argument', () => {
    return expect(testSuccess(
      stripIndent`
        const build_inf = (i, f) => {
          const t = list(f(i));
          let p = t;
          for (let n = i - 1; n >= 0; n = n - 1) {
            p = pair(f(n), p);
          }
          set_tail(t, p);
          return p;
        };
        const xs = build_inf(5, i=>i);
        xs === display_list(xs);
        // Note reference equality
      `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(`true`)
  })

  test('supports prepend string', async () => {
    const { context } = await testSuccess(
      stripIndent`
        display_list(build_list(i => i, 5), "build_list:");
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_2 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "build_list: list(0, 1, 2, 3, 4)",
]
`)
  })

  test('checks prepend type', () => {
    return expect(testFailure(
      stripIndent`
        display_list(build_list(i => i, 5), true);
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_2 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 1: TypeError: display_list expects the second argument to be a string"`
    )
  })

  /**************
   * FUZZ TESTS *
   **************/

  test('MCE fuzz test', async () => {
    const { context } = await testSuccess(
      stripIndent`
        display_list(parse('const twice = f => x => {const result = f(f(x)); return two;};'));
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_4 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list(\\"constant_declaration\\",
     list(\\"name\\", \\"twice\\"),
     list(\\"lambda_expression\\",
          list(list(\\"name\\", \\"f\\")),
          list(\\"return_statement\\",
               list(\\"lambda_expression\\",
                    list(list(\\"name\\", \\"x\\")),
                    list(\\"block\\",
                         list(\\"sequence\\",
                              list(list(\\"constant_declaration\\",
                                        list(\\"name\\", \\"result\\"),
                                        list(\\"application\\",
                                             list(\\"name\\", \\"f\\"),
                                             list(list(\\"application\\", list(\\"name\\", \\"f\\"), list(list(\\"name\\", \\"x\\")))))),
                                   list(\\"return_statement\\", list(\\"name\\", \\"two\\")))))))))",
]
`)
  })

  test('standard acyclic multiline', async () => {
    const { context } = await testSuccess(
      stripIndent`
        display_list(build_list(i => build_list(j => j, i), 20));
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_2 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list(null,
     list(0),
     list(0, 1),
     list(0, 1, 2),
     list(0, 1, 2, 3),
     list(0, 1, 2, 3, 4),
     list(0, 1, 2, 3, 4, 5),
     list(0, 1, 2, 3, 4, 5, 6),
     list(0, 1, 2, 3, 4, 5, 6, 7),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17),
     list(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18))",
]
`)
  })

  test('infinite list', async () => {
    const { context }  = await testSuccess(
      stripIndent`
        const p = list(1);
        set_tail(p, p);
        display_list(p);
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_3 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "[1, ...<circular>]",
]
`)
  })

  test('infinite list 2', async () => {
    const { context } = await testSuccess(
      stripIndent`
        const p = list(1, 2, 3);
        set_tail(tail(tail(p)), p);
        display_list(p);
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_3 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "[1, [2, [3, ...<circular>]]]",
]
`)
  })

  test('reusing lists', async () => {
    const { context } = await testSuccess(
      stripIndent`
        const p = list(1);
        const p2 = pair(p, p);
        const p3 = list(p, p2);
        display_list(p3);
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_2 }
    )
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list(list(1), list(list(1), 1))",
]
`)
  })

  test('reusing lists 2', async () => {
    const { context } = await testSuccess(
      stripIndent`
        const p1 = pair(1, null);
        const p2 = pair(2, p1);
        const p3 = list(p1, p2);
        display_list(p3);
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_2 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list(list(1), list(2, 1))",
]
`)
  })
  test('list of infinite list', async () => {
    const { context } = await testSuccess(
      stripIndent`
        const build_inf = i => {
          const t = list(i);
          let p = t;
          for (let n = i - 1; n >= 0; n = n - 1) {
            p = pair(n, p);
          }
          set_tail(t, p);
          return p;
        };
        display_list(build_list(build_inf, 5));
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_3 }
    )
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list([0, ...<circular>],
     [0, [1, ...<circular>]],
     [0, [1, [2, ...<circular>]]],
     [0, [1, [2, [3, ...<circular>]]]],
     [0, [1, [2, [3, [4, ...<circular>]]]]])",
]
`)
  })

  test('list of infinite list of list', async () => {
    const { context } = await testSuccess(
      stripIndent`
        const build_inf = (i, f) => {
          const t = list(f(i));
          let p = t;
          for (let n = i - 1; n >= 0; n = n - 1) {
            p = pair(f(n), p);
          }
          set_tail(t, p);
          return p;
        };
        display_list(build_list(i => build_inf(i, i => build_list(i => i, i)), 3));
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_3 }
    )
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "list([null, ...<circular>],
     [null, [list(0), ...<circular>]],
     [null, [list(0), [list(0, 1), ...<circular>]]])",
]
`)
  })

  test('infinite list of list of infinite list', async () => {
    const { context } = await testSuccess(
      stripIndent`
        const build_inf = (i, f) => {
          const t = list(f(i));
          let p = t;
          for (let n = i - 1; n >= 0; n = n - 1) {
            p = pair(f(n), p);
          }
          set_tail(t, p);
          return p;
        };
        display_list(build_inf(3, i => build_list(i => build_inf(i, i=>i), i)));
        0; // suppress long result in snapshot
      `,
      { chapter: Chapter.SOURCE_3 }
    )
    
    expect(context.displayResult).toMatchInlineSnapshot(`
Array [
  "[ null,
[ list([0, ...<circular>]),
[ list([0, ...<circular>], [0, [1, ...<circular>]]),
[ list([0, ...<circular>], [0, [1, ...<circular>]], [0, [1, [2, ...<circular>]]]),
...<circular>]]]]",
]
`)
  })
})
