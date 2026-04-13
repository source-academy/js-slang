import { describe, expect, it, test, vi } from 'vitest';
import { Chapter } from '../../langs';
import { stripIndent } from '../../utils/formatters';
import { expectFinishedResult, expectParsedError, testSuccess } from '../../utils/testing';
import * as list from '../list';

describe(list.accumulate, () => {
  describe('javascript', () => {
    it('works properly', () => {
      expect(list.accumulate((curr, acc) => curr + acc, 0, list.list(2, 3, 4, 1))).toEqual(10);
    });

    it('works from right to left', () => {
      expect(list.accumulate((curr, acc) => curr + acc, '1', list.list('4', '3', '2'))).toEqual(
        '4321',
      );
    });
  });

  describe('source', () => {
    it('works properly', () => {
      return expectFinishedResult(
        `accumulate((curr, acc) => curr + acc, 0, list(2, 3, 4, 1));`,
        Chapter.SOURCE_2,
      ).toEqual(10);
    });

    it('works from right to left', () => {
      return expectFinishedResult(
        `accumulate((curr, acc) => curr + acc, '1', list('4','3','2'));`,
        Chapter.SOURCE_2,
      ).toEqual('4321');
    });

    it('throws when given not a list', () => {
      return expectParsedError(`accumulate((x, y) => x + y, null, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 232: tail: Expected pair, got [1, 2, 3].'
      );
    })
  });
});

describe(list.append, () => {
  describe('javascript', () => {
    const xs = list.list(1, 2, 3, 4);
    const ys = list.list(5, 6, 7);

    it('works with two populated lists', () => {
      expect(list.append(xs, ys)).toEqual([1, [2, [3, [4, [5, [6, [7, null]]]]]]]);

      expect(list.append(ys, xs)).toEqual([5, [6, [7, [1, [2, [3, [4, null]]]]]]]);
    });

    test('appending empty list to populated list', () => {
      expect(list.append(ys, null)).toEqual([5, [6, [7, null]]]);
    });

    test('appending populated list to empty list', () => {
      expect(list.append(null, ys)).toEqual([5, [6, [7, null]]]);
    });

    test('appending empty list to empty list', () => {
      expect(list.append(null, null)).toBeNull();
    });
  });

  describe('source', () => {
    test('append', () => {
      return expectFinishedResult(
        `equal(append(list(123, 123), list(456, 456, 456)), list(123, 123, 456, 456, 456));`,
        Chapter.SOURCE_2,
      ).toEqual(true);
    });

    it('throws an error when given not a list', () => {
      return expectParsedError(`append([1, 2, 3], list(1, 2, 3));`, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 121: tail: Expected pair, got [1, 2, 3].'
      );
    })
  });
});

describe(list.build_list, () => {
  describe('javascript', () => {
    it('works', () => {
      expect(list.build_list(x => x + 1, 3)).toEqual([
        1, [2, [3, null]]
      ])
    })

    it('gives empty list when n = 0', () => {
      expect(list.build_list(x => x, 0)).toBeNull();
    })

    it('throws error when not given a unary function', () => {
      expect(() => list.build_list(0 as any, 1)).toThrow(
        'build_list: Expected function with 1 parameter, got 0.'
      )
    })

    it('throws error when given a negative integer', () => {
      expect(() => list.build_list(x => x, -1)).toThrow(
        'build_list: Expected integer greater than 0, got -1.'
      )
    })

    it('throws error when given a float', () => {
      expect(() => list.build_list(x => x, 0.5)).toThrow(
        'build_list: Expected integer greater than 0, got 0.5.'
      )
    })
  })

  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        stripIndent`
        equal(build_list(x => x * x, 5), list(0, 1, 4, 9, 16));
      `,
        Chapter.SOURCE_2,
      ).toEqual(true);
    });

    // skipped as implementation does not check types, causing infinite recursion.
    test.todo('build_list with negative integer', () => {
      return expectParsedError(`build_list(x => x, -1);`, Chapter.SOURCE_2).toEqual(
        'Line 1: Error: build_list expects a positive integer as argument n, but encountered -1',
      );
    });

    // skipped as implementation does not check types, causing infinite recursion.
    test.todo('build_list with float', () => {
      return expectParsedError(`build_list(x => x, 1.5); `, Chapter.SOURCE_2).toEqual(
        'Line 1: build_list: Expected an integer greater than 0 for n, got 1.5.',
      );
    });

    test('build_list with string', () => {
      return expectParsedError(`build_list(x => x, '1'); `, Chapter.SOURCE_2).toEqual(
        '[prelude] Line 63: Expected number on left hand side of operation, got string.',
      );
    });
  })
})

describe(list.enum_list, () => {
  describe('javascript', () => {
    it('works', () => {
      expect(list.enum_list(5, 7)).toEqual([
        5, [6, [7, null]]
      ])
    })

    it('works when start = end', () => {
      expect(list.enum_list(3, 3)).toEqual([3, null])
    })

    it('works with floats', () => {
      expect(list.enum_list(1.5, 5)).toEqual(
        [1.5, [2.5, [3.5, [4.5, null]]]]
      )
    })

    it('works with negative numbers', () => {
      expect(list.enum_list(-1, 1)).toEqual(
        [-1, [0, [1, null]]]
      )
    })

    it('throws an error when end < start', () => {
      expect(() => list.enum_list(1, -1)).toThrow(
        'enum_list: Expected number greater than 1 for end, got -1.'
      )
    })

    it('throws an error when start is not a number', () => {
      expect(() => list.enum_list('0' as any, 10)).toThrow(
        'enum_list: Expected number for start, got "0".'
      )
    })

    it('throws an error when end is not a number', () => {
      expect(() => list.enum_list(0, '0' as any)).toThrow(
        'enum_list: Expected number greater than 0 for end, got "0".'
      )
    })
  })

  describe('source', () => {
    test('enum_list', () => {
      return expectFinishedResult(
        stripIndent`
        equal(enum_list(1, 5), list(1, 2, 3, 4, 5));
      `,
        Chapter.SOURCE_2,
      ).toEqual(true);
    });

    test('enum_list with floats', () => {
      return expectFinishedResult(
        `equal(enum_list(1.5, 5), list(1.5, 2.5, 3.5, 4.5));`,
        Chapter.SOURCE_2,
      ).toEqual(true);
    });
    
    test('bad number error enum_list', () => {
      return expectParsedError(`enum_list('1', '5'); `, Chapter.SOURCE_2).toEqual(
        '[prelude] Line 203: Expected string on right hand side of operation, got number.',
      );
    });

    test('enum_list called with string and number', () => {
      return expectParsedError(`enum_list('1', 5); `, Chapter.SOURCE_2).toEqual(
        '[prelude] Line 201: Expected string on right hand side of operation, got number.',
      );
    });

    test('enum_list called with number and string', () => {
      return expectParsedError(`enum_list(1, '5'); `, Chapter.SOURCE_2).toEqual(
        '[prelude] Line 201: Expected number on right hand side of operation, got string.',
      );
    });
  })
})

describe(list.filter, () => {
  describe('javascript', () => {
    it('works on populated list', () => {
      const xs = list.list(1, 2, 3, 4, 5);
      expect(list.filter(x => x % 2 === 0, xs)).toEqual([2, [4, null]]);
    });

    it('works on empty list', () => {
      expect(list.filter(_x => true, list.list())).toBeNull();
    });
  });

  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        stripIndent`
        equal(filter(x => x <= 4, list(2, 10, 1000, 1, 3, 100, 4, 5, 2, 1000)), list(2, 1, 3, 4, 2));
      `,
        Chapter.SOURCE_2,
      ).toEqual(true);
    });

    it('throws an error when given not a list', () => {
      return expectParsedError(`filter(x => true, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 185: head: Expected pair, got [1, 2, 3].'
      );
    })
  });
});

describe(list.for_each, () => {
  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        stripIndent`
        let sum = 0;
        for_each(x => {
          sum = sum + x;
        }, list(1, 2, 3));
        sum;
      `,
        Chapter.SOURCE_3,
      ).toEqual(6);
    });

    it('throws an error when given not a list', () => {
      return expectParsedError(`for_each(x=>x, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 76: head: Expected pair, got [1, 2, 3].'
      );
    })
  });

  describe('javascript', () => {
    it('works on populated list', () => {
      const op = vi.fn(x => x);
      const xs = list.list(1, 2, 3);

      expect(list.for_each(op, xs)).toEqual(true);
      expect(op).toHaveBeenCalledTimes(3);

      for (let i = 0; i < op.mock.calls.length; i++) {
        const [arg] = op.mock.calls[i];
        expect(arg).toEqual(i + 1);
      }
    });

    it('works on empty lists', () => {
      const op = vi.fn(x => x);
      expect(list.for_each(op, null)).toEqual(true);
      expect(op).not.toHaveBeenCalled();
    });
  });
});

describe(list.head, () => {
  describe('javascript', () => {
    it('throws an error when argument is not a pair', () => {
      expect(() => list.head(0 as any)).toThrowError(
        'head: Expected pair, got 0.',
      );
    });
  });

  describe('source', () => {
    test('non-list error head (in Source)', () => {
      return expectParsedError('head([1, 2, 3]);',
        Chapter.SOURCE_3,
      ).toEqual('Line 1: head: Expected pair, got [1, 2, 3].');
    });

    it('works', () => {
      return expectFinishedResult(`head(pair(1, 'a string ""'));`, Chapter.SOURCE_2).toEqual(1);
    });
  });
});

describe(list.is_pair, () => {
  describe('javascript', () => {
    it('returns true when argument is pair', () => {
      expect(list.is_pair([1, 2])).toEqual(true);
      expect(list.is_pair([1, [2, null]])).toEqual(true);
    });

    it('returns false when argument is not pair', () => {
      expect(list.is_pair([1, 2, 3])).toEqual(false);
      expect(list.is_pair([])).toEqual(false);
    });
  });
});

describe(list.length, () => {
  describe('source', () => {
    it('works with populated lists', () => {
      return expectFinishedResult(
        stripIndent`
          const xs = list(1,2,3,4);
          length(xs);
        `,
        Chapter.SOURCE_2,
      ).toEqual(4);
    });

    it('works with empty lists', () => {
      return expectFinishedResult(
        stripIndent`
          const xs = list();
          length(xs);
        `,
        Chapter.SOURCE_2,
      ).toEqual(0);
    });

    it('throws an error when given not a list', () => {
      return expectParsedError(`length([1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 33: tail: Expected pair, got [1, 2, 3].'
      );
    });
  });

  describe('javascript', () => {
    it('works with populated lists', () => {
      expect(list.length(list.list(1, 2, 3, 4))).toEqual(4);
    });

    it('works with empty list', () => {
      expect(list.length(list.list())).toEqual(0);
    });
  });
});

