import es from 'estree'

import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import preprocessFileImports from '../preprocessor'
import { parseError, stripLocationInfo } from './utils'

describe('preprocessFileImports', () => {
  let actualContext = mockContext(Chapter.LIBRARY_PARSER)
  let expectedContext = mockContext(Chapter.LIBRARY_PARSER)

  beforeEach(() => {
    actualContext = mockContext(Chapter.LIBRARY_PARSER)
    expectedContext = mockContext(Chapter.LIBRARY_PARSER)
  })

  const assertASTsAreEquivalent = (
    actualProgram: es.Program | undefined,
    expectedCode: string
  ): void => {
    if (actualProgram === undefined) {
      throw parseError
    }

    const expectedProgram = parse(expectedCode, expectedContext)
    if (expectedProgram === undefined) {
      throw parseError
    }

    expect(stripLocationInfo(actualProgram)).toEqual(stripLocationInfo(expectedProgram))
  }

  it('returns undefined if the entrypoint file does not exist', () => {
    const files: Record<string, string> = {
      'a.js': '1 + 2;'
    }
    const actualProgram = preprocessFileImports(files, 'non-existent-file.js', actualContext)
    expect(actualProgram).toBeUndefined()
  })

  it('returns the same AST if the entrypoint file does not contain import/export statements', () => {
    const files: Record<string, string> = {
      'a.js': `function square(x) {
          return x * x;
        }
        square(5);
      `
    }
    const expectedCode = files['a.js']
    const actualProgram = preprocessFileImports(files, 'a.js', actualContext)
    assertASTsAreEquivalent(actualProgram, expectedCode)
  })

  it('removes all export-related AST nodes', () => {
    const files: Record<string, string> = {
      'a.js': `export const x = 42;
        export let y = 53;
        export function square(x) {
          return x * x;
        }
        export const id = x => x;
        export default function cube(x) {
          return x * x * x;
        }
      `
    }
    const expectedCode = `const x = 42;
      let y = 53;
      function square(x) {
       return x * x;
      }
      const id = x => x;
      function cube(x) {
       return x * x * x;
      }
    `
    const actualProgram = preprocessFileImports(files, 'a.js', actualContext)
    assertASTsAreEquivalent(actualProgram, expectedCode)
  })

  it('removes all non-Source module import-related AST nodes', () => {
    const files: Record<string, string> = {
      'a.js': `import d, { a, b, c } from "source-module";
        import w, { x, y, z } from "./not-source-module.js";
        import * as f from "another-source-module";
      `
    }
    const expectedCode = `import { a, b, c } from "source-module";
    `
    const actualProgram = preprocessFileImports(files, 'a.js', actualContext)
    assertASTsAreEquivalent(actualProgram, expectedCode)
  })
})
