import createContext from '../../../createContext'
import { CircularImportError, ReexportDefaultError, ReexportSymbolError, UndefinedImportErrorBase } from '../../errors'
import { FatalSyntaxError } from '../../../parser/errors'
import { Chapter } from '../../../types'
import { stripIndent } from '../../../utils/formatters'
import validateImportAndExports from '../analyzer'
import { parseProgramsAndConstructImportGraph } from '..'

type ErrorInfo = {
  symbol?: string
  line: number
  col: number
  moduleName: string
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
    throw error
  }
  return true
}

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
    if (errInfo.symbol) {
      expect(err.symbol).toEqual(errInfo.symbol)
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

  function testCases(
    desc: string,
    cases: [
      files: Partial<Record<string, string>>,
      entrypointFilePath: string,
      trueError: false | ErrorInfo,
      falseError: false | ErrorInfo
    ][]
  ) {
    describe(desc, () => {
      test.each(
        cases.flatMap(([files, entry, trueError, falseError], i) => {
          return [
            [`Test Case ${i} with allowedUndefinedImports true`, files, entry, true, trueError],
            [`Test Case ${i} with allowedUndefinedImports false`, files, entry, false, falseError]
          ]
        })
      )('%s', async (_, files, entrypointFilePath, allowUndefined, error) => {
        if (error !== false) {
          await testFailure(files, entrypointFilePath, allowUndefined, error)
        } else {
          await testSuccess(files, entrypointFilePath, allowUndefined)
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
        '/b.js',
        false,
        false
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
        false,
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
        '/a.js',
        false,
        false
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
        '/a.js',
        false,
        false
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
        '/b.js',
        false,
        false
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
        false,
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
        false,
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
        '/b.js',
        false,
        false
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
        false,
        { moduleName: '/a.js', line: 1, col: 7 }
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
        false,
        { moduleName: 'one_module', line: 1, col: 7 }
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
        '/b.js',
        false,
        false
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
        false,
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
        false,
        { moduleName: '/a.js', line: 1, col: 12, symbol: 'unknown' }
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

  describe('Duplicate named exports', () =>
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
    ])('%# %s', (_, code) => {
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
      ]
    ])('%# %s', (_, files) => expectFailure(files, '/a.js', ReexportSymbolError)))

  describe('Test default exports', () => test.each([
    [
      'Duplicate default local exports',
      {
        '/a.js': 'export default function a() {}; export * from "/b.js";',
        '/b.js': 'export default function b() {};'
      }
    ],
  ])('%# %s', (_, files) => expectFailure(files, '/a.js', ReexportDefaultError)))
})
