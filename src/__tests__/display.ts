import { runInContext } from '..'
import { Chapter } from '../types'
import { stripIndent } from '../utils/formatters'
import { createTestContext, expectFinishedResult, expectParsedError } from '../utils/testing'
import { testMultipleCases } from '../utils/testing/testers'

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
      'display can be used to display functions',
      `
      function f() { return 0; }
      display(f);
    `,
      stripIndent`
      function f() {
        return 0; 
      }
    `
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
  async ([code, ...expected]) => {
    const context = createTestContext({ chapter: Chapter.LIBRARY_PARSER })
    const result = await runInContext(code, context)

    expectFinishedResult(result)
    expect(context.displayResult).toEqual(expected)
  }
)

test('display throw error if second argument is non-string when used', () => {
  return expectParsedError(`display(31072020, 0xDEADC0DE);`).toMatchInlineSnapshot(
    `"Line 1: TypeError: display expects the second argument to be a string"`
  )
})

test('display with no arguments throws an error', () => {
  return expectParsedError(`display();`, { chapter: Chapter.LIBRARY_PARSER }).toMatchInlineSnapshot(
    `"Line 1: Expected 1 or more arguments, but got 0."`
  )
})
