import { describe, expect, test } from 'vitest'
import { Chapter } from '../../langs'
import { testFailure, testForValue } from '../../utils/testing'

describe('primitive stream functions', () => {
  test('empty stream is null', () => {
    return expect(testForValue('stream();', Chapter.SOURCE_3)).resolves.toBe(null)
  })

  test('stream_tail works', () => {
    return expect(testForValue(`head(stream_tail(stream(1, 2)));`, Chapter.SOURCE_3)).resolves.toBe(
      2
    )
  })

  test('stream_tail is lazy', () => {
    return expect(testForValue(` stream_tail(integers_from(0));`, Chapter.SOURCE_3)).resolves
      .toMatchInlineSnapshot(`
      Array [
        1,
        [Function],
      ]
    `)
  })

  test('infinite stream is infinite', { timeout: 15000 }, () => {
    return expect(
      testFailure(`stream_length(integers_from(0));`, Chapter.SOURCE_3)
    ).resolves.toMatch(/(Line \d+: )?RangeError: Maximum call stack size exceeded/)
  })

  test('stream is properly created', () => {
    return expect(
      testForValue(
        `
      const s = stream(true, false, undefined, 1, x=>x, null, -123, head);
      const result = [];
      stream_for_each(item => {result[array_length(result)] = item;}, s);
      stream_ref(s,4)(22) === 22 && stream_ref(s,7)(pair('', '1')) === '1' && result;
    `,
        Chapter.SOURCE_3
      )
    ).resolves.toMatchInlineSnapshot(`false`)
  })

  test('stream_to_list works for null', () => {
    return expect(testForValue(`stream_to_list(null);`, Chapter.SOURCE_3)).resolves.toBeNull()
  })

  test('stream_to_list works', () => {
    return expect(
      testForValue(`stream_to_list(stream(1, true, 3, 4.4, [1, 2]));`, Chapter.SOURCE_3)
    ).resolves.toMatchInlineSnapshot(`
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
  return expect(
    testForValue(
      `
      let sum = 0;
      stream_for_each(x => {
        sum = sum + x;
      }, stream(1, 2, 3));
      sum;
    `,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(6)
})

test('map', () => {
  return expect(
    testForValue(
      `equal(stream_to_list(stream_map(x => 2 * x, stream(12, 11, 3))), list(24, 22, 6));`,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(true)
})

test('filter', () => {
  return expect(
    testForValue(
      `
      equal(
        stream_to_list(
          stream_filter(x => x <= 4, stream(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000))
        ),
        list(2, 1, 3, 4, 2)
      );
      `,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(true)
})

test('build_list', () => {
  return expect(
    testForValue(
      `equal(stream_to_list(build_stream(x => x * x, 5)), list(0, 1, 4, 9, 16)); `,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(true)
})

test('reverse', () => {
  return expect(
    testForValue(
      `
      equal(stream_to_list(
        stream_reverse(
          stream("string", null, undefined, null, 123))),
      list(123, null, undefined, null, "string"));
      `,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(true)
})

test('append', () => {
  return expect(
    testForValue(
      `
      equal(stream_to_list(stream_append(stream("string", 123), stream(456, null, undefined))), list("string", 123, 456, null, undefined));
      `,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(true)
})

test('member', () => {
  return expect(
    testForValue(
      `
        equal(
          stream_to_list(stream_member("string", stream(1, 2, 3, "string", 123, 456, null, undefined))),
          list("string", 123, 456, null, undefined)
        );
      `,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(true)
})

test('remove', () => {
  return expect(testForValue(`stream_remove(1, stream(1));`, Chapter.SOURCE_3)).resolves.toBeNull()
})

test('remove not found', () => {
  return expect(testForValue(`stream_to_list(stream_remove(2, stream(1)));`, Chapter.SOURCE_3))
    .resolves.toMatchInlineSnapshot(`
    Array [
      1,
      null,
    ]
  `)
})

test('remove_all', () => {
  return expect(
    testForValue(
      `
      equal(
        stream_to_list(stream_remove_all(1, stream(1, 2, 3, 4, 1, 1, "1", 5, 1, 1, 6))),
        list(2, 3, 4, "1", 5, 6)
      );
    `,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(true)
})

test('remove_all not found', () => {
  return expect(
    testForValue(
      `equal(stream_to_list(stream_remove_all(1, stream(2, 3, "1"))), list(2, 3, "1"));`,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(true)
})

test('enum_list', () => {
  return expect(
    testForValue(`equal(stream_to_list(enum_stream(1, 5)), list(1, 2, 3, 4, 5));`, Chapter.SOURCE_3)
  ).resolves.toEqual(true)
})

test('enum_list with floats', () => {
  return expect(
    testForValue(
      `equal(stream_to_list(enum_stream(1.5, 5)), list(1.5, 2.5, 3.5, 4.5));`,
      Chapter.SOURCE_3
    )
  ).resolves.toEqual(true)
})

test('list_ref', () => {
  return expect(
    testForValue(`stream_ref(stream(1, 2, 3, "4", 4), 4);`, Chapter.SOURCE_3)
  ).resolves.toEqual(4)
})
