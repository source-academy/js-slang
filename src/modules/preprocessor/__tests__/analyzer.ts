import createContext from '../../../createContext'
import {
  DuplicateImportNameError,
  UndefinedDefaultImportError,
  UndefinedImportError,
  UndefinedNamespaceImportError
} from '../../errors'
import { Chapter } from '../../../types'
import { stripIndent } from '../../../utils/formatters'
import parseProgramsAndConstructImportGraph from '../linker'
import analyzeImportsAndExports from '../analyzer'
import { parse } from '../../../parser/parser'
import { mockContext } from '../../../mocks/context'
import type { Program } from 'estree'
import { memoizedGetModuleDocsAsync } from '../../loader/moduleLoaderAsync'

jest.mock('../../loader/moduleLoaderAsync')

beforeEach(() => {
  jest.clearAllMocks()
})

type Files = Partial<Record<string, string>>

describe('Test throwing import validation errors', () => {
  type ErrorInfo = {
    line: number
    col: number
    moduleName: string

    /**
     * Set this to a value if you are expecting an undefined import error
     * to be thrown with the given symbol
     */
    symbol?: string

    /**
     * Set this to true if you are expecting a undefined namespace import error
     * to be thrown
     */
    namespace?: boolean
  }

  // Providing an ErrorInfo object indicates that the test case should throw
  // the corresponding error
  type ImportTestCaseWithNoError<T extends Files> = [T, keyof T]
  type ImportTestCaseWithError<T extends Files> = [...ImportTestCaseWithNoError<T>, ErrorInfo]
  type ImportTestCase<T extends Files> = ImportTestCaseWithError<T> | ImportTestCaseWithNoError<T>

  async function testCode<T extends Files>(
    files: T,
    entrypointFilePath: keyof T,
    allowUndefinedImports: boolean,
    throwOnDuplicateNames: boolean
  ) {
    const context = createContext(Chapter.FULL_JS)
    const importGraphResult = await parseProgramsAndConstructImportGraph(
      p => Promise.resolve(files[p]),
      entrypointFilePath as string,
      context,
      {},
      true
    )

    // Return 'undefined' if there are errors while parsing.
    if (context.errors.length !== 0 || !importGraphResult) {
      throw context.errors[0]
    }

    const { programs, topoOrder, entrypointAbsPath, sourceModulesToImport } = importGraphResult
    await analyzeImportsAndExports(programs, entrypointAbsPath, topoOrder, sourceModulesToImport, {
      allowUndefinedImports,
      throwOnDuplicateNames
    })
    return true
  }

  async function testFailure<T extends Files>(
    files: T,
    entrypointFilePath: keyof T,
    allowUndefinedImports: boolean,
    errInfo: ErrorInfo
  ) {
    let err: any = null
    try {
      await testCode(files, entrypointFilePath, allowUndefinedImports, false)
    } catch (error) {
      err = error
    }

    expect(err).not.toEqual(null)
    expect(err.moduleName).toEqual(errInfo.moduleName)
    if (errInfo.namespace) {
      // Check namespace import
      expect(err).toBeInstanceOf(UndefinedNamespaceImportError)
    } else if (errInfo.symbol !== 'default') {
      expect(err).toBeInstanceOf(UndefinedImportError)
      expect(err.symbol).toEqual(errInfo.symbol)
    } else {
      expect(err).toBeInstanceOf(UndefinedDefaultImportError)
    }

    expect(err.location.start).toMatchObject({
      line: errInfo.line,
      column: errInfo.col
    })
  }

  function testSuccess<T extends Files>(
    files: T,
    entrypointFilePath: keyof T,
    allowUndefinedImports: boolean
  ) {
    return expect(
      testCode(files, entrypointFilePath, allowUndefinedImports, false)
    ).resolves.toEqual(true)
  }

  function testCases<T extends Files>(desc: string, cases: ImportTestCase<T>[]) {
    describe(desc, () => {
      test.each(
        cases.flatMap(([files, entry, errorInfo], i) => {
          return [
            // Test each case with allowUndefinedImports being both true and false
            [`${i}: Should not throw an error`, files, entry, true],
            [`${i}: Should${errorInfo ? '' : ' not'} throw an error`, files, entry, errorInfo]
          ]
        })
      )('%s', async (_, files, entrypointFilePath, errorInfo) => {
        if (errorInfo === true) {
          // If allowUndefinedImports is true, the analyzer should never throw an error
          await testSuccess(files, entrypointFilePath, true)
        } else if (!errorInfo) {
          // Otherwise it should not throw when no errors are expected
          await testSuccess(files, entrypointFilePath, false)
        } else {
          // Or throw the expected error
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
      ],
      [
        {
          '/a.js': `export function a() { return 0; }`,
          '/b.js': `import { a } from './a.js';`
        },
        '/b.js'
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
      ],
      [
        {
          '/a.js': 'export default function a() { return 0; }',
          '/b.js': "import a from './a.js';"
        },
        '/b.js'
      ]
    ])

    testCases('Source imports', [
      [
        {
          '/a.js': stripIndent`
            import foo from "another_module";
            export function b() {
              return foo();
            }
          `
        },
        '/a.js',
        { moduleName: 'another_module', line: 1, col: 7, symbol: 'default' }
      ],
      [
        {
          '/a.js': stripIndent`
            import { default as foo } from "another_module";
            export function b() {
              return foo();
            }
          `
        },
        '/a.js',
        { moduleName: 'another_module', line: 1, col: 9, symbol: 'default' }
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
            import unknown from 'another_module';

            export function b() {
              unknown();
              return a;
            }
          `
        },
        '/b.js',
        { moduleName: 'another_module', line: 2, col: 7, symbol: 'default' }
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': stripIndent`
            import unknown, { a } from "./a.js";
            import { default as foo } from 'another_module';

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

  describe('Test namespace imports', () => {
    testCases('Local imports', [
      [
        {
          '/a.js': 'export const a = 0;',
          '/b.js': 'import * as a from "./a.js"'
        },
        '/b.js'
      ],
      [
        {
          '/a.js': 'const a = 0;',
          '/b.js': 'import * as a from "./a.js"'
        },
        '/b.js',
        { line: 1, col: 7, moduleName: '/a.js', namespace: true }
      ]
    ])

    testCases('Source imports', [
      [
        {
          '/a.js': 'import * as bar from "one_module";'
        },
        '/a.js'
      ]
    ])
  })

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
      ],
      [
        {
          '/a.js': 'export const a = "a";',
          '/b.js': 'export { default as b } from "./a.js"'
        },
        '/b.js',
        { line: 1, col: 9, moduleName: '/a.js', symbol: 'default' }
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
      ],
      [
        {
          '/a.js': 'export default function a() { return 0; }',
          '/b.js': 'export * from "./a.js";',
          '/c.js': "import a from './b.js';"
        },
        '/c.js',
        { line: 1, col: 7, moduleName: '/b.js', symbol: 'default' }
      ]
    ])
  })
})

describe('Test throwing DuplicateImportNameErrors', () => {
  /**
   * [Description, Files]
   * Use this test case specification to specify that no error is expected
   */
  type TestCaseWithNoError = [description: string, files: Files]

  /**
   * [Description, Files, Expected location string]
   * Use this test case specification to specify that an error is expected.
   * The given string represents the location string
   */
  type TestCaseWithError = [description: string, files: Files, expectedError: string]

  type TestCase = TestCaseWithError | TestCaseWithNoError
  const isTestCaseWithNoError = (c: TestCase): c is TestCaseWithNoError => c.length === 2

  type FullTestCase =
    | [string, Record<string, Program>, true, string | undefined]
    | [string, Record<string, Program>, false, undefined]

  function testCases(desc: string, cases: TestCase[]) {
    const allCases = cases.flatMap((c, i) => {
      const context = mockContext(Chapter.LIBRARY_PARSER)
      const programs = Object.entries(c[1]).reduce((res, [name, file]) => {
        const parsed = parse(file!, context, { sourceFile: name })
        if (!parsed) {
          console.error(context.errors[0])
          throw new Error('Failed to parse code!')
        }
        return {
          ...res,
          [name]: parsed
        }
      }, {} as Record<string, Program>)

      // For each test case, split it into the case where throwOnDuplicateImports is true
      // and when it is false. No errors should ever be thrown when throwOnDuplicateImports is false
      if (isTestCaseWithNoError(c)) {
        // No error message was given, so no error is expected to be thrown,
        // regardless of the value of throwOnDuplicateImports
        const [desc] = c
        return [
          [
            `${i}. ${desc} with throwOnDuplicateImports false: no error `,
            programs,
            false,
            undefined
          ],
          [`${i}. ${desc} with throwOnDuplicateImports true: no error`, programs, true, undefined]
        ] as FullTestCase[]
      }

      const [desc, , errMsg] = c
      return [
        [`${i}. ${desc} with throwOnDuplicateImports false: no error`, programs, false, undefined],
        [`${i}. ${desc} with throwOnDuplicateImports true: error`, programs, true, errMsg]
      ] as FullTestCase[]
    })

    describe(desc, () =>
      test.each(allCases)('%s', async (_, programs, shouldThrow, errMsg) => {
        const [entrypointPath, ...topoOrder] = Object.keys(programs)

        const promise = analyzeImportsAndExports(programs, entrypointPath, topoOrder, new Set(), {
          allowUndefinedImports: true,
          throwOnDuplicateNames: shouldThrow
        })

        if (!shouldThrow || errMsg === undefined) {
          return expect(promise).resolves.not.toThrow()
        }

        try {
          await promise
        } catch (err) {
          expect(err).toBeInstanceOf(DuplicateImportNameError)
          const rawErrString = (err.locString as string).split(',').map(each => each.trim())
          rawErrString.sort()
          expect(rawErrString.join(', ')).toEqual(errMsg)
        }
      })
    )
  }

  testCases('Imports from different modules', [
    [
      'Different imports from different Source modules across multiple files',
      {
        '/a.js': `import { foo as a } from 'one_module';`,
        '/b.js': `import { bar as a } from 'another_module';`
      },
      '(/a.js:1:9), (/b.js:1:9)'
    ],
    [
      'Different imports from different local modules across multiple files',
      {
        '/a.js': 'import { foo as a } from "./b.js";',
        '/b.js': 'import { bar as a } from "./c.js";',
        '/c.js': 'export function bar() {}'
      }
    ],
    [
      'Different imports including default imports across multiple files',
      {
        '/a.js': `import a from 'one_module';`,
        '/b.js': `import a from 'another_module';`
      },
      '(/a.js:1:7), (/b.js:1:7)'
    ],
    [
      'Different imports of different types from Source modules',
      {
        '/a.js': `import { foo as a } from 'one_module';`,
        '/b.js': `import a from 'another_module';`
      },
      '(/a.js:1:9), (/b.js:1:7)'
    ],
    [
      'Different imports from both Source and local modules',
      {
        '/a.js': `import { foo as a } from 'one_module';`,
        '/b.js': `import { a } from './c.js';`
      }
    ],
    [
      'Namespace imports from Source modules',
      {
        '/a.js': `import * as a from 'one_module';`,
        '/b.js': `import * as a from 'another_module';`
      },
      '(/a.js:1:7), (/b.js:1:7)'
    ],
    [
      'Three conflicting imports',
      {
        '/a.js': `import * as a from 'one_module';`,
        '/b.js': `import a from 'another_module';`,
        '/c.js': `import { foo as a } from 'one_module';`
      },
      '(/a.js:1:7), (/b.js:1:7), (/c.js:1:9)'
    ]
  ])

  testCases('Imports from the same Source module', [
    [
      'Same import across multiple files 1',
      {
        '/a.js': `import { foo as a } from 'one_module';`,
        '/b.js': `import { foo as a } from 'one_module';`
      }
    ],
    [
      'Same import across multiple files 2',
      {
        '/a.js': `import { foo as a } from 'one_module';`,
        '/b.js': `import { foo as a } from 'one_module';`,
        '/c.js': `import { foo as b } from 'one_module';`,
        '/d.js': `import { foo as b } from 'one_module';`
      }
    ],
    [
      'Different import across multiple files',
      {
        '/a.js': `import { foo as a } from 'one_module';`,
        '/b.js': `import { bar as a } from 'one_module';`
      },
      '(/a.js:1:9), (/b.js:1:9)'
    ],
    [
      'Different namespace imports across multiple files',
      {
        '/a.js': `import * as a from 'one_module';`,
        '/b.js': `import * as a from 'one_module';`
      }
    ],
    [
      'Same default import across multiple files',
      {
        '/a.js': `import a from 'one_module';`,
        '/b.js': `import a from 'one_module';`
      }
    ],
    [
      'Different types of imports across multiple files 1',
      {
        '/a.js': `import { foo as a } from 'one_module';`,
        '/b.js': `import a from 'one_module';`
      },
      '(/a.js:1:9), (/b.js:1:7)'
    ],
    [
      'Different types of imports across multiple files 2',
      {
        '/a.js': `import * as a from 'one_module';`,
        '/b.js': `import a from 'one_module';`
      },
      '(/a.js:1:7), (/b.js:1:7)'
    ],
    [
      'Different types of imports across multiple files 3',
      {
        '/a.js': `import * as a from 'one_module';`,
        '/b.js': `import a from 'one_module';`,
        '/c.js': `import * as a from 'one_module';`
      },
      '(/a.js:1:7), (/b.js:1:7), (/c.js:1:7)'
    ],
    [
      'Different types of imports across multiple files 4',
      {
        '/a.js': `import * as a from 'one_module';`,
        '/b.js': `import a from 'one_module';`,
        '/c.js': `import { foo as a } from 'one_module';`
      },
      '(/a.js:1:7), (/b.js:1:7), (/c.js:1:9)'
    ],
    [
      'Handles aliasing correctly 1',
      {
        '/a.js': `import a from 'one_module';`,
        '/b.js': `import { default as a } from 'one_module';`
      }
    ],
    [
      'Handles aliasing correctly 2',
      {
        '/a.js': `import { foo as a } from 'one_module';`,
        '/b.js': `import { foo } from 'one_module';`
      }
    ],
    [
      'Handles aliasing correctly 3',
      {
        '/a.js': `import { foo as a } from 'one_module';`,
        '/b.js': `import { a as foo } from 'one_module';`
      }
    ]
  ])
})

test('No module documentation is loaded when allowUndefinedImports is true', async () => {
  const files = {
    '/a.js': `import { foo } from 'one_module';`
  }

  const context = mockContext(Chapter.LIBRARY_PARSER)

  const result = await parseProgramsAndConstructImportGraph(
    p => Promise.resolve(files[p]),
    '/a.js',
    context,
    {},
    true
  )
  await analyzeImportsAndExports(result!.programs, '/a.js', [], result!.sourceModulesToImport, {
    allowUndefinedImports: true
  })

  expect(memoizedGetModuleDocsAsync).toHaveBeenCalledTimes(0)
})
