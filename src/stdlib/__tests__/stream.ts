import { Chapter, Variant } from '../../types'
import { expectParsedError, expectResult, expectResultsToEqual } from '../../utils/testing'

expectResultsToEqual(
  [
    ['empty stream is null', 'stream();', null],
    [
      'append',
      `
      equal(stream_to_list(stream_append(stream("string", 123), stream(456, null, undefined)))
      , list("string", 123, 456, null, undefined));
    `,
      true
    ],
    [
      'build_stream',
      'equal(stream_to_list(build_stream(x => x * x, 5)), list(0, 1, 4, 9, 16));',
      true
    ],
    ['enum_stream', 'equal(stream_to_list(enum_stream(1, 5)), list(1, 2, 3, 4, 5));', true],
    [
      'enum_stream with floats',
      'equal(stream_to_list(enum_stream(1.5, 5)), list(1.5, 2.5, 3.5, 4.5));',
      true
    ],
    [
      'filter',
      `
      equal(
        stream_to_list(
          stream_filter(x => x <= 4, stream(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000))
        )
      , list(2, 1, 3, 4, 2));
    `,
      true
    ],
    [
      'for_each',
      `  
      let sum = 0;
      stream_for_each(x => {
        sum = sum + x;
      }, stream(1, 2, 3));
      sum;
    `,
      6
    ],
    [
      'map',
      'equal(stream_to_list(stream_map(x => 2 * x, stream(12, 11, 3))), list(24, 22, 6));',
      true
    ],
    [
      'member',
      `
      equal(
        stream_to_list(stream_member("string", stream(1, 2, 3, "string", 123, 456, null, undefined))),
        list("string", 123, 456, null, undefined));
    `,
      true
    ],
    ['remove', 'stream_remove(1, stream(1));', null],
    ['remove not found', 'stream_to_list(stream_remove(2, stream(1)));', [1, null]],
    [
      'remove_all',
      `
      equal(stream_to_list(stream_remove_all(1, stream(1, 2, 3, 4, 1, 1, "1", 5, 1, 1, 6))),
        list(2, 3, 4, "1", 5, 6));
    `,
      true
    ],
    [
      'remove_all not found',
      'equal(stream_to_list(stream_remove_all(1, stream(2, 3, "1"))), list(2, 3, "1"));',
      true
    ],
    [
      'reverse',
      `
      equal(stream_to_list(
        stream_reverse(
          stream("string", null, undefined, null, 123))),
      list(123, null, undefined, null, "string"));
    `,
      true
    ],
    ['stream_ref', 'stream_ref(stream(1, 2, 3, "4", 4), 4);', 4],
    ['stream_tail works', 'head(stream_tail(stream(1, 2)));', 2],
    [
      'stream is properly created',
      `
      const s = stream(true, false, undefined, 1, x=>x, null, -123, head);
      const result = [];
      stream_for_each(item => {result[array_length(result)] = item;}, s);
      stream_ref(s,4)(22) === 22 && stream_ref(s,7)(pair('', '1')) === '1' && result;
    `,
      false
    ],
    ['stream_to_list works for null', 'stream_to_list(null);', null]
  ],
  Chapter.SOURCE_3
)

test('stream_tail is lazy', () => {
  return expectResult('stream_tail(integers_from(0));', Chapter.SOURCE_3).toMatchInlineSnapshot(`
Array [
  1,
  [Function],
]
`)
})

describe('infinite stream is infinite', () => {
  // TODO: Make this more modular
  const code = 'stream_length(integers_from(0));'

  test('cse-machine', () => {
    return expectParsedError(code, {
      chapter: Chapter.SOURCE_3,
      variant: Variant.EXPLICIT_CONTROL
    }).toMatch(/(Maximum call stack size exceeded){1,2}/)
  }, 15000)

  test('native', () => {
    return expectParsedError(code, Chapter.SOURCE_3).toEqual(
      'Line 1: The error may have arisen from forcing the infinite stream: function integers_from.'
    )
  }, 15000)
})

test('stream_to_list works', () => {
  return expectResult(`stream_to_list(stream(1, true, 3, 4.4, [1, 2]));`, Chapter.SOURCE_3)
    .toMatchInlineSnapshot(`
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
