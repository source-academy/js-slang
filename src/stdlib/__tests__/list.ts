import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import {
  expectDisplayResult,
  expectParsedError,
  expectParsedErrorsToEqual,
  expectResult,
  expectResultsToEqual
} from '../../utils/testing/testers'

test('list creates list', () => {
  return expectResult(
    stripIndent`
    function f() { return 1; }
    list(1, 'a string ""', () => f, f, true, 3.14);
  `,
    Chapter.SOURCE_2
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

describe('Test regular functions', () => {
  expectResultsToEqual(
    [
      ['pair creates pair', 'pair(1, \'a string ""\');', [1, 'a string ""']],
      [
        'head()',
        `head(pair(1, 'a string ""'));`,
        1
      ],
      [
        'tail() works',
        `tail(pair(1, 'a string ""'));`,
        'a string ""'
      ],
      [
        'tail of a 1 element list is null',
        'tail(list(1));',
        null
      ],
      [
        'empty list is null',
        'list();',
        null
      ],
      [
        'accumulate',
        'accumulate((curr, acc) => curr + acc, 0, list(2, 3, 4, 1));',
        10,
      ],
      [
        'accumulate works right to left',
        `accumulate((curr, acc) => curr + acc, '1', list('4','3','2'));`,
        '4321'
      ],
      [
        'append',
        'equal(append(list(123, 123), list(456, 456, 456)), list(123, 123, 456, 456, 456));',
        true
      ],
      [
        'build_list',
        'equal(build_list(x => x * x, 5), list(0, 1, 4, 9, 16));',
        true
      ],
      [
        'enum_list',
        'equal(enum_list(1, 5), list(1, 2, 3, 4, 5));',
        true
      ],
      [
        'enum_list with floats',
        'equal(enum_list(1.5, 5), list(1.5, 2.5, 3.5, 4.5));',
        true
      ],
      [
        'filter',
        'equal(filter(x => x <= 4, list(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000)), list(2, 1, 3, 4, 2));',
        true
      ],
      [
        'for_each',
        `
          let sum = 0;
          for_each(x => {
            sum = sum + x;
          }, list(1, 2, 3));
          sum;
        `,
        6
      ],
      [
        'length works with populated lists',
        'length(list(1,2,3,4));',
        4
      ],
      [
        'length works with empty lists',
        'length(list());',
        0
      ],
      [
        'list_ref',
        'list_ref(list(1, 2, 3, "4", 4), 4);',
        4
      ],
      [
        'list_to_string',
        'list_to_string(list(1, 2, 3));',
        "[1,[2,[3,null]]]"
      ],
      [
        'map',
        'equal(map(x => 2 * x, list(12, 11, 3)), list(24, 22, 6));',
        true
      ],
      [
        'member',
        `
          equal(
            member(4, list(1, 2, 3, 4, 123, 456, 789)),
            list(4, 123, 456, 789));
        `,
        true
      ],
      [
        'remove',
        'remove(1, list(1));',
        null
      ],
      [
        'remove not found',
        'remove(2, list(1));',
        [1, null]
      ],
      [
        'remove_all',
        'equal(remove_all(1, list(2, 3, 4)), list(2, 3, 4));',
        true
      ],
      [
        'remove_all not found',
        'equal(remove_all(1, list(2, 3, 4)), list(2, 3, 4));',
        true
      ],
      [
        'reverse',
        'equal(reverse(list("string", "null", "undefined", "null", 123)), list(123, "null", "undefined", "null", "string"));',
        true
      ],
      [
        'set_head',
        `
          let p = pair(1, 2);
          const q = p;
          set_head(p, 3);
          p === q && equal(p, pair(3, 2));
        `,
        true
      ],
      [
        'set_tail',
        `
          let p = pair(1, 2);
          const q = p;
          set_tail(p, 3);
          p === q && equal(p, pair(1, 3));
        `,
        true
      ]
    ],
    Chapter.SOURCE_3
  )
})

describe('Test errors', () => {
  expectParsedErrorsToEqual([
    [
      'non-list error head',
      'head([1, 2, 3]);',
      "Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
    ],
    [
      'non-list error tail',
      'tail([1, 2, 3]);',
      "Line 1: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
    ]
  ], Chapter.SOURCE_3)

  describe('These tests are reporting weird line numbers, as list functions are now implemented in Source.', () => {
    expectParsedErrorsToEqual([
      [
        'non-list error accumulate',
        'accumulate((x, y) => x + y, [1, 2, 3]);',
        "Line 1: Expected 3 arguments, but got 2."
      ],
      [
        'non-list error append',
        'append([1, 2, 3], list(1, 2, 3));',
        "Line 121: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error filter',
        'filter(x => true, [1, 2, 3]);',
        "Line 185: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error for_each',
        'for_each(x=>x, [1, 2, 3]);',
        "Line 76: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error length',
        'length([1, 2, 3]);',
        "Line 33: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error map',
        'map(x=>x, [1, 2, 3]);',
        "Line 47: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error member',
        'member(1, [1, 2, 3]);',
        "Line 136: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error remove',
        'remove(1, [1, 2, 3]);',
        "Line 151: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error remove_all',
        'remove_all(1, [1, 2, 3]);',
        "Line 169: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error reverse',
        'reverse([1, 2, 3]);',
        "Line 106: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error set_head',
        'set_head([1, 2, 3], 4);',
        "Line 1: Error: set_head(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],
      [
        'non-list error set_tail',
        'set_tail([1, 2, 3], 4);',
        "Line 1: Error: set_tail(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]"
      ],

      // skipped as implementation does not check types, causing infinite recursion.
      // [
      //   'bad number error build_list',
      //   'build_list(x => x, -1);',
      //   "Line 1: Error: build_list(fun, n) expects a positive integer as argument n, but encountered -1"
      // ],
      // [
      //   'bad number error build_list',
      //   'build_list(x => x, 1.5);',
      //   "Line 1: Error: build_list(fun, n) expects a positive integer as argument n, but encountered -1"
      // ]
      [
        'bad number error build_list',
        "build_list(x => x, '1');",
        "Line 63: Expected number on left hand side of operation, got string."
      ],
      [
        'bad number error enum_list 1',
        "enum_list('1', '5');",
        "Line 203: Expected string on right hand side of operation, got number."
      ],
      [
        'bad number error enum_list 2',
        "enum_list('1', 5);",
        "Line 201: Expected string on right hand side of operation, got number."
      ],
      [
        'bad number error enum_list 3',
        "enum_list(1, '5');",
        "Line 201: Expected number on right hand side of operation, got string."
      ],
      [
        'bad index error list_ref 1',
        'list_ref(list(1, 2, 3), 3);',
        "Line 216: Error: head(xs) expects a pair as argument xs, but encountered null"
      ],
      [
        'bad index error list_ref 2',
        'list_ref(list(1, 2, 3), -1);',
        "Line 217: Error: tail(xs) expects a pair as argument xs, but encountered null"
      ],
      [
        'bad index error list_ref 3',
        'list_ref(list(1, 2, 3), -1);',
        "Line 217: Error: tail(xs) expects a pair as argument xs, but encountered null"
      ],
      [
        'bad index error list_ref 4',
        'list_ref(list(1, 2, 3), "1");',
        "Line 215: Expected string on right hand side of operation, got number."
      ]
    ], Chapter.SOURCE_3)
  })
})

describe('display_list', () => {
  test('standard acyclic', () => {
    return expectDisplayResult(
      stripIndent`
        display_list(build_list(i => i, 5));
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    ).toMatchInlineSnapshot(`
              Array [
                "list(0, 1, 2, 3, 4)",
              ]
            `)
  })

  test('standard acyclic 2', () => {
    return expectDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => j, i), 5));
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    ).toMatchInlineSnapshot(`
              Array [
                "list(null, list(0), list(0, 1), list(0, 1, 2), list(0, 1, 2, 3))",
              ]
            `)
  })

  test('standard acyclic with pairs', () => {
    return expectDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => pair(j, j), i), 5));
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    ).toMatchInlineSnapshot(`
              Array [
                "list(null,
                   list([0, 0]),
                   list([0, 0], [1, 1]),
                   list([0, 0], [1, 1], [2, 2]),
                   list([0, 0], [1, 1], [2, 2], [3, 3]))",
              ]
            `)
  })

  test('standard acyclic with pairs 2', () => {
    return expectDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => pair(build_list(k => k, j), j), i), 5));
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    ).toMatchInlineSnapshot(`
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
    return expectResult(
      stripIndent`
        const xs = build_list(i => i, 5);
        xs === display_list(xs);
        // Note reference equality
      `,
      Chapter.SOURCE_3
    ).toMatchInlineSnapshot(`true`)
  })

  test('returns cyclic argument', () => {
    return expectResult(
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
      Chapter.SOURCE_3
    ).toMatchInlineSnapshot(`true`)
  })

  test('supports prepend string', () => {
    return expectDisplayResult(
      stripIndent`
        display_list(build_list(i => i, 5), "build_list:");
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    ).toMatchInlineSnapshot(`
              Array [
                "build_list: list(0, 1, 2, 3, 4)",
              ]
            `)
  })

  test('checks prepend type', () => {
    return expectParsedError(
      stripIndent`
        display_list(build_list(i => i, 5), true);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    ).toMatchInlineSnapshot(
      `"Line 1: TypeError: display_list expects the second argument to be a string"`
    )
  })

  /**************
   * FUZZ TESTS *
   **************/

  test('MCE fuzz test', () => {
    return expectDisplayResult(
      stripIndent`
        display_list(parse('const twice = f => x => {const result = f(f(x)); return two;};'));
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_4
    ).toMatchInlineSnapshot(`
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

  test('standard acyclic multiline', () => {
    return expectDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => j, i), 20));
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    ).toMatchInlineSnapshot(`
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

  test('infinite list', () => {
    return expectDisplayResult(
      stripIndent`
        const p = list(1);
        set_tail(p, p);
        display_list(p);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_3
    ).toMatchInlineSnapshot(`
              Array [
                "[1, ...<circular>]",
              ]
            `)
  })

  test('infinite list 2', () => {
    return expectDisplayResult(
      stripIndent`
        const p = list(1, 2, 3);
        set_tail(tail(tail(p)), p);
        display_list(p);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_3
    ).toMatchInlineSnapshot(`
              Array [
                "[1, [2, [3, ...<circular>]]]",
              ]
            `)
  })

  test('reusing lists', () => {
    return expectDisplayResult(
      stripIndent`
        const p = list(1);
        const p2 = pair(p, p);
        const p3 = list(p, p2);
        display_list(p3);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    ).toMatchInlineSnapshot(`
              Array [
                "list(list(1), list(list(1), 1))",
              ]
            `)
  })

  test('reusing lists 2', () => {
    return expectDisplayResult(
      stripIndent`
        const p1 = pair(1, null);
        const p2 = pair(2, p1);
        const p3 = list(p1, p2);
        display_list(p3);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    ).toMatchInlineSnapshot(`
              Array [
                "list(list(1), list(2, 1))",
              ]
            `)
  })
  test('list of infinite list', () => {
    return expectDisplayResult(
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
      Chapter.SOURCE_3
    ).toMatchInlineSnapshot(`
              Array [
                "list([0, ...<circular>],
                   [0, [1, ...<circular>]],
                   [0, [1, [2, ...<circular>]]],
                   [0, [1, [2, [3, ...<circular>]]]],
                   [0, [1, [2, [3, [4, ...<circular>]]]]])",
              ]
            `)
  })

  test('list of infinite list of list', () => {
    return expectDisplayResult(
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
      Chapter.SOURCE_3
    ).toMatchInlineSnapshot(`
              Array [
                "list([null, ...<circular>],
                   [null, [list(0), ...<circular>]],
                   [null, [list(0), [list(0, 1), ...<circular>]]])",
              ]
            `)
  })

  test('infinite list of list of infinite list', () => {
    return expectDisplayResult(
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
      Chapter.SOURCE_3
    ).toMatchInlineSnapshot(`
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
