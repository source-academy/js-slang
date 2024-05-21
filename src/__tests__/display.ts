import { Chapter } from '../types'
import { stripIndent } from '../utils/formatters'
import { testMultipleCases, expectParsedError, expectDisplayResult } from '../utils/testing/testers'

testMultipleCases<[string, ...string[]]>(
  [
    [
      'display second argument can be a string',
      `display(31072020, "my_first_String");`,
      'my_first_String 31072020'
    ],
    ['display can be used to display numbers', 'display(0);', '0'],
    [
      'display can be used to display funny numbers',
      'display(1e38); display(NaN); display(Infinity);',
      '1e+38',
      'NaN',
      'Infinity'
    ],
    [
      'display can be used to display (escaped) strings',
      `display("Tom's assistant said: \\"tuna.\\"");`,
      '"Tom\'s assistant said: \\"tuna.\\""'
    ],
    [
      'raw_display can be used to displayed (unescaped) strings directly',
      `raw_display("Tom's assisstant said: \\"tuna.\\"");`,
      'Tom\'s assisstant said: "tuna."'
    ],
    [
      'display can be used to display arrow functions',
      `display(x => x); display((x, y) => x + y);`,
      'x => x',
      '(x, y) => x + y'
    ],
    [
      'displaying builtins hides their implementation',
      'display(pair);',
      stripIndent`
      function pair(left, right) {
        [implementation hidden]
      }
    `
    ],
    ['display can be used with lists', 'display(list(1, 2));', '[1, [2, null]]'],
    ['display can be used with arrays', 'display([1, 2, [4, 5]]);', '[1, 2, [4, 5]]'],
    [
      'display can be used with objects',
      `display({a: 1, b: 2, c: {d: 3}});`,
      '{"a": 1, "b": 2, "c": {"d": 3}}'
    ]
  ],
  ([code, ...expected]) => {
    return expectDisplayResult(code, Chapter.LIBRARY_PARSER).toEqual(expected)
  }
)

test('display can be used to display functions', () => {
  return expectDisplayResult(`display(x => x); display((x, y) => x + y);`, Chapter.LIBRARY_PARSER)
    .toMatchInlineSnapshot(`
Array [
  "x => x",
  "(x, y) => x + y",
]
`)
})

test('String representation of builtins are nice', () => {
  return expectDisplayResult('display(pair);', Chapter.SOURCE_2).toMatchInlineSnapshot(`
  Array [
  "function pair(left, right) {
    [implementation hidden]
  }"
  ]
  `)
})

test('display throw error if second argument is non-string when used', () => {
  return expectParsedError(`display(31072020, 0xDEADC0DE);`, Chapter.LIBRARY_PARSER).toEqual(
    'Line 1: TypeError: display expects the second argument to be a string'
  )
})

test('display with no arguments throws an error', () => {
  return expectParsedError(`display();`, Chapter.LIBRARY_PARSER).toEqual(
    'Line 1: Expected 1 or more arguments, but got 0.'
  )
})
