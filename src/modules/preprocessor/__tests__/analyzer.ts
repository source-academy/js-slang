import createContext from '../../../createContext'
import {
  CircularImportError,
  ReexportDefaultError,
  ReexportSymbolError,
  UndefinedDefaultImportError,
  UndefinedImportErrorBase,
  UndefinedNamespaceImportError
} from '../../errors'
import { FatalSyntaxError } from '../../../parser/errors'
import { Chapter } from '../../../types'
import { stripIndent } from '../../../utils/formatters'
import validateImportAndExports from '../analyzer'
import { parseProgramsAndConstructImportGraph } from '..'

jest.mock('../../moduleLoaderAsync')

type ErrorInfo = {
  line: number
  col: number
  moduleName: string
  symbol?: string
  namespace?: boolean
}

async function testCode(
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  allowUndefinedImports: boolean
) {
  const context = createContext(Chapter.FULL_JS)
  const { programs, importGraph } = await parseProgramsAndConstructImportGraph(
    files,
    entrypointFilePath,
    context
  )

  // Return 'undefined' if there are errors while parsing.
  if (context.errors.length !== 0) {
    throw context.errors[0]
  }

  // Check for circular imports.
  const topologicalOrderResult = importGraph.getTopologicalOrder()
  if (!topologicalOrderResult.isValidTopologicalOrderFound) {
    throw new CircularImportError(topologicalOrderResult.firstCycleFound)
  }

  try {
    const fullTopoOrder = topologicalOrderResult.topologicalOrder
    if (!fullTopoOrder.includes(entrypointFilePath)) {
      fullTopoOrder.push(entrypointFilePath)
    }
    await validateImportAndExports(programs, fullTopoOrder, allowUndefinedImports)
  } catch (error) {
    // console.log(error)
    throw error
  }
  return true
}

