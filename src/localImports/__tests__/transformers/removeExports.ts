import { mockContext } from '../../../mocks/context'
import { parse } from '../../../parser/parser'
import { Chapter } from '../../../types'
import { removeExports } from '../../transformers/removeExports'
import { parseCodeError, stripLocationInfo } from '../utils'

describe('removeExports', () => {
  let actualContext = mockContext(Chapter.LIBRARY_PARSER)
  let expectedContext = mockContext(Chapter.LIBRARY_PARSER)

  beforeEach(() => {
    actualContext = mockContext(Chapter.LIBRARY_PARSER)
    expectedContext = mockContext(Chapter.LIBRARY_PARSER)
  })

  const assertASTsAreEquivalent = (actualCode: string, expectedCode: string): void => {
    const actualProgram = parse(actualCode, actualContext)
    const expectedProgram = parse(expectedCode, expectedContext)
    if (actualProgram === null || expectedProgram === null) {
      throw parseCodeError
    }

    removeExports(actualProgram)
    expect(stripLocationInfo(actualProgram)).toEqual(stripLocationInfo(expectedProgram))
  }

  describe('removes ExportNamedDeclaration nodes', () => {
    test('when exporting variable declarations', () => {
      const actualCode = `
        export const x = 42;
        export let y = 53;
      `
      const expectedCode = `
        const x = 42;
        let y = 53;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting function declarations', () => {
      const actualCode = `
        export function square(x) {
          return x * x;
        }
      `
      const expectedCode = `
        function square(x) {
          return x * x;
        }
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting arrow function declarations', () => {
      const actualCode = `
        export const square = x => x * x;
      `
      const expectedCode = `
        const square = x => x * x;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting (renamed) identifiers', () => {
      const actualCode = `
        const x = 42;
        let y = 53;
        function square(x) {
          return x * x;
        }
        const id = x => x;
        export { x, y, square as sq, id as default };
      `
      const expectedCode = `
        const x = 42;
        let y = 53;
        function square(x) {
          return x * x;
        }
        const id = x => x;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })
  })

  describe('removes ExportDefaultDeclaration nodes', () => {
    // Default exports of variable declarations and arrow function declarations
    // is not allowed in ES6, and will be caught by the Acorn parser.
    test('when exporting function declarations', () => {
      const actualCode = `
        export default function square(x) {
          return x * x;
        }
      `
      const expectedCode = `
        function square(x) {
          return x * x;
        }
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting constants', () => {
      const actualCode = `
        const x = 42;
        export default x;
      `
      const expectedCode = `
        const x = 42;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting variables', () => {
      const actualCode = `
        let y = 53;
        export default y;
      `
      const expectedCode = `
        let y = 53;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting functions', () => {
      const actualCode = `
        function square(x) {
          return x * x;
        }
        export default square;
      `
      const expectedCode = `
        function square(x) {
          return x * x;
        }
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting arrow functions', () => {
      const actualCode = `
        const id = x => x;
        export default id;
      `
      const expectedCode = `
        const id = x => x;
      `
      assertASTsAreEquivalent(actualCode, expectedCode)
    })

    test('when exporting expressions', () => {
      const actualCode = `
        export default 123 + 456;
      `
      const expectedCode = ''
      assertASTsAreEquivalent(actualCode, expectedCode)
    })
  })
})