describe(list.list, () => {
  describe('source', () => {
    it('creates list', async () => {
      const {
        result: { value },
      } = await testSuccess(
        stripIndent`
          function f() { return 1; }
          list(1, 'a string ""', () => f, f, true, 3.14);
        `,
        Chapter.SOURCE_2,
      );

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
      `);
    });

    test('empty list is null', () => {
      return expectFinishedResult(`list();`, Chapter.SOURCE_2).toBeNull();
    });
  });

  describe('javascript', () => {
    it('creates list', () => {
      expect(list.list(1, 2, 3)).toEqual([1, [2, [3, null]]]);
    });

    it('returns empty list when called with no arguments', () => {
      expect(list.list()).toBeNull();
    });
  });
});

describe(list.list_ref, () => {
  describe('javascript', () => {
    it('works', () => {
      expect(list.list_ref(list.list(1, 2, 3), 0)).toEqual(1);
    });

    it('throws error when given empty list', () => {
      expect(() => list.list_ref(null, 0)).toThrowError(
        'list_ref: Index 0 is out of bounds',
      );
    });

    test('throwing out of bounds for populated list', () => {
      expect(() => list.list_ref(list.list(1, 2), 2)).toThrowError(
        'list_ref: Index 2 is out of bounds',
      );
    });
  });

  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(`list_ref(list(1, 2, 3, "4", 4), 4);`, Chapter.SOURCE_2).toEqual(
        4,
      );
    });

    test('list_ref out of bounds', () => {
      return expectParsedError(`list_ref(list(1, 2, 3), 3); `, Chapter.SOURCE_2).toEqual(
        '[prelude] Line 216: head: Expected pair, got null.'
      );
    });

    test('list_ref with negative index', () => {
      return expectParsedError(`list_ref(list(1, 2, 3), -1); `, Chapter.SOURCE_2).toEqual(
        '[prelude] Line 217: tail: Expected pair, got null.'
      );
    });

    test('list_ref with float index', () => {
      return expectParsedError(`list_ref(list(1, 2, 3), 1.5); `, Chapter.SOURCE_2).toEqual(
        '[prelude] Line 217: tail: Expected pair, got null.'
      );
    });

    test('list_ref with string index', () => {
      return expectParsedError(`list_ref(list(1, 2, 3), '1'); `, Chapter.SOURCE_2).toEqual(
        '[prelude] Line 215: Expected string on right hand side of operation, got number.',
      );
    });
  });
});

describe(list.list_to_vector, () => {
  describe('javascript', () => {
    it('preserves element order', () => {
      const xs = list.list(1, 2, 3, 4);
      expect(list.list_to_vector(xs)).toEqual([1, 2, 3, 4]);
    });
  });
});

describe(list.map, () => {
  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        `equal(map(x => 2 * x, list(12, 11, 3)), list(24, 22, 6));`,
        Chapter.SOURCE_2,
      ).toEqual(true);
    });

    it('throws an error when not given a list', () => {
      return expectParsedError(`map(x=>x, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 47: tail: Expected pair, got [1, 2, 3].',
      );
    })
  });

  describe('javascript', () => {
    it('works with populated lists', () => {
      const xs = list.list(1, 2, 3);
      expect(list.map(x => `${x}`, xs)).toEqual(['1', ['2', ['3', null]]]);
    });

    it('works with empty lists', () => {
      expect(list.map(x => x + 1, list.list<number>())).toBeNull();
    });
  });
});