type Files = Partial<Record<string, string>>
type ImportTestCase = [Files, string, ErrorInfo] | [Files, string]
describe('Test throwing import validation errors', () => {
  async function testFailure(
    files: Partial<Record<string, string>>,
    entrypointFilePath: string,
    allowUndefinedImports: boolean,
    errInfo: ErrorInfo
  ) {
    let err: any = null
    try {
      await testCode(files, entrypointFilePath, allowUndefinedImports)
    } catch (error) {
      err = error
    }

    expect(err).toBeInstanceOf(UndefinedImportErrorBase)
    expect(err.moduleName).toEqual(errInfo.moduleName)
    if (errInfo.namespace) {
      // Check namespace import
      expect(err).toBeInstanceOf(UndefinedNamespaceImportError)
    } else if (errInfo.symbol !== 'default') {
      expect(err.symbol).toEqual(errInfo.symbol)
    } else {
      expect(err).toBeInstanceOf(UndefinedDefaultImportError)
    }

    expect(err.location.start).toMatchObject({
      line: errInfo.line,
      column: errInfo.col
    })
  }

  function testSuccess(
    files: Partial<Record<string, string>>,
    entrypointFilePath: string,
    allowUndefinedImports: boolean
  ) {
    return expect(testCode(files, entrypointFilePath, allowUndefinedImports)).resolves.toEqual(true)
  }

  function testCases(desc: string, cases: ImportTestCase[]) {
    describe(desc, () => {
      test.each(
        cases.flatMap(([files, entry, errorInfo], i) => {
          return [
            [`${i}: Should not throw an error`, files, entry, true],
            [`${i}: Should${errorInfo ? '' : ' not'} throw an error`, files, entry, errorInfo]
          ]
        })
      )('%s', async (_, files, entrypointFilePath, errorInfo) => {
        if (errorInfo === true) {
          await testSuccess(files, entrypointFilePath, true)
        } else if (!errorInfo) {
          await testSuccess(files, entrypointFilePath, false)
        } else {
          await testFailure(files, entrypointFilePath, false, errorInfo)
        }
      })
    })
  }

  describe('Test regular imports', () => {
    testCases('Local imports', [
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import { a } from "./a.js";

            export function b() {
              return a;
            }
          `
        },
        '/b.js'
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import { a, unknown } from "./a.js";

            export function b() {
              return a;
            }
          `
        },
        '/b.js',
        { moduleName: '/a.js', line: 1, col: 12, symbol: 'unknown' }
      ]
    ])

    testCases('Source imports', [
      [
        {
          '/a.js': stripIndent`
            import { foo, bar } from "one_module";
            export function b() {
              return foo();
            }
          `
        },
        '/a.js'
      ],
      [
        {
          '/a.js': stripIndent`
            import { foo, bar } from "one_module";
            export function b() {
              return foo();
            }
          `
        },
        '/a.js'
      ]
    ])

    testCases('Source and Local imports', [
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import { a } from "./a.js";
            import { bar } from 'one_module';

            export function b() {
              bar();
              return a;
            }
          `
        },
        '/b.js'
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import { a } from "./a.js";
            import { unknown } from 'one_module';

            export function b() {
              unknown();
              return a;
            }
          `
        },
        '/b.js',
        { moduleName: 'one_module', line: 2, col: 9, symbol: 'unknown' }
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import { a, unknown } from "./a.js";
            import { foo } from 'one_module';

            export function b() {
              foo();
              return a;
            }
          `
        },
        '/b.js',
        { moduleName: '/a.js', line: 1, col: 12, symbol: 'unknown' }
      ]
    ])
  })

  describe('Test default imports', () => {
    testCases('Local imports', [
      [
        {
          '/a.js': 'const a = "a"; export default a;',
          '/b.js': stripIndent`
            import a from "./a.js";

            export function b() {
              return a;
            }
          `
        },
        '/b.js'
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import unknown, { a } from "./a.js";

            export function b() {
              return a;
            }
          `
        },
        '/b.js',
        { moduleName: '/a.js', line: 1, col: 7, symbol: 'default' }
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import unknown from "./a.js";

            export function b() {
              return a;
            }
          `
        },
        '/b.js',
        { moduleName: '/a.js', line: 1, col: 7, symbol: 'default' }
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import { default as unknown } from "./a.js";

            export function b() {
              return a;
            }
          `
        },
        '/b.js',
        { moduleName: '/a.js', line: 1, col: 9, symbol: 'default' }
      ]
    ])

    testCases('Source imports', [
      [
        {
          '/a.js': stripIndent`
            import foo from "one_module";
            export function b() {
              return foo();
            }
          `
        },
        '/a.js',
        { moduleName: 'one_module', line: 1, col: 7, symbol: 'default' }
      ],
      [
        {
          '/a.js': stripIndent`
            import { default as foo } from "one_module";
            export function b() {
              return foo();
            }
          `
        },
        '/a.js',
        { moduleName: 'one_module', line: 1, col: 9, symbol: 'default' }
      ]
    ])

    testCases('Source and Local imports', [
      [
        {
          '/a.js': 'const a = "a"; export default a',
          '/b.js': stripIndent`
            import a from "./a.js";
            import { bar } from 'one_module';

            export function b() {
              bar();
              return a;
            }
          `
        },
        '/b.js'
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import { a } from "./a.js";
            import unknown from 'one_module';

            export function b() {
              unknown();
              return a;
            }
          `
        },
        '/b.js',
        { moduleName: 'one_module', line: 2, col: 7, symbol: 'default' }
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import unknown, { a } from "./a.js";
            import { default as foo } from 'one_module';

            export function b() {
              foo();
              return a;
            }
          `
        },
        '/b.js',
        { moduleName: '/a.js', line: 1, col: 7, symbol: 'default' }
      ]
    ])
  })

  // Re-enable this when namespace imports become supported
  // describe('Test namespace imports', () => {
  //   testCases('Local imports', [
  //     [
  //       {
  //         '/a.js': 'export const a = 0;',
  //         '/b.js': 'import * as a from "./a.js"'
  //       },
  //       '/b.js'
  //     ],
  //     [
  //       {
  //         '/a.js': 'const a = 0;',
  //         '/b.js': 'import * as a from "./a.js"'
  //       },
  //       '/b.js',
  //       { line: 1, col: 7, moduleName: '/a.js', namespace: true }
  //     ]
  //   ])

  //   testCases('Source imports', [
  //     [
  //       {
  //         '/a.js': 'import * as bar from "one_module";'
  //       },
  //       '/a.js'
  //     ]
  //   ])
  // })

  describe('Test named exports', () => {
    testCases('Exporting from another local module', [
      [
        {
          '/a.js': 'export const a = 0;',
          '/b.js': 'export { a } from "./a.js"'
        },
        '/b.js'
      ],
      [
        {
          '/a.js': 'export const a = 0;',
          '/b.js': 'export { b } from "./a.js"'
        },
        '/b.js',
        { line: 1, col: 9, moduleName: '/a.js', symbol: 'b' }
      ],
      [
        {
          '/a.js': 'export const a = 0;',
          '/b.js': 'export { b as a } from "./a.js"'
        },
        '/b.js',
        { line: 1, col: 9, moduleName: '/a.js', symbol: 'b' }
      ],
      [
        {
          '/a.js': 'export const a = "a"',
          '/b.js': 'export * from "./a.js"',
          '/c.js': 'export { a } from "./b.js"'
        },
        '/c.js'
      ]
    ])
  })

  describe('Test export all declarations', () => {
    testCases('Exporting from another local module', [
      [
        {
          '/a.js': 'export const a = "a"',
          '/b.js': 'export * from "./a.js"'
        },
        '/b.js'
      ],
      [
        {
          '/a.js': 'const a = "a"',
          '/b.js': 'export * from "./a.js"'
        },
        '/b.js',
        { line: 1, col: 0, moduleName: '/a.js', namespace: true }
      ],
      [
        {
          '/a.js': 'export const a = "a"',
          '/b.js': 'export * from "./a.js"',
          '/c.js': 'export * from "./b.js"'
        },
        '/c.js'
      ]
    ])
  })
})

