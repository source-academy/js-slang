import { beforeEach, describe, expect, it, test, vi } from 'vitest';
import { Chapter } from '../../langs';
import { stripIndent } from '../../utils/formatters';
import * as funcs from '../stream';
import { expectFinishedResult, expectParsedError, testSuccess } from '../../utils/testing';
import { stringify } from '../../utils/stringify';

describe(funcs.stream, () => {
  describe('source', () => {
    test('empty stream is null', () => {
      return expectFinishedResult('stream();', Chapter.SOURCE_3).toBe(null);
    });

    test('stream is properly created', () => {
      return expectFinishedResult(
        stripIndent`
      const s = stream(true, false, undefined, 1, x=>x, null, -123, head);
      const result = [];
      stream_for_each(item => {result[array_length(result)] = item;}, s);
      stream_ref(s,4)(22) === 22 && stream_ref(s,7)(pair('', '1')) === '1' && result;
      `,
        Chapter.SOURCE_3,
      ).toEqual(false);
    });
  });

  describe('javascript', () => {
    test('regular stream', () => {
      const stream = funcs.stream(1, 2);

      expect(stream[0]).toEqual(1);
      expect(stream[1]).toBeInstanceOf(Function);
      expect(stringify(stream)).toEqual('[1, () => ...]');

      const next = stream[1]();
      expect(next![0]).toEqual(2);
      expect(next![1]).toBeInstanceOf(Function);
      expect(next![1]()).toBeNull();
    });

    test('empty stream is null', () => {
      expect(funcs.stream()).toBeNull();
    });
  });
});

describe(funcs.stream_for_each, () => {
  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        stripIndent`
        let sum = 0;
        stream_for_each(x => {
          sum = sum + x;
        }, stream(1, 2, 3));
        sum;
      `,
        Chapter.SOURCE_3,
      ).toEqual(6);
    });
  });

  describe('javascript', () => {
    it('works with populated stream', () => {
      const f = vi.fn(x => x);
      const stream = funcs.stream(1, 2);

      expect(funcs.stream_for_each(f, stream)).toEqual(true);
      expect(f).toHaveBeenCalledTimes(2);

      const [[arg0], [arg1]] = f.mock.calls;
      expect(arg0).toEqual(1);
      expect(arg1).toEqual(2);
    });

    it('works with empty stream', () => {
      const f = vi.fn(x => x);
      const stream = funcs.stream();

      expect(funcs.stream_for_each(f, stream)).toEqual(true);
      expect(f).not.toHaveBeenCalled();
    });
  });
});

describe(funcs.stream_tail, () => {
  describe('source', () => {
    test('stream_tail is lazy', async ({ expect }) => {
      const {
        result: { value },
      } = await testSuccess(`stream_tail(integers_from(0));`, Chapter.SOURCE_3);

      expect(value).toMatchInlineSnapshot(`
        Array [
          1,
          [Function],
        ]
      `);
    });
  });

  describe('javascript', () => {
    it('works with populated stream', () => {
      const stream = funcs.stream(1, 2);
      expect(funcs.stream_tail(stream)).toEqual([2, expect.any(Function)]);
    });

    test('throws error on empty stream', () => {
      const stream = funcs.stream();
      expect(() => funcs.stream_tail(stream!)).toThrow(
        'stream_tail: Expected non-empty stream, got null.',
      );
    });
  });
});

describe(funcs.stream_map, () => {
  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        stripIndent`
        equal(stream_to_list(stream_map(x => 2 * x, stream(12, 11, 3))), list(24, 22, 6));
      `,
        Chapter.SOURCE_3,
      ).toEqual(true);
    });
  });

  describe('javascript', () => {
    const f = vi.fn(x => x);

    beforeEach(() => {
      f.mockClear();
    });

    it('works with populated streams', () => {
      const stream = funcs.build_stream(f, 2);

      expect(stream![0]).toEqual(0);
      expect(f).toHaveBeenCalledOnce();

      const next = funcs.stream_tail(stream!);
      expect(next![0]).toEqual(1);
      expect(f).toHaveBeenCalledTimes(2);

      const nextnext = funcs.stream_tail(next!);
      expect(nextnext).toBeNull();
    });

    it('works with empty stream', () => {
      const stream = funcs.stream();
      expect(funcs.stream_map(f, stream)).toBeNull();
      expect(f).not.toHaveBeenCalled();
    });
  });
});

