import { describe, expect, test } from 'vitest'
import { Chapter } from '../../langs'
import { stripIndent } from '../../utils/formatters'
import { testFailure, testSuccess } from '../../utils/testing'

describe('primitive stream functions', () => {
  test('empty stream is null', () => {
    return expect(testSuccess('stream();', Chapter.SOURCE_3)).resolves.toBe(null)
  })

  test('stream_tail works', () => {
    return expect(testSuccess(`head(stream_tail(stream(1, 2)));`, {
      chapter: Chapter.SOURCE_3
    })).resolves.toBe(2)
  })

  test('stream_tail is lazy', () => {
    return expect(testSuccess(
      stripIndent(`
    stream_tail(integers_from(0));
    `),
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(`
              Array [
                1,
                [Function],
              ]
            `)
  })

  test('infinite stream is infinite', () => {
    return expect(testFailure(
      stripIndent`
    stream_length(integers_from(0));
    `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(
      `"Line 1: The error may have arisen from forcing the infinite stream: function integers_from."`
    )
  }, 15000)

  test('stream is properly created', () => {
    return expect(testSuccess(
      stripIndent`
    const s = stream(true, false, undefined, 1, x=>x, null, -123, head);
    const result = [];
    stream_for_each(item => {result[array_length(result)] = item;}, s);
    stream_ref(s,4)(22) === 22 && stream_ref(s,7)(pair('', '1')) === '1' && result;
    `,
      { chapter: Chapter.SOURCE_3 }
    )).resolves.toMatchInlineSnapshot(`false`)
  })

  test('stream_to_list works for null', () => {
    return expect(testSuccess(`stream_to_list(null);`, {
      chapter: Chapter.SOURCE_3
    })).resolves.toMatchInlineSnapshot(`null`)
  })

  test('stream_to_list works', () => {
    return expect(testSuccess(`stream_to_list(stream(1, true, 3, 4.4, [1, 2]));`, {
      chapter: Chapter.SOURCE_3
    })).resolves.toMatchInlineSnapshot(`
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
  return expect(testSuccess(
    stripIndent`
    let sum = 0;
    stream_for_each(x => {
      sum = sum + x;
    }, stream(1, 2, 3));
    sum;
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`6`)
})

test('map', () => {
  return expect(testSuccess(
    stripIndent`
    equal(stream_to_list(stream_map(x => 2 * x, stream(12, 11, 3))), list(24, 22, 6));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('filter', () => {
  return expect(testSuccess(
    stripIndent`
    equal(
      stream_to_list(
        stream_filter(x => x <= 4, stream(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000))
      )
    , list(2, 1, 3, 4, 2));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('build_list', () => {
  return expect(testSuccess(
    stripIndent`
    equal(stream_to_list(build_stream(x => x * x, 5)), list(0, 1, 4, 9, 16));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('reverse', () => {
  return expect(testSuccess(
    stripIndent`
    equal(stream_to_list(
      stream_reverse(
        stream("string", null, undefined, null, 123))),
    list(123, null, undefined, null, "string"));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('append', () => {
  return expect(testSuccess(
    stripIndent`
    equal(stream_to_list(stream_append(stream("string", 123), stream(456, null, undefined)))
      , list("string", 123, 456, null, undefined));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('member', () => {
  return expect(testSuccess(
    stripIndent`
    equal(
      stream_to_list(stream_member("string", stream(1, 2, 3, "string", 123, 456, null, undefined))),
      list("string", 123, 456, null, undefined));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('remove', () => {
  return expect(testSuccess(
    stripIndent`
    stream_remove(1, stream(1));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`null`)
})

test('remove not found', () => {
  return expect(testSuccess(
    stripIndent`
    stream_to_list(stream_remove(2, stream(1)));
  `,
    { chapter: Chapter.SOURCE_3 }
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
    equal(stream_to_list(stream_remove_all(1, stream(1, 2, 3, 4, 1, 1, "1", 5, 1, 1, 6))),
      list(2, 3, 4, "1", 5, 6));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('remove_all not found', () => {
  return expect(testSuccess(
    stripIndent`
    equal(stream_to_list(stream_remove_all(1, stream(2, 3, "1"))), list(2, 3, "1"));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('enum_list', () => {
  return expect(testSuccess(
    stripIndent`
    equal(stream_to_list(enum_stream(1, 5)), list(1, 2, 3, 4, 5));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('enum_list with floats', () => {
  return expect(testSuccess(
    stripIndent`
    equal(stream_to_list(enum_stream(1.5, 5)), list(1.5, 2.5, 3.5, 4.5));
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`true`)
})

test('list_ref', () => {
  return expect(testSuccess(
    stripIndent`
    stream_ref(stream(1, 2, 3, "4", 4), 4);
  `,
    { chapter: Chapter.SOURCE_3 }
  )).resolves.toMatchInlineSnapshot(`4`)
})
