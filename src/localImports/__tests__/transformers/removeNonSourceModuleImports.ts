import { mockContext } from '../../../mocks/context'
import { parse } from '../../../parser/parser'
import { Chapter } from '../../../types'
import { removeNonSourceModuleImports } from '../../transformers/removeNonSourceModuleImports'
import { parseCodeError, stripLocationInfo } from '../utils'

describe('removeNonSourceModuleImports', () => {
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

    removeNonSourceModuleImports(actualProgram)
    expect(stripLocationInfo(actualProgram)).toEqual(stripLocationInfo(expectedProgram))
  }

  test('removes ImportDefaultSpecifier nodes', () => {
    const actualCode = `
      import a from "./a.js";
      import x from "source-module";
    `
    const expectedCode = ''
    assertASTsAreEquivalent(actualCode, expectedCode)
  })

  // While 'removeNonSourceModuleImports' will remove ImportNamespaceSpecifier nodes, we
  // cannot actually test it because ImportNamespaceSpecifier nodes are banned in the parser.
  // test('removes ImportNamespaceSpecifier nodes', () => {
  //   const actualCode = `
  //     import * as a from "./a.js";
  //     import * as x from "source-module";
  //   `
  //   const expectedCode = ''
  //   assertASTsAreEquivalent(actualCode, expectedCode)
  // })

  test('removes only non-Source module ImportSpecifier nodes', () => {
    const actualCode = `
      import { a, b, c } from "./a.js";
      import { x, y, z } from "source-module";
    `
    const expectedCode = `
      import { x, y, z } from "source-module";
    `
    assertASTsAreEquivalent(actualCode, expectedCode)
  })
})
