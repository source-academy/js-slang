import { describe, expect, it, test } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { expectParsedError, expectFinishedResult, testSuccess } from '../../utils/testing'

test('list creates list', async () => {
  const {
    result: { value }
  } = await testSuccess(
    stripIndent`
      function f() { return 1; }
      list(1, 'a string ""', () => f, f, true, 3.14);
    `,
    Chapter.SOURCE_2
  )

  expect(value).toMatchInlineSnapshot(`
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

test('pair creates pair', async () => {
  const {
    result: { value }
  } = await testSuccess(`pair(1, 'a string ""');`, Chapter.SOURCE_2)

  expect(value).toMatchInlineSnapshot(`
    Array [
      1,
      "a string \\"\\"",
    ]
  `)
})

test('head works', () => {
  return expectFinishedResult(`head(pair(1, 'a string ""'));`, Chapter.SOURCE_2).toEqual(1)
})

test('tail works', () => {
  return expectFinishedResult(`tail(pair(1, 'a string ""'));`, Chapter.SOURCE_2).toEqual(
    'a string ""'
  )
})

test('tail of a 1 element list is null', () => {
  return expectFinishedResult(`tail(list(1));`, Chapter.SOURCE_2).toBeNull()
})

test('empty list is null', () => {
  return expectFinishedResult(`list();`, Chapter.SOURCE_2).toBeNull()
})

test('equal', () => {
  return expectFinishedResult(`!equal(1, x => x) && !equal(x => x, 1);`, Chapter.SOURCE_2).toEqual(
    true
  )
})

test('for_each', () => {
  return expectFinishedResult(
    stripIndent`
    let sum = 0;
    for_each(x => {
      sum = sum + x;
    }, list(1, 2, 3));
    sum;
  `,
    Chapter.SOURCE_3
  ).toEqual(6)
})

test('map', () => {
  return expectFinishedResult(
    stripIndent`
    equal(map(x => 2 * x, list(12, 11, 3)), list(24, 22, 6));
  `,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('filter', () => {
  return expectFinishedResult(
    stripIndent`
    equal(filter(x => x <= 4, list(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000)), list(2, 1, 3, 4, 2));
  `,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('build_list', () => {
  return expectFinishedResult(
    stripIndent`
    equal(build_list(x => x * x, 5), list(0, 1, 4, 9, 16));
  `,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('reverse', () => {
  return expectFinishedResult(
    `equal(reverse(list("string", "null", "undefined", "null", 123)), list(123, "null", "undefined", "null", "string")); `,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('append', () => {
  return expectFinishedResult(
    `equal(append(list(123, 123), list(456, 456, 456)), list(123, 123, 456, 456, 456));`,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('member', () => {
  return expectFinishedResult(
    stripIndent`
    equal(
      member(4, list(1, 2, 3, 4, 123, 456, 789)),
      list(4, 123, 456, 789)
    );
    `,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('remove', () => {
  return expectFinishedResult(`remove(1, list(1));`, Chapter.SOURCE_2).toBeNull()
})

test('remove not found', async () => {
  const {
    result: { value }
  } = await testSuccess(`remove(2, list(1));`, Chapter.SOURCE_2)
  expect(value).toMatchInlineSnapshot(`
    Array [
      1,
      null,
    ]
  `)
})

test('remove_all', () => {
  return expectFinishedResult(
    `equal(remove_all(1, list(1, 2, 3, 4, 1, 1, 1, 5, 1, 1, 6)), list(2, 3, 4, 5, 6));`,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('remove_all not found', () => {
  return expectFinishedResult(
    stripIndent`
    equal(remove_all(1, list(2, 3, 4)), list(2, 3, 4));
  `,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('enum_list', () => {
  return expectFinishedResult(
    stripIndent`
    equal(enum_list(1, 5), list(1, 2, 3, 4, 5));
  `,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('enum_list with floats', () => {
  return expectFinishedResult(
    `equal(enum_list(1.5, 5), list(1.5, 2.5, 3.5, 4.5));`,
    Chapter.SOURCE_2
  ).toEqual(true)
})

test('list_ref', () => {
  return expectFinishedResult(`list_ref(list(1, 2, 3, "4", 4), 4);`, Chapter.SOURCE_2).toEqual(4)
})

test('list_to_string', () => {
  return expectFinishedResult(`list_to_string(list(1, 2, 3));`, Chapter.SOURCE_2).toEqual(
    '[1,[2,[3,null]]]'
  )
})

describe('accumulate', () => {
  test('works properly', () => {
    return expectFinishedResult(
      `accumulate((curr, acc) => curr + acc, 0, list(2, 3, 4, 1));`,
      Chapter.SOURCE_2
    ).toEqual(10)
  })

  it('works from right to left', () => {
    return expectFinishedResult(
      `accumulate((curr, acc) => curr + acc, '1', list('4','3','2'));`,
      Chapter.SOURCE_2
    ).toEqual('4321')
  })
})

describe('length', () => {
  test('works with populated lists', () => {
    return expectFinishedResult(
      stripIndent`
        const xs = list(1,2,3,4);
        length(xs);
      `,
      Chapter.SOURCE_2
    ).toEqual(4)
  })

  test('works with empty lists', () => {
    return expectFinishedResult(
      stripIndent`
        const xs = list();
        length(xs);
      `,
      Chapter.SOURCE_2
    ).toEqual(0)
  })
})

// assoc removed from Source
test.skip('assoc', () => {
  return expectFinishedResult(
    `equal(assoc(3, list(pair(1, 2), pair(3, 4))), pair(3, 4));`,
    Chapter.LIBRARY_PARSER
  ).toEqual(true)
})

test.skip('assoc not found', () => {
  return expectFinishedResult(
    `equal(assoc(2, list(pair(1, 2), pair(3, 4))), false);`,
    Chapter.LIBRARY_PARSER
  ).toEqual(true)
})

test('set_head', () => {
  return expectFinishedResult(
    stripIndent`
    let p = pair(1, 2);
    const q = p;
    set_head(p, 3);
    p === q && equal(p, pair(3, 2));
  `,
    Chapter.SOURCE_3
  ).toEqual(true)
})

test('set_tail', () => {
  return expectFinishedResult(
    stripIndent`
    let p = pair(1, 2);
    const q = p;
    set_tail(p, 3);
    p === q && equal(p, pair(1, 3));
  `,
    Chapter.SOURCE_3
  ).toEqual(true)
})

test('non-list error head', () => {
  return expectParsedError(
    stripIndent`
    head([1, 2, 3]);
  `,
    Chapter.SOURCE_3
  ).toEqual('Line 1: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]')
})

test('non-list error tail', () => {
  return expectParsedError(
    stripIndent`
    tail([1, 2, 3]);
  `,
    Chapter.SOURCE_3
  ).toEqual('Line 1: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]')
})

describe('These tests are reporting weird line numbers, as list functions are now implemented in Source.', () => {
  test('non-list error length', () => {
    return expectParsedError(`length([1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
      'Line 33: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test('non-list error map', () => {
    return expectParsedError(`map(x=>x, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
      'Line 47: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test('non-list error for_each', () => {
    return expectParsedError(`for_each(x=>x, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
      'Line 76: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test('non-list error reverse', () => {
    return expectParsedError(`reverse([1, 2, 3]); `, Chapter.SOURCE_3).toEqual(
      'Line 106: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test('non-list error append', () => {
    return expectParsedError(`append([1, 2, 3], list(1, 2, 3));`, Chapter.SOURCE_3).toEqual(
      'Line 121: Error: tail(xs) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test('non-list error member', () => {
    return expectParsedError(`member(1, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
      'Line 136: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test('non-list error remove', () => {
    return expectParsedError(`remove(1, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
      'Line 151: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test('non-list error remove_all', () => {
    return expectParsedError(`remove_all(1, [1, 2, 3]); `, Chapter.SOURCE_3).toEqual(
      'Line 169: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test.skip('non-list error assoc', () => {
    return expectParsedError(`assoc(1, [1, 2, 3]);`, Chapter.LIBRARY_PARSER).toEqual(
      'Line 1: Name assoc not declared.'
    )
  })

  test('non-list error filter', () => {
    return expectParsedError(`filter(x => true, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
      'Line 185: Error: head(xs) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test('non-list error accumulate', () => {
    return expectParsedError(`accumulate((x, y) => x + y, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
      'Line 1: Expected 3 arguments, but got 2.'
    )
  })

  test('non-list error set_head', () => {
    return expectParsedError(`set_head([1, 2, 3], 4);`, Chapter.SOURCE_3).toEqual(
      'Line 1: Error: set_head(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  test('non-list error set_tail', () => {
    return expectParsedError(`set_tail([1, 2, 3], 4);`, Chapter.SOURCE_3).toEqual(
      'Line 1: Error: set_tail(xs,x) expects a pair as argument xs, but encountered [1, 2, 3]'
    )
  })

  // skipped as implementation does not check types, causing infinite recursion.
  test.skip('build_list with negative integer', () => {
    return expectParsedError(`build_list(x => x, -1);`, Chapter.SOURCE_2).toEqual(
      'Line 1: Error: build_list(fun, n) expects a positive integer as argument n, but encountered -1'
    )
  })

  // skipped as implementation does not check types, causing infinite recursion.
  test.skip('build_list with float', () => {
    return expectParsedError(`build_list(x => x, 1.5); `, Chapter.SOURCE_2).toEqual(
      'Line 1: Error: build_list(fun, n) expects a positive integer as argument n, but encountered 1.5'
    )
  })

  test('build_list with string', () => {
    return expectParsedError(`build_list(x => x, '1'); `, Chapter.SOURCE_2).toEqual(
      'Line 63: Expected number on left hand side of operation, got string.'
    )
  })

  describe('enum_list', () => {
    test('bad number error enum_list', () => {
      return expectParsedError(`enum_list('1', '5'); `, Chapter.SOURCE_2).toEqual(
        'Line 203: Expected string on right hand side of operation, got number.'
      )
    })

    test('enum_list called with string and number', () => {
      return expectParsedError(`enum_list('1', 5); `, Chapter.SOURCE_2).toEqual(
        'Line 201: Expected string on right hand side of operation, got number.'
      )
    })

    test('enum_list called with number and string', () => {
      return expectParsedError(`enum_list(1, '5'); `, Chapter.SOURCE_2).toEqual(
        'Line 201: Expected number on right hand side of operation, got string.'
      )
    })
  })

  describe('list_ref', () => {
    test('list_ref out of bounds', () => {
      return expectParsedError(`list_ref(list(1, 2, 3), 3); `, Chapter.SOURCE_2).toEqual(
        'Line 216: Error: head(xs) expects a pair as argument xs, but encountered null'
      )
    })

    test('list_ref with negative index', () => {
      return expectParsedError(`list_ref(list(1, 2, 3), -1); `, Chapter.SOURCE_2).toEqual(
        'Line 217: Error: tail(xs) expects a pair as argument xs, but encountered null'
      )
    })

    test('list_ref with float index', () => {
      return expectParsedError(`list_ref(list(1, 2, 3), 1.5); `, Chapter.SOURCE_2).toEqual(
        'Line 217: Error: tail(xs) expects a pair as argument xs, but encountered null'
      )
    })

    test('list_ref with string index', () => {
      return expectParsedError(`list_ref(list(1, 2, 3), '1'); `, Chapter.SOURCE_2).toEqual(
        'Line 215: Expected string on right hand side of operation, got number.'
      )
    })
  })
})

describe('display_list', () => {
  async function testForDisplayResult(code: string, chapter: Chapter = Chapter.SOURCE_2) {
    const {
      context: { displayResult }
    } = await testSuccess(code, chapter)
    return displayResult
  }

  test('standard acyclic', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => i, 5));
        0; // suppress long result in snapshot
      `
    )

    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(0, 1, 2, 3, 4)",
      ]
      `)
  })

  test('standard acyclic 2', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => j, i), 5));
        0; // suppress long result in snapshot
      `
    )

    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(null, list(0), list(0, 1), list(0, 1, 2), list(0, 1, 2, 3))",
      ]
      `)
  })

  test('standard acyclic with pairs', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => pair(j, j), i), 5));
        0; // suppress long result in snapshot
      `
    )

    expect(result).toMatchInlineSnapshot(`
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
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => pair(build_list(k => k, j), j), i), 5));
        0; // suppress long result in snapshot
      `
    )

    expect(result).toMatchInlineSnapshot(`
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
    return expectFinishedResult(
      stripIndent`
        const xs = build_list(i => i, 5);
        xs === display_list(xs);
        // Note reference equality
      `,
      Chapter.SOURCE_3
    ).toEqual(true)
  })

  test('returns cyclic argument', () => {
    return expectFinishedResult(
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
    ).toEqual(true)
  })

  test('supports prepend string', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => i, 5), "build_list:");
        0; // suppress long result in snapshot
      `
    )
    expect(result).toMatchInlineSnapshot(`
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
    ).toEqual('Line 1: TypeError: display_list expects the second argument to be a string')
  })

  /**************
   * FUZZ TESTS *
   **************/

  test('MCE fuzz test', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(parse('const twice = f => x => {const result = f(f(x)); return two;};'));
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_4
    )

    expect(result).toMatchInlineSnapshot(`
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
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => j, i), 20));
        0; // suppress long result in snapshot
      `
    )

    expect(result).toMatchInlineSnapshot(`
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
    const result = await testForDisplayResult(
      stripIndent`
        const p = list(1);
        set_tail(p, p);
        display_list(p);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_3
    )

    expect(result).toMatchInlineSnapshot(`
      Array [
        "[1, ...<circular>]",
      ]
      `)
  })

  test('infinite list 2', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        const p = list(1, 2, 3);
        set_tail(tail(tail(p)), p);
        display_list(p);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_3
    )
    expect(result).toMatchInlineSnapshot(`
      Array [
        "[1, [2, [3, ...<circular>]]]",
      ]
      `)
  })

  test('reusing lists', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        const p = list(1);
        const p2 = pair(p, p);
        const p3 = list(p, p2);
        display_list(p3);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2
    )
    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(list(1), list(list(1), 1))",
      ]
      `)
  })

  test('reusing lists 2', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        const p1 = pair(1, null);
        const p2 = pair(2, p1);
        const p3 = list(p1, p2);
        display_list(p3);
        0; // suppress long result in snapshot
      `
    )
    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(list(1), list(2, 1))",
      ]
      `)
  })

  test('list of infinite list', async () => {
    const result = await testForDisplayResult(
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
    )

    expect(result).toMatchInlineSnapshot(`
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
    const result = await testForDisplayResult(
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
    )

    expect(result).toMatchInlineSnapshot(`
      Array [
        "list([null, ...<circular>],
           [null, [list(0), ...<circular>]],
           [null, [list(0), [list(0, 1), ...<circular>]]])",
      ]
    `)
  })

  test('infinite list of list of infinite list', async () => {
    const result = await testForDisplayResult(
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
    )

    expect(result).toMatchInlineSnapshot(`
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