describe(list.member, () => {
  describe('javascript', () => {
    it('works', () => {
      const xs = list.list(1, 2, 3, 4, 123, 456, 789);
      expect(list.member(4, xs)).toEqual([
        4, [123, [456, [789, null]]]
      ])
    })

    it('works when element is not found', () => {
      const xs = list.list(1, 2, 3, 4, 123, 456, 789);
      expect(list.member(525600, xs)).toBeNull();
    })
  })

  describe('source', () => {
    test('member', () => {
      return expectFinishedResult(
        stripIndent`
        equal(
          member(4, list(1, 2, 3, 4, 123, 456, 789)),
          list(4, 123, 456, 789)
        );
        `,
        Chapter.SOURCE_2,
      ).toEqual(true);

    });

    test('non-list error member', () => {
      return expectParsedError(`member(1, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 136: head: Expected pair, got [1, 2, 3].',
      );
    });
  })
})

describe(list.pair, () => {
  describe('source', () => {
    it('creates pair', async () => {
      const {
        result: { value },
      } = await testSuccess(`pair(1, 'a string ""');`, Chapter.SOURCE_2);

      expect(value).toMatchInlineSnapshot(`
        Array [
          1,
          "a string \\"\\"",
        ]
      `);
    });
  });

  describe('javascript', () => {
    it('creates pair', () => {
      expect(list.pair(1, 2)).toEqual([1, 2]);
    });
  });
});

describe(list.remove, () => {
  describe('javascript', () => {
    it('works', () => {
      const xs = list.list(1,2,3);
      expect(list.remove(1, xs)).toEqual([2, [3, null]])
      expect(list.remove(2, xs)).toEqual([1, [3, null]])
      expect(list.remove(3, xs)).toEqual([1, [2, null]])
    })

    it('only removes the first instance', () => {
      const xs = list.list(1, 1, 1);
      expect(list.remove(1, xs)).toEqual([1, [1, null]]);
    })

    it('works when the element is not found', () => {
      const xs = list.list(1, 2, 3);
      expect(list.remove(4, xs)).toEqual([1, [2, [3, null]]]);
    })
  })

  describe('source', () => {
    test('remove', () => {
      return expectFinishedResult(`remove(1, list(1));`, Chapter.SOURCE_2).toBeNull();
    });

    test('remove not found', async () => {
      const {
        result: { value },
      } = await testSuccess(`remove(2, list(1));`, Chapter.SOURCE_2);
      expect(value).toMatchInlineSnapshot(`
        Array [
          1,
          null,
        ]
      `);
    });

    test('non-list error remove', () => {
      return expectParsedError(`remove(1, [1, 2, 3]);`, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 151: head: Expected pair, got [1, 2, 3].',
      );
    });
  })
})

describe(list.remove_all, () => {
  describe('javascript', () => {
    it('works', () => {
      const xs = list.list(1, 1, 2, 3, 1, 1);
      expect(list.remove_all(1, xs)).toEqual([2, [3, null]]);
    })

    it('returns the original when element is not found', () => {
      const xs = list.list(1, 1, 2, 3, 1, 1);
      expect(list.remove_all(5, xs)).toEqual([
        1, [1, [2, [3, [1, [1, null]]]]]
      ])
    })
  })

  describe('source', () => {
    test('remove_all', () => {
      return expectFinishedResult(
        `equal(remove_all(1, list(1, 2, 3, 4, 1, 1, 1, 5, 1, 1, 6)), list(2, 3, 4, 5, 6));`,
        Chapter.SOURCE_2,
      ).toEqual(true);
    });

    test('remove_all not found', () => {
      return expectFinishedResult(
        stripIndent`
        equal(remove_all(1, list(2, 3, 4)), list(2, 3, 4));
      `,
        Chapter.SOURCE_2,
      ).toEqual(true);
    });

    test('non-list error remove_all', () => {
      return expectParsedError(`remove_all(1, [1, 2, 3]); `, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 169: head: Expected pair, got [1, 2, 3].',
      );
    });
  })
})

describe(list.reverse, () => {
  describe('javascript', () => {
    it('works', () => {
      const xs = list.list(1, 2, 3);
      expect(list.reverse(xs)).toEqual([
        3, [2, [1, null]]
      ])
    })

    it('works with empty list', () => {
      expect(list.reverse(null)).toBeNull();
    })
  })

  describe('source', () => {
    test('reverse', () => {
      return expectFinishedResult(
        `equal(reverse(list("string", "null", "undefined", "null", 123)), list(123, "null", "undefined", "null", "string")); `,
        Chapter.SOURCE_2,
      ).toEqual(true);
    });

    test('non-list error reverse', () => {
      return expectParsedError(`reverse([1, 2, 3]); `, Chapter.SOURCE_3).toEqual(
        '[prelude] Line 106: tail: Expected pair, got [1, 2, 3].',
      );
    });
  })
})

describe(list.set_head, () => {
  describe('javascript', () => {
    it('throws when the argument is not a pair', () => {
      expect(() => list.set_head(0 as any, 0)).toThrow(
        'set_head: Expected pair, got 0.',
      );
    });
  });

  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        stripIndent`
        let p = pair(1, 2);
        const q = p;
        set_head(p, 3);
        p === q && equal(p, pair(3, 2));
      `,
        Chapter.SOURCE_3,
      ).toEqual(true);
    });

    it('throws an error when given not a pair', () => {
      return expectParsedError(`set_head([1, 2, 3], 4);`, Chapter.SOURCE_3).toEqual(
        'Line 1: set_head: Expected pair, got [1, 2, 3].',
      );
    })
  });
});

describe(list.set_tail, () => {
  describe('javascript', () => {
    it('throws when the argument is not a pair', () => {
      expect(() => list.set_tail(0 as any, 0)).toThrow('set_tail: Expected pair, got 0.');
    });
  })

  describe('source', () => {
    it('works', () => {
      return expectFinishedResult(
        stripIndent`
        let p = pair(1, 2);
        const q = p;
        set_tail(p, 3);
        p === q && equal(p, pair(1, 3));
      `,
        Chapter.SOURCE_3,
      ).toEqual(true);
    });

    it('throws an error when given not a pair', () => {
      return expectParsedError(`set_tail([1, 2, 3], 4);`, Chapter.SOURCE_3).toEqual(
        'Line 1: set_tail: Expected pair, got [1, 2, 3].'
      );
    });
  })
});

describe(list.tail, () => {
  it('throws an error when argument is not a pair (in Javascript)', () => {
    expect(() => list.tail(0 as any)).toThrow(
      'tail: Expected pair, got 0.',
    );
  });

  it('works', () => {
    return expectFinishedResult(`tail(pair(1, 'a string ""'));`, Chapter.SOURCE_2).toEqual(
      'a string ""',
    );
  });

  test('tail of a 1 element list is null', () => {
    return expectFinishedResult(`tail(list(1));`, Chapter.SOURCE_2).toBeNull();
  });

  test('non-list error tail (in Source)', () => {
    return expectParsedError(
      stripIndent`
    tail([1, 2, 3]);
  `,
      Chapter.SOURCE_3,
    ).toEqual('Line 1: tail: Expected pair, got [1, 2, 3].');
  });
});

describe(list.vector_to_list, () => {
  describe('javascript', () => {
    it('preserves element order', () => {
      let xs = list.vector_to_list([1, 2, 3]) as list.NonEmptyList<number>;

      for (let i = 1; i < 4; i++) {
        expect(list.head(xs)).toEqual(i);
        xs = list.tail(xs) as list.NonEmptyList<number>;
      }

      expect(xs).toBeNull();
    });
  });
});

test('equal', () => {
  return expectFinishedResult(`!equal(1, x => x) && !equal(x => x, 1);`, Chapter.SOURCE_2).toEqual(
    true,
  );
});

test('list_to_string', () => {
  return expectFinishedResult(`list_to_string(list(1, 2, 3));`, Chapter.SOURCE_2).toEqual(
    '[1,[2,[3,null]]]',
  );
});

// assoc removed from Source
test.todo('assoc', () => {
  return expectFinishedResult(
    `equal(assoc(3, list(pair(1, 2), pair(3, 4))), pair(3, 4));`,
    Chapter.LIBRARY_PARSER,
  ).toEqual(true);
});

test.todo('assoc not found', () => {
  return expectFinishedResult(
    `equal(assoc(2, list(pair(1, 2), pair(3, 4))), false);`,
    Chapter.LIBRARY_PARSER,
  ).toEqual(true);
});

test.todo('non-list error assoc', () => {
  return expectParsedError(`assoc(1, [1, 2, 3]);`, Chapter.LIBRARY_PARSER).toEqual(
    'Line 1: Name assoc not declared.',
    );
});

describe('display_list', () => {
  async function testForDisplayResult(code: string, chapter: Chapter = Chapter.SOURCE_2) {
    const {
      context: { displayResult },
    } = await testSuccess(code, chapter);
    return displayResult;
  }

  test('standard acyclic', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => i, 5));
        0; // suppress long result in snapshot
      `,
    );

    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(0, 1, 2, 3, 4)",
      ]
      `);
  });

  test('standard acyclic 2', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => j, i), 5));
        0; // suppress long result in snapshot
      `,
    );

    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(null, list(0), list(0, 1), list(0, 1, 2), list(0, 1, 2, 3))",
      ]
      `);
  });

  test('standard acyclic with pairs', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => pair(j, j), i), 5));
        0; // suppress long result in snapshot
      `,
    );

    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(null,
           list([0, 0]),
           list([0, 0], [1, 1]),
           list([0, 0], [1, 1], [2, 2]),
           list([0, 0], [1, 1], [2, 2], [3, 3]))",
      ]
    `);
  });

  test('standard acyclic with pairs 2', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => pair(build_list(k => k, j), j), i), 5));
        0; // suppress long result in snapshot
      `,
    );

    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(null,
           list([null, 0]),
           list([null, 0], [list(0), 1]),
           list([null, 0], [list(0), 1], [list(0, 1), 2]),
           list([null, 0], [list(0), 1], [list(0, 1), 2], [list(0, 1, 2), 3]))",
      ]
    `);
  });

  test('returns argument', () => {
    return expectFinishedResult(
      stripIndent`
        const xs = build_list(i => i, 5);
        xs === display_list(xs);
        // Note reference equality
      `,
      Chapter.SOURCE_3,
    ).toEqual(true);
  });

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
      Chapter.SOURCE_3,
    ).toEqual(true);
  });

  test('supports prepend string', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => i, 5), "build_list:");
        0; // suppress long result in snapshot
      `,
    );
    expect(result).toMatchInlineSnapshot(`
      Array [
        "build_list: list(0, 1, 2, 3, 4)",
      ]
      `);
  });

  test('checks prepend type', () => {
    return expectParsedError(
      stripIndent`
        display_list(build_list(i => i, 5), true);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2,
    ).toEqual('Line 1: display_list: Expected string for second argument, got true.');
  });

  /**************
   * FUZZ TESTS *
   **************/

  test('MCE fuzz test', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(parse('const twice = f => x => {const result = f(f(x)); return two;};'));
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_4,
    );

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
`);
  });

  test('standard acyclic multiline', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        display_list(build_list(i => build_list(j => j, i), 20));
        0; // suppress long result in snapshot
      `,
    );

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
`);
  });

  test('infinite list', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        const p = list(1);
        set_tail(p, p);
        display_list(p);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_3,
    );

    expect(result).toMatchInlineSnapshot(`
      Array [
        "[1, ...<circular>]",
      ]
      `);
  });

  test('infinite list 2', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        const p = list(1, 2, 3);
        set_tail(tail(tail(p)), p);
        display_list(p);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_3,
    );
    expect(result).toMatchInlineSnapshot(`
      Array [
        "[1, [2, [3, ...<circular>]]]",
      ]
      `);
  });

  test('reusing lists', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        const p = list(1);
        const p2 = pair(p, p);
        const p3 = list(p, p2);
        display_list(p3);
        0; // suppress long result in snapshot
      `,
      Chapter.SOURCE_2,
    );
    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(list(1), list(list(1), 1))",
      ]
      `);
  });

  test('reusing lists 2', async () => {
    const result = await testForDisplayResult(
      stripIndent`
        const p1 = pair(1, null);
        const p2 = pair(2, p1);
        const p3 = list(p1, p2);
        display_list(p3);
        0; // suppress long result in snapshot
      `,
    );
    expect(result).toMatchInlineSnapshot(`
      Array [
        "list(list(1), list(2, 1))",
      ]
      `);
  });

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
      Chapter.SOURCE_3,
    );

    expect(result).toMatchInlineSnapshot(`
      Array [
        "list([0, ...<circular>],
           [0, [1, ...<circular>]],
           [0, [1, [2, ...<circular>]]],
           [0, [1, [2, [3, ...<circular>]]]],
           [0, [1, [2, [3, [4, ...<circular>]]]]])",
      ]
    `);
  });

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
      Chapter.SOURCE_3,
    );

    expect(result).toMatchInlineSnapshot(`
      Array [
        "list([null, ...<circular>],
           [null, [list(0), ...<circular>]],
           [null, [list(0), [list(0, 1), ...<circular>]]])",
      ]
    `);
  });

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
      Chapter.SOURCE_3,
    );

    expect(result).toMatchInlineSnapshot(`
      Array [
        "[ null,
      [ list([0, ...<circular>]),
      [ list([0, ...<circular>], [0, [1, ...<circular>]]),
      [ list([0, ...<circular>], [0, [1, ...<circular>]], [0, [1, [2, ...<circular>]]]),
      ...<circular>]]]]",
      ]
      `);
  });
});
