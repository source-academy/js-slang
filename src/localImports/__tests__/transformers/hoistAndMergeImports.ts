import { mockContext } from '../../../mocks/context'
import { parse } from '../../../parser/parser'
import { Chapter } from '../../../types'
import { hoistAndMergeImports } from '../../transformers/hoistAndMergeImports'
import { parseCodeError, stripLocationInfo } from '../utils'

describe('hoistAndMergeImports', () => {
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

    hoistAndMergeImports(actualProgram)
    expect(stripLocationInfo(actualProgram)).toEqual(stripLocationInfo(expectedProgram))
  }

  test('hoists import declarations to the top of the program', () => {
    const actualCode = `
      function square(x) {
        return x * x;
      }

      import { a, b, c } from "./a.js";

      export { square };

      import x from "source-module";

      square(3);
    `
    const expectedCode = `
      import { a, b, c } from "./a.js";
      import x from "source-module";

      function square(x) {
        return x * x;
      }

      export { square };

      square(3);
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  test('merges import declarations from the same module', () => {
    const actualCode = `
      import { a, b, c } from "./a.js";
      import { d } from "./a.js";
      import { x } from "./b.js";
      import { e, f } from "./a.js";
    `
    const expectedCode = `
      import { a, b, c, d, e, f } from "./a.js";
      import { x } from "./b.js";
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })
})
