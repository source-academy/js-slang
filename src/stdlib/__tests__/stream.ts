import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { expectParsedError, expectFinishedResult } from '../../utils/testing'

describe('primitive stream functions', () => {
  test('empty stream is null', () => {
    return expectFinishedResult('stream();', { chapter: Chapter.SOURCE_3 }).toBe(null)
  })

  test('stream_tail works', () => {
    return expectFinishedResult(`head(stream_tail(stream(1, 2)));`, {
      chapter: Chapter.SOURCE_3
    }).toBe(2)
  })

  test('stream_tail is lazy', () => {
    return expectFinishedResult(
      stripIndent(`
    stream_tail(integers_from(0));
    `),
      { chapter: Chapter.SOURCE_3 }
    ).toMatchInlineSnapshot(`
              Array [
                1,
                [Function],
              ]
            `)
  })

  test('infinite stream is infinite', () => {
    return expectParsedError(
      stripIndent`
    stream_length(integers_from(0));
    `,
      { chapter: Chapter.SOURCE_3 }
    ).toMatchInlineSnapshot(
      `"Line 1: The error may have arisen from forcing the infinite stream: function integers_from."`
    )
  }, 15000)

  test('stream is properly created', () => {
    return expectFinishedResult(
      stripIndent`
    const s = stream(true, false, undefined, 1, x=>x, null, -123, head);
    const result = [];
    stream_for_each(item => {result[array_length(result)] = item;}, s);
    stream_ref(s,4)(22) === 22 && stream_ref(s,7)(pair('', '1')) === '1' && result;
    `,
      { chapter: Chapter.SOURCE_3 }
    ).toMatchInlineSnapshot(`false`)
  })

  test('stream_to_list works for null', () => {
    return expectFinishedResult(`stream_to_list(null);`, {
      chapter: Chapter.SOURCE_3
    }).toMatchInlineSnapshot(`null`)
  })

  test('stream_to_list works', () => {
    return expectFinishedResult(`stream_to_list(stream(1, true, 3, 4.4, [1, 2]));`, {
      chapter: Chapter.SOURCE_3
    }).toMatchInlineSnapshot(`
              Array [
                1,
                Array [
                  true,
                  Array [
                    3,
                    Array [
                      4.4,
                      Array [
                        Array [
                          1,
                          2,
                        ],
                        null,
                      ],
                    ],
                  ],
                ],
              ]
            `)
  })
})

test('for_each', () => {
  return expectFinishedResult(
    stripIndent`
    let sum = 0;
    stream_for_each(x => {
      sum = sum + x;
    }, stream(1, 2, 3));
    sum;
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`6`)
})

test('map', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(stream_map(x => 2 * x, stream(12, 11, 3))), list(24, 22, 6));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('filter', () => {
  return expectFinishedResult(
    stripIndent`
    equal(
      stream_to_list(
        stream_filter(x => x <= 4, stream(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000))
      )
    , list(2, 1, 3, 4, 2));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('build_list', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(build_stream(x => x * x, 5)), list(0, 1, 4, 9, 16));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('reverse', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(
      stream_reverse(
        stream("string", null, undefined, null, 123))),
    list(123, null, undefined, null, "string"));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('append', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(stream_append(stream("string", 123), stream(456, null, undefined)))
      , list("string", 123, 456, null, undefined));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('member', () => {
  return expectFinishedResult(
    stripIndent`
    equal(
      stream_to_list(stream_member("string", stream(1, 2, 3, "string", 123, 456, null, undefined))),
      list("string", 123, 456, null, undefined));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('remove', () => {
  return expectFinishedResult(
    stripIndent`
    stream_remove(1, stream(1));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`null`)
})

test('remove not found', () => {
  return expectFinishedResult(
    stripIndent`
    stream_to_list(stream_remove(2, stream(1)));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`
            Array [
              1,
              null,
            ]
          `)
})

test('remove_all', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(stream_remove_all(1, stream(1, 2, 3, 4, 1, 1, "1", 5, 1, 1, 6))),
      list(2, 3, 4, "1", 5, 6));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('remove_all not found', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(stream_remove_all(1, stream(2, 3, "1"))), list(2, 3, "1"));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('enum_list', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(enum_stream(1, 5)), list(1, 2, 3, 4, 5));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('enum_list with floats', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(enum_stream(1.5, 5)), list(1.5, 2.5, 3.5, 4.5));
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`true`)
})

test('list_ref', () => {
  return expectFinishedResult(
    stripIndent`
    stream_ref(stream(1, 2, 3, "4", 4), 4);
  `,
    { chapter: Chapter.SOURCE_3 }
  ).toMatchInlineSnapshot(`4`)
})
