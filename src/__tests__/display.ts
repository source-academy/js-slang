import { Chapter } from '../types'
import { expectDisplayResult, expectParsedError } from '../utils/testing'

type TestCase =
  | [desc: string, code: string, expectedDisplay: string[], chapter: Chapter]
  | [desc: string, code: string, expectedDisplay: string[]]

const testCases: TestCase[] = [
  [
    'display second argument can be a string',
    `display(31072020, "my_first_String");`,
    ['my_first_String 31072020']
  ],
  ['display can be used to display numbers', 'display(0);', ['0']],
  [
    'display can be used to display funny numbers',
    `display(1e38); display(NaN); display(Infinity);`,
    ['1e+38', 'NaN', 'Infinity']
  ],
  [
    'display can be used to display (escaped) strings',
    `display("Tom's assistant said: \\"tuna.\\"");`,
    [`"Tom's assistant said: \\"tuna.\\""`]
  ],
  [
    'raw_display can be used to display (unescaped) strings directly',
    `raw_display("Tom's assistant said: \\"tuna.\\"");`,
    [`Tom's assistant said: "tuna."`]
  ],
  [
    'display can be used to display functions',
    `display(x => x); display((x, y) => x + y);`,
    ['x => x', '(x, y) => x + y']
  ],
  [
    'display can be used to display lists',
    `display(list(1, 2));`,
    ['[1, [2, null]]'],
    Chapter.SOURCE_2
  ],
  [
    'display can be used to display arrays',
    `display([1, 2, [4, 5]]);`,
    ['[1, 2, [4, 5]]'],
    Chapter.SOURCE_3
  ],
  [
    'display can be used to display objects',
    `display({a: 1, b: 2, c: {d: 3}});`,
    ['{"a": 1, "b": 2, "c": {"d": 3}}'],
    Chapter.LIBRARY_PARSER
  ]
]

test.each(testCases)('%s', (_, code, expectedDisplay, chapter = undefined) =>
  expectDisplayResult(code, chapter).toMatchObject(expectedDisplay)
)

test('display with no arguments throws an error', () => {
  return expectParsedError(`display();`, Chapter.LIBRARY_PARSER).toMatchInlineSnapshot(
    `"Line 1: Expected 1 or more arguments, but got 0."`
  )
})

test('display throw error if second argument is non-string when used', () => {
  return expectParsedError(`display(31072020, 0xDEADC0DE);`).toMatchInlineSnapshot(
    `"Line 1: TypeError: display expects the second argument to be a string"`
  )
})