describe(funcs.stream_filter, () => {
  describe('source', () => {
    test('stream_filter', () => {
      return expectFinishedResult(
        stripIndent`
        equal(
          stream_to_list(
            stream_filter(x => x <= 4, stream(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000))
          )
        , list(2, 1, 3, 4, 2));
      `,
        Chapter.SOURCE_3,
      ).toEqual(true);
    });
  });

  describe('javascript', () => {
    test('when predicate is true for first element', () => {
      const f = vi.fn(x => x);
      const stream = funcs.build_stream(f, 5);

      const pred = vi.fn(x => x % 2 === 0);
      const filtered = funcs.stream_filter(pred, stream);

      // calling stream_filter shouldn't try to evaluate the stream in this case
      // since the first element is even
      expect(f).toHaveBeenCalledOnce();
      expect(filtered![0]).toEqual(0);

      const next = funcs.stream_tail(filtered!);
      expect(f).toHaveBeenCalledTimes(3);
      expect(pred).toHaveBeenCalledTimes(3);
      expect(next![0]).toEqual(2);
    });

    test('when predicate is false for first element', () => {
      const f = vi.fn(x => x);
      const stream = funcs.build_stream(f, 5);

      const pred = vi.fn(x => x >= 3);
      const filtered = funcs.stream_filter(pred, stream);

      // calling stream_filter should evaluate until we get to 3
      expect(f).toHaveBeenCalledTimes(4);
      expect(filtered![0]).toEqual(3);

      const next = funcs.stream_tail(filtered!);
      expect(f).toHaveBeenCalledTimes(5);
      expect(pred).toHaveBeenCalledTimes(5);
      expect(next![0]).toEqual(4);
    });

    test('empty stream', () => {
      expect(funcs.stream_filter(() => true, funcs.stream())).toBeNull();
    });
  });
});

describe(funcs.stream_ref, () => {
  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        stripIndent`
        stream_ref(stream(1, 2, 3, "4", 4), 4);
      `,
        Chapter.SOURCE_3,
      ).toEqual(4);
    });
  });

  describe('javascript', () => {
    test('laziness', () => {
      const f = vi.fn(x => x);
      const s = funcs.build_stream(f, 5);

      expect(f).toHaveBeenCalledOnce();

      expect(funcs.stream_ref(s, 3)).toEqual(3);
      expect(f).toHaveBeenCalledTimes(4);
    });
  });
});

describe(funcs.build_stream, () => {
  describe('source', () => {
    test('build_stream', () => {
      return expectFinishedResult(
        stripIndent`
        equal(stream_to_list(build_stream(x => x * x, 5)), list(0, 1, 4, 9, 16));
      `,
        Chapter.SOURCE_3,
      ).toEqual(true);
    });
  });

  describe('javascript', () => {
    it('returns null when n = 0', () => {
      expect(funcs.build_stream(x => x, 0)).toBeNull();
    });

    test('laziness', () => {
      const f = vi.fn(x => x * x);
      let s = funcs.build_stream(f, 5);

      for (let i = 0; s !== null; i++) {
        if (i > 1000) {
          expect.fail('should not get here');
        }

        expect(f).toHaveBeenCalledTimes(i + 1);
        expect(s[0]).toEqual(i * i);

        s = funcs.stream_tail(s);
      }
    });
  });
});

