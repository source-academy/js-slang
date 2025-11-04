import { expect, test } from 'vitest'
import { Chapter } from '../langs'
import { stripIndent } from '../utils/formatters'
import {
  lineTreeToString,
  stringDagToLineTree,
  stringify,
  valueToStringDag
} from '../utils/stringify'
import { expectFinishedResult, testSuccess } from '../utils/testing'

test('String representation of numbers are nice', () => {
  return expectFinishedResult(`stringify(0); `).toEqual('0')
})

test('String representation of strings are nice', () => {
  return expectFinishedResult(`stringify('a string');`).toEqual('"a string"')
})

test('String representation of booleans are nice', () => {
  return expectFinishedResult(`stringify(true);`).toEqual('true')
})

test('String representation of functions are nice', async () => {
  const {
    result: { value }
  } = await testSuccess(
    stripIndent`
  function f(x, y) {
    return x;
  }
  stringify(f);
  `
  )

  expect(value).toMatchInlineSnapshot(`
    "function f(x, y) {
      return x;
    }"
  `)
})

test('String representation of arrow functions are nice', () => {
  return expectFinishedResult(
    stripIndent`
      const f = (x, y) => x;
      stringify(f);
    `
  ).toEqual('(x, y) => x')
})

test('String representation of arrays are nice', () => {
  return expectFinishedResult(
    stripIndent`
  const xs = [1, 'true', true, () => 1];
  stringify(xs);
  `,
    Chapter.SOURCE_3
  ).toEqual('[1, "true", true, () => 1]')
})

test('String representation of multidimensional arrays are nice', () => {
  return expectFinishedResult(
    stripIndent`
  const xs = [1, 'true', [true, () => 1, [[]]]];
  stringify(xs);
  `,
    Chapter.SOURCE_3
  ).toEqual('[1, "true", [true, () => 1, [[]]]]')
})

test('String representation of empty arrays are nice', () => {
  return expectFinishedResult(`stringify([]); `, Chapter.SOURCE_3).toEqual('[]')
})

test('String representation of lists are nice', () => {
  return expectFinishedResult(`stringify(enum_list(1, 10));`, Chapter.SOURCE_2).toEqual(
    '[1, [2, [3, [4, [5, [6, [7, [8, [9, [10, null]]]]]]]]]]'
  )
})

test('Correctly handles circular structures with multiple entry points', async () => {
  const {
    result: { value }
  } = await testSuccess(
    stripIndent`
  const x = enum_list(1, 3);
  set_tail(tail(tail(x)), x);
  stringify(list(x, tail(x), tail(tail(x))));
  `,
    Chapter.SOURCE_3
  )
  expect(value).toMatchInlineSnapshot(`
            "[ [1, [2, [3, ...<circular>]]],
            [[2, [3, [1, ...<circular>]]], [[3, [1, [2, ...<circular>]]], null]]]"
          `)
})

// The interpreter runs into a MaximumStackLimitExceeded error on 1000, so reduced it to 100.
test('String representation of huge lists are nice', async () => {
  const {
    result: { value }
  } = await testSuccess(`stringify(enum_list(1, 100));`, Chapter.SOURCE_2)
  expect(value).toMatchInlineSnapshot(`
            "[ 1,
            [ 2,
            [ 3,
            [ 4,
            [ 5,
            [ 6,
            [ 7,
            [ 8,
            [ 9,
            [ 10,
            [ 11,
            [ 12,
            [ 13,
            [ 14,
            [ 15,
            [ 16,
            [ 17,
            [ 18,
            [ 19,
            [ 20,
            [ 21,
            [ 22,
            [ 23,
            [ 24,
            [ 25,
            [ 26,
            [ 27,
            [ 28,
            [ 29,
            [ 30,
            [ 31,
            [ 32,
            [ 33,
            [ 34,
            [ 35,
            [ 36,
            [ 37,
            [ 38,
            [ 39,
            [ 40,
            [ 41,
            [ 42,
            [ 43,
            [ 44,
            [ 45,
            [ 46,
            [ 47,
            [ 48,
            [ 49,
            [ 50,
            [ 51,
            [ 52,
            [ 53,
            [ 54,
            [ 55,
            [ 56,
            [ 57,
            [ 58,
            [ 59,
            [ 60,
            [ 61,
            [ 62,
            [ 63,
            [ 64,
            [ 65,
            [ 66,
            [ 67,
            [ 68,
            [ 69,
            [ 70,
            [ 71,
            [ 72,
            [ 73,
            [ 74,
            [ 75,
            [ 76,
            [ 77,
            [ 78,
            [ 79,
            [ 80,
            [ 81,
            [ 82,
            [ 83,
            [ 84,
            [ 85,
            [ 86,
            [ 87,
            [ 88,
            [89, [90, [91, [92, [93, [94, [95, [96, [97, [98, [99, [100, null]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]"
          `)
})

