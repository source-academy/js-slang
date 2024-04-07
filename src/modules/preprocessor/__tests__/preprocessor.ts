import type { Program } from 'estree'
import type { MockedFunction } from 'jest-mock'

import { parseError, type IOptions } from '../../..'
import { mockContext } from '../../../mocks/context'
import { Chapter, type RecursivePartial } from '../../../types'
import { memoizedGetModuleDocsAsync } from '../../loader/loaders'
import preprocessFileImports from '..'
import { sanitizeAST } from '../../../utils/ast/sanitizer'
import { parse } from '../../../parser/parser'
import {
  accessExportFunctionName,
  defaultExportLookupName
} from '../../../stdlib/localImport.prelude'
import type { SourceFiles } from '../../moduleTypes'

jest.mock('../../loader/loaders')

describe('preprocessFileImports', () => {
  const wrapFiles = (files: SourceFiles) => (p: string) => Promise.resolve(files[p])

  let actualContext = mockContext(Chapter.LIBRARY_PARSER)
  let expectedContext = mockContext(Chapter.LIBRARY_PARSER)

  beforeEach(() => {
    actualContext = mockContext(Chapter.LIBRARY_PARSER)
    expectedContext = mockContext(Chapter.LIBRARY_PARSER)
  })

  async function expectSuccess(
    files: SourceFiles,
    entrypointFilePath: string,
    options?: RecursivePartial<IOptions>
  ) {
    const preprocResult = await preprocessFileImports(
      p => Promise.resolve(files[p]),
      entrypointFilePath,
      actualContext,
      options
    )
    if (!preprocResult.ok) {
      throw actualContext.errors[0]
    }

    return preprocResult.program
  }

  const assertASTsAreEquivalent = (
    actualProgram: Program | undefined,
    expectedCode: string,
    log: boolean = false
  ): void => {
    if (!actualProgram) {
      throw new Error('Actual program should not be undefined!')
    }

    const expectedProgram = parse(expectedCode, expectedContext)
    if (!expectedProgram) {
      throw new Error('Failed to parse expected code')
    }

    expect(sanitizeAST(actualProgram)).toMatchObject(sanitizeAST(expectedProgram))
  }

  it('returns undefined & adds ModuleNotFoundError to context if the entrypoint file does not exist', async () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;'
    }
    const actualProgram = await preprocessFileImports(
      wrapFiles(files),
      '/non-existent-file.js',
      actualContext
    )
    expect(actualProgram).toMatchObject({
      ok: false,
      verboseErrors: false
    })

    expect(parseError(actualContext.errors)).toMatchInlineSnapshot(
      `"Module '/non-existent-file.js' not found."`
    )
  })

  it('returns undefined & adds ModuleNotFoundError to context if an imported file does not exist', async () => {
    const files: Record<string, string> = {
      '/a.js': `import { x } from './non-existent-file.js';`
    }
    const actualProgram = await preprocessFileImports(wrapFiles(files), '/a.js', actualContext)
    expect(actualProgram).toMatchObject({
      ok: false,
      verboseErrors: false
    })
    expect(parseError(actualContext.errors)).toMatchInlineSnapshot(
      `"Line 1: Module './non-existent-file.js' not found."`
    )
  })

  it('returns the same AST if the entrypoint file does not contain import/export statements', async () => {
    const files: Record<string, string> = {
      '/a.js': `
        function square(x) {
          return x * x;
        }
        square(5);
      `
    }
    const expectedCode = files['/a.js']
    const actualProgram = await expectSuccess(files, '/a.js')
    assertASTsAreEquivalent(actualProgram, expectedCode)
  })

  it('removes all export-related AST nodes', async () => {
    const files: Record<string, string> = {
      '/a.js': `
        export const x = 42;
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
    const expectedCode = `
      const x = 42;
      let y = 53;
      function square(x) {
       return x * x;
      }
      const id = x => x;
      function cube(x) {
       return x * x * x;
      }
    `
    const actualProgram = await expectSuccess(files, '/a.js')
    assertASTsAreEquivalent(actualProgram, expectedCode)
  })

  it('ignores Source module imports & removes all non-Source module import-related AST nodes in the preprocessed program', async () => {
    const docsMocked = memoizedGetModuleDocsAsync as MockedFunction<
      typeof memoizedGetModuleDocsAsync
    >
    docsMocked.mockResolvedValueOnce({
      default: {} as any,
      a: {} as any,
      b: {} as any,
      c: {} as any
    })

    const files: Record<string, string> = {
      '/a.js': `
        import d, { a, b, c } from "one_module";
        import w, { x, y, z } from "./not-source-module.js";
      `,
      '/not-source-module.js': `
        export const x = 1;
        export const y = 2;
        export const z = 3;
        export default function square(x) {
          return x * x;
        }
      `
    }
    const expectedCode = `
      import d, { a, b, c } from "one_module";

      function __$not$$dash$$source$$dash$$module$$dot$$js__() {
        const x = 1;
        const y = 2;
        const z = 3;
        function square(x) {
          return x * x;
        }

        return pair(square, list(pair("x", x), pair("y", y), pair("z", z)));
      }

      const ___$not$$dash$$source$$dash$$module$$dot$$js___ = __$not$$dash$$source$$dash$$module$$dot$$js__();

      const w = ${accessExportFunctionName}(___$not$$dash$$source$$dash$$module$$dot$$js___, "${defaultExportLookupName}");
      const x = ${accessExportFunctionName}(___$not$$dash$$source$$dash$$module$$dot$$js___, "x");
      const y = ${accessExportFunctionName}(___$not$$dash$$source$$dash$$module$$dot$$js___, "y");
      const z = ${accessExportFunctionName}(___$not$$dash$$source$$dash$$module$$dot$$js___, "z");
    `
    const actualProgram = await expectSuccess(files, '/a.js', {
      importOptions: {
        allowUndefinedImports: true
      },
      shouldAddFileName: true
    })
    assertASTsAreEquivalent(actualProgram, expectedCode, true)
  })

  it('collates Source module imports at the start of the top-level environment of the preprocessed program', async () => {
    const docsMocked = memoizedGetModuleDocsAsync as MockedFunction<
      typeof memoizedGetModuleDocsAsync
    >
    docsMocked.mockResolvedValue({
      f: {} as any,
      g: {} as any,
      h: {} as any,
      w: {} as any,
      x: {} as any,
      y: {} as any,
      z: {} as any
    })
    const files: Record<string, string> = {
      '/a.js': `
        import { b } from "./b.js";
        import { w, x } from "one_module";
        import { f, g } from "other_module";

        b;
      `,
      '/b.js': `
        import { square } from "./c.js";
        import { x, y } from "one_module";
        import { h } from "another_module";

        export const b = square(5);
      `,
      '/c.js': `
        import { x, y, z } from "one_module";

        export const square = x => x * x;
      `
    }
    const expectedCode = `
      import { w, x, y, z } from "one_module";
      import { f, g } from "other_module";
      import { h } from "another_module";

      function __$b$$dot$$js__(___$c$$dot$$js___) {
        const square = ${accessExportFunctionName}(___$c$$dot$$js___, "square");

        const b = square(5);

        return pair(null, list(pair("b", b)));
      }

      function __$c$$dot$$js__() {
        const square = x => x * x;

        return pair(null, list(pair("square", square)));
      }

      const ___$c$$dot$$js___ = __$c$$dot$$js__();
      const ___$b$$dot$$js___ = __$b$$dot$$js__(___$c$$dot$$js___);

      const b = ${accessExportFunctionName}(___$b$$dot$$js___, "b");

      b;
    `
    const actualProgram = await expectSuccess(files, '/a.js', {
      importOptions: {
        allowUndefinedImports: true
      },
      shouldAddFileName: true
    })
    assertASTsAreEquivalent(actualProgram, expectedCode)
  })

  it('returns CircularImportError if there are circular imports', async () => {
    const files: Record<string, string> = {
      '/a.js': `
        import { b } from "./b.js";

        export const a = 1;
      `,
      '/b.js': `
        import { c } from "./c.js";

        export const b = 2;
      `,
      '/c.js': `
        import { a } from "./a.js";

        export const c = 3;
      `
    }
    await preprocessFileImports(wrapFiles(files), '/a.js', actualContext, {
      shouldAddFileName: true
    })
    expect(parseError(actualContext.errors)).toMatchInlineSnapshot(
      `"Circular import detected: '/a.js' -> '/b.js' -> '/c.js' -> '/a.js'."`
    )
  })

  it('returns CircularImportError if there are circular imports - verbose', async () => {
    const files: Record<string, string> = {
      '/a.js': `
        import { b } from "./b.js";

        export const a = 1;
      `,
      '/b.js': `
        import { c } from "./c.js";

        export const b = 2;
      `,
      '/c.js': `
        import { a } from "./a.js";

        export const c = 3;
      `
    }
    await preprocessFileImports(wrapFiles(files), '/a.js', actualContext)
    expect(parseError(actualContext.errors, true)).toMatchInlineSnapshot(`
      "Circular import detected: '/a.js' -> '/b.js' -> '/c.js' -> '/a.js'.
      Break the circular import cycle by removing imports from any of the offending files.
      "
    `)
  })

  it('returns CircularImportError if there are self-imports', async () => {
    const files: Record<string, string> = {
      '/a.js': `
        import { y } from "./a.js";
        const x = 1;
        export { x as y };
      `
    }
    await preprocessFileImports(wrapFiles(files), '/a.js', actualContext)
    expect(parseError(actualContext.errors)).toMatchInlineSnapshot(
      `"Circular import detected: '/a.js' -> '/a.js'."`
    )
  })

  it('returns CircularImportError if there are self-imports - verbose', async () => {
    const files: Record<string, string> = {
      '/a.js': `
        import { y } from "./a.js";
        const x = 1;
        export { x as y };
      `
    }
    await preprocessFileImports(wrapFiles(files), '/a.js', actualContext)
    expect(parseError(actualContext.errors, true)).toMatchInlineSnapshot(`
      "Circular import detected: '/a.js' -> '/a.js'.
      Break the circular import cycle by removing imports from any of the offending files.
      "
    `)
  })

  it('returns a preprocessed program with all imports', async () => {
    const files: Record<string, string> = {
      '/a.js': `
        import { a as x, b as y } from "./b.js";

        x + y;
      `,
      '/b.js': `
        import y, { square } from "./c.js";

        const a = square(y);
        const b = 3;
        export { a, b };
      `,
      '/c.js': `
        import { mysteryFunction } from "./d.js";

        const x = mysteryFunction(5);
        export function square(x) {
          return x * x;
        }
        export default x;
      `,
      '/d.js': `
        const addTwo = x => x + 2;
        export { addTwo as mysteryFunction };
      `
    }

    const expectedCode = `
      function __$b$$dot$$js__(___$c$$dot$$js___) {
        const y = ${accessExportFunctionName}(___$c$$dot$$js___, "${defaultExportLookupName}");
        const square = ${accessExportFunctionName}(___$c$$dot$$js___, "square");

        const a = square(y);
        const b = 3;

        return pair(null, list(pair("a", a), pair("b", b)));
      }

      function __$c$$dot$$js__(___$d$$dot$$js___) {
        const mysteryFunction = ${accessExportFunctionName}(___$d$$dot$$js___, "mysteryFunction");

        const x = mysteryFunction(5);
        function square(x) {
          return x * x;
        }

        return pair(x, list(pair("square", square)));
      }

      function __$d$$dot$$js__() {
        const addTwo = x => x + 2;

        return pair(null, list(pair("mysteryFunction", addTwo)));
      }

      const ___$d$$dot$$js___ = __$d$$dot$$js__();
      const ___$c$$dot$$js___ = __$c$$dot$$js__(___$d$$dot$$js___);
      const ___$b$$dot$$js___ = __$b$$dot$$js__(___$c$$dot$$js___);

      const x = ${accessExportFunctionName}(___$b$$dot$$js___, "a");
      const y = ${accessExportFunctionName}(___$b$$dot$$js___, "b");

      x + y;
    `
    const actualProgram = await expectSuccess(files, '/a.js', {
      importOptions: {
        allowUndefinedImports: true
      },
      shouldAddFileName: true
    })

    assertASTsAreEquivalent(actualProgram, expectedCode)
  })
})
