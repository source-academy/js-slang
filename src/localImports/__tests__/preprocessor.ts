import es from 'estree'

import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import preprocessFileImports, { getImportedLocalModulePaths } from '../preprocessor'
import { parseError, stripLocationInfo } from './utils'

describe('getImportedLocalModulePaths', () => {
  let context = mockContext(Chapter.LIBRARY_PARSER)

  beforeEach(() => {
    context = mockContext(Chapter.LIBRARY_PARSER)
  })

  const assertCorrectModulePathsAreReturned = (
    code: string,
    baseFilePath: string,
    expectedModulePaths: string[]
  ): void => {
    const program = parse(code, context)
    if (program === undefined) {
      throw parseError
    }
    expect(getImportedLocalModulePaths(program, baseFilePath)).toEqual(new Set(expectedModulePaths))
  }

  it('throws an error if the current file path is not absolute', () => {
    const code = ''
    const program = parse(code, context)
    if (program === undefined) {
      throw parseError
    }
    expect(() => getImportedLocalModulePaths(program, 'a.js')).toThrowError(
      "Current file path 'a.js' is not absolute."
    )
  })

  it('returns local (relative) module imports', () => {
    const code = `import { x } from "./dir2/b.js";
      import { y } from "../dir3/c.js";
    `
    assertCorrectModulePathsAreReturned(code, '/dir/a.js', ['/dir/dir2/b.js', '/dir3/c.js'])
  })

  it('returns local (absolute) module imports', () => {
    const code = `import { x } from "/dir/dir2/b.js";
      import { y } from "/dir3/c.js";
    `
    assertCorrectModulePathsAreReturned(code, '/dir/a.js', ['/dir/dir2/b.js', '/dir3/c.js'])
  })

  it('does not return Source module imports', () => {
    const code = `import { x } from "rune";
      import { y } from "sound";
    `
    assertCorrectModulePathsAreReturned(code, '/dir/a.js', [])
  })

  it('gracefully handles overly long sequences of double dots (..)', () => {
    const code = `import { x } from "../../../../../../../../../b.js";
    `
    assertCorrectModulePathsAreReturned(code, '/dir/a.js', ['/b.js'])
  })

  it('returns unique module paths', () => {
    const code = `import { a } from "./b.js";
      import { b } from "./b.js";
      import { c } from "./c.js";
      import { d } from "./c.js";
    `
    assertCorrectModulePathsAreReturned(code, '/dir/a.js', ['/dir/b.js', '/dir/c.js'])
  })
})

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
      '/a.js': '1 + 2;'
    }
    const actualProgram = preprocessFileImports(files, '/non-existent-file.js', actualContext)
    expect(actualProgram).toBeUndefined()
  })

  it('returns the same AST if the entrypoint file does not contain import/export statements', () => {
    const files: Record<string, string> = {
      '/a.js': `function square(x) {
          return x * x;
        }
        square(5);
      `
    }
    const expectedCode = files['/a.js']
    const actualProgram = preprocessFileImports(files, '/a.js', actualContext)
    assertASTsAreEquivalent(actualProgram, expectedCode)
  })

  it('removes all export-related AST nodes', () => {
    const files: Record<string, string> = {
      '/a.js': `export const x = 42;
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
    const actualProgram = preprocessFileImports(files, '/a.js', actualContext)
    assertASTsAreEquivalent(actualProgram, expectedCode)
  })

  it('removes all non-Source module import-related AST nodes', () => {
    const files: Record<string, string> = {
      '/a.js': `import d, { a, b, c } from "source-module";
        import w, { x, y, z } from "./not-source-module.js";
      `
    }
    const expectedCode = `import { a, b, c } from "source-module";
    `
    const actualProgram = preprocessFileImports(files, '/a.js', actualContext)
    assertASTsAreEquivalent(actualProgram, expectedCode)
  })
})