test('String representation of huge arrays are nice', async () => {
  const {
    result: { value }
  } = await testSuccess(
    stripIndent`
  const arr = [];
  for (let i = 0; i < 100; i = i + 1) {
    arr[i] = i;
  }
  stringify(arr);
  `,
    Chapter.SOURCE_3
  )

  expect(value).toMatchInlineSnapshot(`
            "[ 0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9,
              10,
              11,
              12,
              13,
              14,
              15,
              16,
              17,
              18,
              19,
              20,
              21,
              22,
              23,
              24,
              25,
              26,
              27,
              28,
              29,
              30,
              31,
              32,
              33,
              34,
              35,
              36,
              37,
              38,
              39,
              40,
              41,
              42,
              43,
              44,
              45,
              46,
              47,
              48,
              49,
              50,
              51,
              52,
              53,
              54,
              55,
              56,
              57,
              58,
              59,
              60,
              61,
              62,
              63,
              64,
              65,
              66,
              67,
              68,
              69,
              70,
              71,
              72,
              73,
              74,
              75,
              76,
              77,
              78,
              79,
              80,
              81,
              82,
              83,
              84,
              85,
              86,
              87,
              88,
              89,
              90,
              91,
              92,
              93,
              94,
              95,
              96,
              97,
              98,
              99]"
          `)
})

test('String representation of objects are nice', () => {
  return expectFinishedResult(
    stripIndent`
  const o = { a: 1, b: true, c: () => 1 };
  stringify(o);
  `,
    Chapter.LIBRARY_PARSER
  ).toEqual(`{"a": 1, "b": true, "c": () => 1}`)
})

test('String representation of objects with toReplString member calls toReplString', () => {
  return expectFinishedResult(
    stripIndent`
  const o = { toReplString: () => '<RUNE>' };
  stringify(o);
  `,
    Chapter.LIBRARY_PARSER
  ).toEqual('<RUNE>')
})

test('String representation of nested objects are nice', () => {
  return expectFinishedResult(
    stripIndent`
  const o = { a: 1, b: true, c: () => 1, d: { e: 5, f: 6 } };
  stringify(o);
  `,
    Chapter.LIBRARY_PARSER
  ).toEqual(`{"a": 1, "b": true, "c": () => 1, "d": {"e": 5, "f": 6}}`)
})

test('String representation of big objects are nice', async () => {
  const {
    result: { value }
  } = await testSuccess(
    stripIndent`
  const o = { a: 1, b: true, c: () => 1, d: { e: 5, f: 6 }, g: 0, h: 0, i: 0, j: 0, k: 0, l: 0, m: 0, n: 0};
  stringify(o);
  `,
    Chapter.LIBRARY_PARSER
  )

  expect(value).toMatchInlineSnapshot(`
    "{ \\"a\\": 1,
      \\"b\\": true,
      \\"c\\": () => 1,
      \\"d\\": {\\"e\\": 5, \\"f\\": 6},
      \\"g\\": 0,
      \\"h\\": 0,
      \\"i\\": 0,
      \\"j\\": 0,
      \\"k\\": 0,
      \\"l\\": 0,
      \\"m\\": 0,
      \\"n\\": 0}"
  `)
})

