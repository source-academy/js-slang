import es from 'estree'

import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import preprocessFileImports from '../preprocessor'
import { stripLocationInfo } from './utils'

describe('preprocessFileImports', () => {
  const parseError = new Error('Unable to parse code')
  let actualContext = mockContext(Chapter.SOURCE_2)
  let expectedContext = mockContext(Chapter.SOURCE_2)

  beforeEach(() => {
    actualContext = mockContext(Chapter.SOURCE_2)
    expectedContext = mockContext(Chapter.SOURCE_2)
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
})
