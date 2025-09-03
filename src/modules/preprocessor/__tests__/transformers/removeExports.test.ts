import { describe, expect, test } from 'vitest'
import { mockContext } from '../../../../utils/testing/mocks'
import { parse } from '../../../../parser/parser'
import type { Context } from '../../../../types'
import { Chapter } from '../../../../langs'
import removeExports from '../../transformers/removeExports'
import { sanitizeAST } from '../../../../utils/testing/sanitizer'

type TestCase = [description: string, inputCode: string, expectedCode: string]

let actualContext: Context
let expectedContext: Context

function testCases(suiteDesc: string, testCases: TestCase[]) {
  describe(suiteDesc, () =>
    test.each(testCases)('%s', (_, inputCode, expectedCode) => {
      actualContext = mockContext(Chapter.LIBRARY_PARSER)
      expectedContext = mockContext(Chapter.LIBRARY_PARSER)

      // Parse both the code we're giving to removeExports, as well
      // as the code we expect to get from removeExports
      const actualProgram = parse(inputCode, actualContext)
      const expectedProgram = parse(expectedCode, expectedContext)
      if (actualProgram === null || expectedProgram === null) {
        // If there are any errors in the given code throw an error
        throw new Error('Failed to parse expected code or actual code')
      }
      removeExports(actualProgram)

      // Assert that both parsed ASTs are equal to each other
      expect(sanitizeAST(actualProgram)).toEqual(sanitizeAST(expectedProgram))
    })
  )
}

describe(removeExports, () => {
  testCases('removes ExportNamedDeclaration nodes', [
    [
      'when exporting variable declarations',
      `
      export const x = 42;
      export let y = 53;
      `,
      `
      const x = 42;
      let y = 53;
      `
    ],
    [
      'when exporting function declarations',
      `
      export function square(x) {
        return x * x;
      }
      `,
      `
      function square(x) {
        return x * x;
      }
      `
    ],
    [
      'when exporting arrow function declarations',
      'export const square = x => x * x;',
      'const square = x => x * x;'
    ],
    [
      'when exporting renamed identifiers',
      `
        const x = 42;
        let y = 53;
        function square(x) {
          return x * x;
        }
        const id = x => x;
        export { x, y, square as sq, id as default };
      `,
      `
        const x = 42;
        let y = 53;
        function square(x) {
          return x * x;
        }
        const id = x => x;
      `
    ]
  ])

  testCases('removes ExportDefaultDeclaration node', [
    // Default exports of variable declarations
    // is not allowed in ES6, and will be caught by the Acorn parser.
    [
      'when exporting function declarations',
      `
        export default function square(x) {
          return x * x;
        }
      `,
      `
        function square(x) {
          return x * x;
        }
      `
    ],
    [
      'when exporting constants',
      `
        const x = 42;
        export default x;
      `,
      'const x = 42;'
    ],
    [
      'when exporting variables',
      `
      let y = 53;
      export default y;
      `,
      'let y = 53;'
    ],
    [
      'when exporting arrow functions',
      `
        const id = x => x;
        export default id;
      `,
      'const id = x => x;'
    ],
    ['when exporting expressions', 'export default 123 + 456;', '']
  ])

  testCases('removes ExportAllDeclaration nodes', [
    // [
    //   'with exported name',
    //   'export * as hi from "./a.js";',
    //   ''
    // ],
    ['without exported name', 'export * from "./a.js";', '']
  ])
})