test('String representation of nested objects (circular) are nice', () => {
  return expectFinishedResult(
    stripIndent`
  let o = {};
  o.o = o;
  stringify(o);
  `,
    Chapter.LIBRARY_PARSER
  ).toEqual(`{"o": ...<circular>}`)
})

test('String representation of non literal objects is nice', () => {
  const errorMsg: string = 'This is an error'
  const errorObj: Error = new Error(errorMsg)
  return expect(stringify(errorObj)).toMatchInlineSnapshot(`"${errorObj.toString()}"`)
})

test('String representation of non literal objects in nested object is nice', () => {
  const errorMsg: string = 'This is an error'
  const errorObj: Error = new Error(errorMsg)
  const nestedObj = {
    data: [1, [2, errorObj], 3]
  }
  return expect(stringify(nestedObj)).toMatchInlineSnapshot(
    `"{\\"data\\": [1, [2, ${errorObj.toString()}], 3]}"`
  )
})

test('String representation of instances is nice', () => {
  class TestClass {
    data: string
    constructor(data: string) {
      this.data = data
    }
    toString() {
      return `testClass instance: ${this.data}`
    }
  }
  const testClassInst = new TestClass('test1')
  return expect(stringify(testClassInst)).toMatchInlineSnapshot(`"${testClassInst.toString()}"`)
})

test('Builtins hide their implementation when stringify', async () => {
  const {
    result: { value }
  } = await testSuccess('stringify(pair);', Chapter.SOURCE_2)
  return expect(value).toMatchInlineSnapshot(`
    "function pair(left, right) {
    	[implementation hidden]
    }"
  `)
})

test('String representation of null is nice', () => {
  return expectFinishedResult(`stringify(null); `, Chapter.SOURCE_2).toEqual('null')
})

test('String representation of undefined is nice', () => {
  return expectFinishedResult(`stringify(undefined);`).toEqual('undefined')
})

test('String representation with no indent', async () => {
  const {
    result: { value }
  } = await testSuccess(stripIndent`stringify(parse('x=>x;'), 0);`, Chapter.SOURCE_4)
  expect(value).toMatchInlineSnapshot(`
            "[\\"lambda_expression\\",
            [[[\\"name\\", [\\"x\\", null]], null],
            [[\\"return_statement\\", [[\\"name\\", [\\"x\\", null]], null]], null]]]"
          `)
})

test('String representation with 1 space indent', async () => {
  const {
    result: { value }
  } = await testSuccess(stripIndent`stringify(parse('x=>x;'), 1);`, Chapter.SOURCE_4)
  expect(value).toMatchInlineSnapshot(`
            "[\\"lambda_expression\\",
            [[[\\"name\\", [\\"x\\", null]], null],
            [[\\"return_statement\\", [[\\"name\\", [\\"x\\", null]], null]], null]]]"
          `)
})

test('String representation with default (2 space) indent', async () => {
  const {
    result: { value }
  } = await testSuccess(stripIndent`stringify(parse('x=>x;'), 1);`, Chapter.SOURCE_4)
  expect(value).toMatchInlineSnapshot(`
    "[\\"lambda_expression\\",
    [[[\\"name\\", [\\"x\\", null]], null],
    [[\\"return_statement\\", [[\\"name\\", [\\"x\\", null]], null]], null]]]"
  `)
})

test('String representation with more than 10 space indent should trim to 10 space indent', async () => {
  const {
    result: { value }
  } = await testSuccess(stripIndent`stringify(parse('x=>x;'), 100);`, Chapter.SOURCE_4)
  expect(value).toMatchInlineSnapshot(`
            "[         \\"lambda_expression\\",
            [         [[\\"name\\", [\\"x\\", null]], null],
            [[\\"return_statement\\", [[\\"name\\", [\\"x\\", null]], null]], null]]]"
          `)
})