describe(funcs.stream_append, () => {
  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        stripIndent`
        equal(stream_to_list(stream_append(stream("string", 123), stream(456, null, undefined)))
          , list("string", 123, 456, null, undefined));
      `,
        Chapter.SOURCE_3,
      ).toEqual(true);
    });
  });

  describe('javascript', () => {
    it('works with populated streams', () => {
      const xs = funcs.stream(1, 2);
      const ys = funcs.stream(3, 4);

      const elements = funcs.stream_to_list(funcs.stream_append(xs, ys));
      expect(elements).toEqual([1, [2, [3, [4, null]]]]);
    });

    test('appending empty to populated stream', () => {
      const xs = funcs.stream(1, 2);
      const ys = funcs.stream();

      const elements = funcs.stream_to_list(funcs.stream_append(xs, ys));
      expect(elements).toEqual([1, [2, null]]);
    });

    test('appending populated to empty stream', () => {
      const ys = funcs.stream(1, 2);
      const xs = funcs.stream();

      const elements = funcs.stream_to_list(funcs.stream_append(xs, ys));
      expect(elements).toEqual([1, [2, null]]);
    });

    test('appending empty to empty stream', () => {
      const xs = funcs.stream();
      const ys = funcs.stream();

      expect(funcs.stream_append(xs, ys)).toBeNull();
    });
  });
});

describe(funcs.stream_to_list, () => {
  describe('javascript', () => {
    it('works', () => {
      const stream = funcs.build_stream(x => x, 5);
      const xs = funcs.stream_to_list(stream);

      expect(xs).toEqual([0, [1, [2, [3, [4, null]]]]]);
    });
  });
});

describe('primitive stream functions', () => {
  test('infinite stream is infinite', { timeout: 15_000 }, () => {
    return expectParsedError(
      stripIndent`
    stream_length(integers_from(0));
    `,
      Chapter.SOURCE_3,
    ).toContain(`RangeError: Maximum call stack size exceeded`);
  });

  test('stream_to_list works for null', () => {
    return expectFinishedResult(`stream_to_list(null);`, {
      chapter: Chapter.SOURCE_3,
    }).toEqual(null);
  });

  test('stream_to_list works', async () => {
    const {
      result: { value },
    } = await testSuccess(`stream_to_list(stream(1, true, 3, 4.4, [1, 2]));`, Chapter.SOURCE_3);

    expect(value).toMatchInlineSnapshot(`
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
    `);
  });
});

test('stream_reverse', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(
      stream_reverse(
        stream("string", null, undefined, null, 123))),
    list(123, null, undefined, null, "string"));
  `,
    Chapter.SOURCE_3,
  ).toEqual(true);
});

test('stream_member', () => {
  return expectFinishedResult(
    stripIndent`
    equal(
      stream_to_list(stream_member("string", stream(1, 2, 3, "string", 123, 456, null, undefined))),
      list("string", 123, 456, null, undefined));
  `,
    Chapter.SOURCE_3,
  ).toEqual(true);
});

test('stream_remove', () => {
  return expectFinishedResult(
    stripIndent`
    stream_remove(1, stream(1));
  `,
    Chapter.SOURCE_3,
  ).toEqual(null);
});

test('stream_remove not found', async () => {
  const {
    result: { value },
  } = await testSuccess(`stream_to_list(stream_remove(2, stream(1)));`, Chapter.SOURCE_3);

  expect(value).toMatchInlineSnapshot(`
    Array [
      1,
      null,
    ]
  `);
});

test('stream_remove_all', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(stream_remove_all(1, stream(1, 2, 3, 4, 1, 1, "1", 5, 1, 1, 6))),
      list(2, 3, 4, "1", 5, 6));
  `,
    Chapter.SOURCE_3,
  ).toEqual(true);
});

test('stream_remove_all not found', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(stream_remove_all(1, stream(2, 3, "1"))), list(2, 3, "1"));
  `,
    Chapter.SOURCE_3,
  ).toEqual(true);
});

test('enum_stream', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(enum_stream(1, 5)), list(1, 2, 3, 4, 5));
  `,
    Chapter.SOURCE_3,
  ).toEqual(true);
});

test('enum_stream with floats', () => {
  return expectFinishedResult(
    stripIndent`
    equal(stream_to_list(enum_stream(1.5, 5)), list(1.5, 2.5, 3.5, 4.5));
  `,
    Chapter.SOURCE_3,
  ).toEqual(true);
});
