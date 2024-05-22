import { list, set_tail, tail } from '../../stdlib/list'
import { Chapter, type Value } from '../../types'
import { stripIndent } from '../formatters'
import { lineTreeToString, stringDagToLineTree, stringify, valueToStringDag } from '../stringify'
import { expectResult, testMultipleCases } from '../testing'

type TestCase = [desc: string, valueToStringify: Value, expected: string]
const cases: TestCase[] = [
  // Primitives
  ['String representation of numbers are nice', 0, '0'],
  ['String representation of string are nice', 'a string', '"a string"'],
  ['String representation of booleans are nice', true, 'true'],
  [
    'String representation of arrow functions are nice',
    // @ts-ignore
    (x, y) => x,
    '(x, y) => x'
  ],
  ['String representation of null is nice', null, 'null'],
  ['String representation of undefined is nice', undefined, 'undefined'],

  // Arrays
  [
    'String representations of arrays are nice',
    [1, 'true', true, () => 1],
    '[1, "true", true, () => 1]'
  ],
  [
    'String representation of multidimensional arrays are nice',
    [1, 'true', [true, () => 1, [[]]]],
    '[1, "true", [true, () => 1, [[]]]]'
  ],
  ['String representation of empty arrays are nice', [], '[]'],
  ['String representation works with arrays with holes 1', [, []], '[undefined, []]'],
  ['String representation works with arrays with holes 2', [, , []], '[undefined, undefined, []]'],
  [
    'String representation of huge arrays is nice',
    Array.from(Array(100)).map((_, i) => i),
    stripIndent`
            [ 0,
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
              99]
      `
  ],

  // Lists
  [
    'String representtion of lists are nice',
    list(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
    '[1, [2, [3, [4, [5, [6, [7, [8, [9, [10, null]]]]]]]]]]'
  ],
  [
    'String representation of huge lists are nice',
    list(...Array.from(Array(100)).map((_, i) => i + 1)),
    stripIndent`
            [ 1,
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
            [89, [90, [91, [92, [93, [94, [95, [96, [97, [98, [99, [100, null]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]
           `
  ],

  // Objects
  [
    'String representation of objects is nice',
    { a: 1, b: true, c: () => 1 },
    '{"a": 1, "b": true, "c": () => 1}'
  ],
  [
    'String representation of nested objects is nice',
    { a: 1, b: true, c: () => 1, d: { e: 5, f: 6 } },
    '{"a": 1, "b": true, "c": () => 1, "d": {"e": 5, "f": 6}}'
  ],
  [
    'String representation of big objects are nice',
    {
      a: 1,
      b: true,
      c: () => 1,
      d: { e: 5, f: 6 },
      g: 0,
      h: 0,
      i: 0,
      j: 0,
      k: 0,
      l: 0,
      m: 0,
      n: 0
    },
    stripIndent`
            { "a": 1,
              "b": true,
              "c": () => 1,
              "d": {"e": 5, "f": 6},
              "g": 0,
              "h": 0,
              "i": 0,
              "j": 0,
              "k": 0,
              "l": 0,
              "m": 0,
              "n": 0}
          `
  ]
]

testMultipleCases(cases, ([value, expected]) => {
  expect(stringify(value)).toEqual(expected)
})

// Test cases that are a little bit more complicated
test('Correctly handles circular lists with multiple entry points', () => {
  const x = list(1, 2, 3)
  set_tail(tail(tail(x)), x)
  const value = stringify(list(x, tail(x), tail(tail(x))))
  expect(value).toEqual(
    stripIndent`[ [1, [2, [3, ...<circular>]]],\n[[2, [3, [1, ...<circular>]]], [[3, [1, [2, ...<circular>]]], null]]]`
  )
})

test('String representation of functions are nice', () => {
  // @ts-ignore
  function f(x, y) {
    return x
  }

  return expect(stringify(f)).toMatchInlineSnapshot(`
      "function f(x, y) {
        return x;
      }"
    `)
})

test('String representation of non literal objects is nice', () => {
  const errorMsg: string = 'This is an error'
  const errorObj: Error = new Error(errorMsg)
  return expect(stringify(errorObj)).toMatchInlineSnapshot(`"${errorObj.toString()}"`)
})

test('String representation of non literal objects in nested object is nice', () => {
  const errorMsg: string = 'This is an error'
  const errorObj: Error = new Error(errorMsg)
  const nestedObj: Object = {
    data: [1, [2, errorObj], 3]
  }
  return expect(stringify(nestedObj)).toMatchInlineSnapshot(
    `"{\\"data\\": [1, [2, ${errorObj.toString()}], 3]}"`
  )
})

test('String representation of objects with circular references is nice', () => {
  let o: any = {}
  o.o = o
  expect(stringify(o)).toEqual('{"o": ...<circular>}')
})

test('String representation of objects with toReplString member calls toReplString', () => {
  const toReplString = jest.fn(() => '<RUNE>')
  const o = { toReplString }
  expect(stringify(o)).toEqual('<RUNE>')
  expect(toReplString).toHaveBeenCalledTimes(1)
})

test('String representation of builtins are nice', () => {
  return expectResult(
    stripIndent`
  stringify(pair);
  `,
    Chapter.SOURCE_2
  ).toMatchInlineSnapshot(`
            "function pair(left, right) {
            	[implementation hidden]
            }"
          `)
})

test('String representation with 1 space indent', () => {
  return expectResult(
    stripIndent`
  stringify(parse('x=>x;'), 1);
  `,
    Chapter.SOURCE_4
  ).toMatchInlineSnapshot(`
            "[\\"lambda_expression\\",
            [[[\\"name\\", [\\"x\\", null]], null],
            [[\\"return_statement\\", [[\\"name\\", [\\"x\\", null]], null]], null]]]"
          `)
})

test('String representation with default (2 space) indent', () => {
  return expectResult(
    stripIndent`
  stringify(parse('x=>x;'));
  `,
    Chapter.SOURCE_4
  ).toMatchInlineSnapshot(`
            "[ \\"lambda_expression\\",
            [ [[\\"name\\", [\\"x\\", null]], null],
            [[\\"return_statement\\", [[\\"name\\", [\\"x\\", null]], null]], null]]]"
          `)
})

test('String representation with more than 10 space indent should trim to 10 space indent', () => {
  return expectResult(
    stripIndent`
  stringify(parse('x=>x;'), 100);
  `,
    Chapter.SOURCE_4
  ).toMatchInlineSnapshot(`
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