describe('Test reexport symbol errors', () => {
  function expectFailure(
    files: Partial<Record<string, string>>,
    entrypointFilePath: string,
    obj: any
  ) {
    return expect(testCode(files, entrypointFilePath, false)).rejects.toBeInstanceOf(obj)
  }

  describe('Duplicate named exports should be handled by FatalSyntaxErrors', () =>
    test.each([
      [
        'Duplicate named exports within the same file',
        `export function a() {}; export { a } from '/b.js'`
      ],
      [
        'Duplicate named exports within the same file with aliasing',
        `export function a() {}; export { b as a } from '/b.js'`
      ],
      [
        'Duplicate default local exports within the same file',
        `export default function a() {}; export { b as default } from '/b.js'`
      ],
      [
        'Duplicate named local exports across multiple files',
        {
          '/a.js': 'export const a = 5; export { a } from "./b.js";',
          '/b.js': 'export const a = 6;'
        }
      ],
      [
        'Duplicate named local and source exports',
        'export const a = 5; export { foo as a } from "one_module";'
      ],
      [
        'Duplicate default local and source exports',
        'export default function a() {}; export { foo as default } from "one_module";'
      ]
    ])('%#. %s', (_, code) => {
      const files = typeof code === 'string' ? { '/a.js': code } : code
      return expectFailure(files, '/a.js', FatalSyntaxError)
    }))

  describe('Duplicate ExportAll declarations', () =>
    test.each([
      [
        'Duplicate named local exports',
        {
          '/a.js': 'export const foo_a = 5; export * from "/b.js";',
          '/b.js': 'export const foo_a = 5;'
        }
      ],
      [
        'Duplicate named local and source exports',
        {
          '/a.js': 'export const foo = 5; export * from "one_module";'
        }
      ],
      [
        'Multiple ExportAllDeclarations are checked',
        {
          '/a.js': 'export * from "/b.js"; export * from "/c.js"',
          '/b.js': 'export const foo_a = 5;',
          '/c.js': 'export const foo_a = 5;'
        }
      ],
      [
        'Exports are checked transitively',
        {
          '/a.js': 'export const foo_a = 5; export * from "/b.js"',
          '/b.js': 'export * from "/c.js"',
          '/c.js': 'export const foo_a = 5;'
        }
      ]
      // Re-enable when exportalldeclarations with exported names are supported
      // [
      //   'Named ExportAllDeclarations have their exported name accounted for',
      //   {
      //     '/a.js': 'export const foo_a = 5; export * from "/b.js"',
      //     '/b.js': 'export * as foo_a from "/c.js"',
      //     '/c.js': 'export const foo_c = 5;'
      //   }
      // ]
    ])('%#. %s', (_, files) => expectFailure(files, '/a.js', ReexportSymbolError)))

  describe('Test default exports', () =>
    test.each([
      [
        'Duplicate default local exports',
        {
          '/a.js': 'export default function a() {}; export * from "/b.js";',
          '/b.js': 'export default function b() {};'
        }
      ],
      [
        'Duplicate unnamed default local exports',
        {
          '/a.js': 'export default () => {}; export * from "/b.js";',
          '/b.js': 'export default 123;'
        }
      ],
      [
        'Duplicate default exports using ExportNamedDeclarations',
        {
          '/a.js': 'const a = 1; export { a as default }; export * from "./b.js";',
          '/b.js': 'const b = 5; export default b'
        }
      ],
      [
        'Multiple ExportAllDeclarations are checked',
        {
          '/a.js': 'export * from "/b.js"; export * from "/c.js"',
          '/b.js': 'export default "b";',
          '/c.js': 'export default "c";'
        }
      ],
      [
        'Exports are checked transitively',
        {
          '/a.js': 'export default "a"; export * from "/b.js"',
          '/b.js': 'export * from "/c.js"',
          '/c.js': 'export default "c"'
        }
      ]
      // Re-enable when exportalldeclarations with exported names are supported
      // [
      //   'Named ExportAllDeclarations have their exported name accounted for',
      //   {
      //     '/a.js': 'export default "a"; export * from "/b.js"',
      //     '/b.js': 'export * as default from "/c.js"',
      //     '/c.js': 'export const foo_c = 5;'
      //   }
      // ]
    ])('%#. %s', (_, files) => expectFailure(files, '/a.js', ReexportDefaultError)))
})