test('lineTreeToString', () => {
  return expect(
    lineTreeToString({
      type: 'block',
      prefixFirst: '[ ',
      prefixRest: '  ',
      block: [
        {
          type: 'block',
          prefixFirst: '[ ',
          prefixRest: '  ',
          block: [
            { type: 'line', line: { type: 'terminal', str: 'why', length: 3 } },
            { type: 'line', line: { type: 'terminal', str: 'hello', length: 5 } }
          ],
          suffixRest: ',',
          suffixLast: ' ]'
        },
        { type: 'line', line: { type: 'terminal', str: 'there', length: 5 } },
        { type: 'line', line: { type: 'terminal', str: 'sethbling here', length: 42 } }
      ],
      suffixRest: ',',
      suffixLast: ' ]'
    })
  ).toMatchInlineSnapshot(`
            "[ [ why,
                hello ],
              there,
              sethbling here ]"
          `)
})

test('stringDagToLineTree', () => {
  return expect(
    lineTreeToString(
      stringDagToLineTree(
        {
          type: 'multiline',
          lines: ['hello world', 'why hello there', "it's a", '  multiline', 'string!'],
          length: 42
        },
        2,
        80
      )
    )
  ).toMatchInlineSnapshot(`
            "hello world
            why hello there
            it's a
              multiline
            string!"
          `)
})

test('stringDagToLineTree part 2', () => {
  return expect(
    stringDagToLineTree(
      {
        type: 'pair',
        head: { type: 'terminal', str: '42', length: 2 },
        tail: {
          type: 'pair',
          head: { type: 'terminal', str: '69', length: 2 },
          tail: { type: 'terminal', str: 'null', length: 4 },
          length: 42
        },
        length: 42
      },
      2,
      80
    )
  ).toMatchInlineSnapshot(`
            Object {
              "line": Object {
                "head": Object {
                  "length": 2,
                  "str": "42",
                  "type": "terminal",
                },
                "length": 42,
                "tail": Object {
                  "head": Object {
                    "length": 2,
                    "str": "69",
                    "type": "terminal",
                  },
                  "length": 42,
                  "tail": Object {
                    "length": 4,
                    "str": "null",
                    "type": "terminal",
                  },
                  "type": "pair",
                },
                "type": "pair",
              },
              "type": "line",
            }
          `)
})

test('stringDagToLineTree part 3', () => {
  return expect(
    lineTreeToString(
      stringDagToLineTree(
        {
          type: 'pair',
          head: { type: 'terminal', str: '42', length: 2 },
          tail: {
            type: 'pair',
            head: { type: 'terminal', str: '69', length: 2 },
            tail: { type: 'terminal', str: 'null', length: 4 },
            length: 42
          },
          length: 42
        },
        2,
        80
      )
    )
  ).toMatchInlineSnapshot(`"[42, [69, null]]"`)
})

test('stringDagToLineTree part 4', () => {
  return expect(
    lineTreeToString(
      stringDagToLineTree(
        {
          type: 'pair',
          head: { type: 'terminal', str: '42', length: 2 },
          tail: {
            type: 'pair',
            head: { type: 'terminal', str: '69', length: 2 },
            tail: { type: 'terminal', str: 'null', length: 4 },
            length: 42
          },
          length: 99
        },
        2,
        80
      )
    )
  ).toMatchInlineSnapshot(`
            "[ 42,
            [69, null]]"
          `)
})

test('value to StringDag', () => {
  return expect(
    lineTreeToString(
      stringDagToLineTree(
        valueToStringDag([
          1,
          [
            2,
            [
              3,
              [
                4,
                [
                  5,
                  [
                    6,
                    [
                      7,
                      [
                        8,
                        [9, [10, [11, [12, [13, [14, [15, [16, [17, [18, [19, [20, null]]]]]]]]]]]]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]),
        2,
        80
      )
    )
  ).toMatchInlineSnapshot(`
            "[ 1,
            [ 2,
            [ 3,
            [ 4,
            [ 5,
            [ 6,
            [ 7,
            [8, [9, [10, [11, [12, [13, [14, [15, [16, [17, [18, [19, [20, null]]]]]]]]]]]]]]]]]]]]"
          `)
})
