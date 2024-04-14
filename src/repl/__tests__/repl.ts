import type { SourceFiles } from '../../modules/moduleTypes'
import * as repl from 'repl'
import { Chapter } from '../../types'
import { asMockedFunc } from '../../utils/testing'
import { getReplCommand } from '../repl'
import { chapterParser } from '../utils'

const readFileMocker = jest.fn()

function mockReadFiles(files: SourceFiles) {
  readFileMocker.mockImplementation((fileName: string) => {
    if (fileName in files) return Promise.resolve(files[fileName])
    return Promise.reject({ code: 'ENOENT' })
  })
}

jest.mock('fs/promises', () => ({
  readFile: readFileMocker
}))

jest.mock('path', () => {
  const actualPath = jest.requireActual('path')
  const newResolve = (...args: string[]) => actualPath.resolve('/', ...args)
  return {
    ...actualPath,
    resolve: newResolve
  }
})

jest.mock('../../modules/loader/loaders')

jest.spyOn(console, 'log')
const mockedConsoleLog = asMockedFunc(console.log)

jest.spyOn(repl, 'start')

describe('Test chapter parser', () =>
  test.each([
    ['1', Chapter.SOURCE_1],
    ['SOURCE_1', Chapter.SOURCE_1],
    ['2', Chapter.SOURCE_2],
    ['SOURCE_2', Chapter.SOURCE_2],
    ['3', Chapter.SOURCE_3],
    ['SOURCE_3', Chapter.SOURCE_3],
    ['4', Chapter.SOURCE_4],
    ['SOURCE_4', Chapter.SOURCE_4],
    ['random string', undefined],
    ['525600', undefined]
  ])('%#', (value, expected) => {
    if (!expected) {
      expect(() => chapterParser(value)).toThrow()
      return
    }

    expect(chapterParser(value)).toEqual(expected)
  }))

describe('Test repl command', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const runCommand = (...args: string[]) => {
    const promise = getReplCommand().parseAsync(args, { from: 'user' })
    return expect(promise).resolves.not.toThrow()
  }

  describe('Test running files', () => {
    type TestCase = [desc: string, args: string[], files: SourceFiles, expected: string]

    const testCases: TestCase[] = [
      [
        'Regular running',
        ['d.js'],
        {
          '/a/a.js': `
        import { b } from './b.js';
        export function a() {
          return b();
        }
      `,
          '/a/b.js': `
        import { c } from '../c/c.js';
        export function b() {
          return c + " and b";
        }
      `,
          '/c/c.js': `
        export const c = "c";
      `,
          '/d.js': `
        import { a } from './a/a.js';
        a();
      `
        },
        '"c and b"'
      ],
      [
        'Unknown local import',
        ['a.js'],
        {
          '/a.js': 'import { b } from "./b.js";'
        },
        "Error: [/a.js] Line 1: Module './b.js' not found."
      ],
      [
        'Unknown local import - verbose',
        ['a.js', '--verbose'],
        {
          '/a.js': 'import { b } from "./b.js";'
        },

        "Error: [/a.js] Line 1, Column 0: Module './b.js' not found.\nYou should check your import declarations, and ensure that all are valid modules.\n"
      ],
      [
        'Source imports are ok',
        ['a.js'],
        {
          '/a.js': "import { foo } from 'one_module'; foo();"
        },
        '"foo"'
      ],
      [
        'Unknown Source imports are handled properly',
        ['a.js'],
        {
          '/a.js': "import { foo } from 'unknown_module'; foo();"
        },
        "Error: [/a.js] Line 1: Module 'unknown_module' not found."
      ]
    ]
    test.each(testCases)('%s', async (_, args, files, expected) => {
      mockReadFiles(files)
      await runCommand(...args)
      expect(mockedConsoleLog.mock.calls[0][0]).toEqual(expected)
    })
  })

  describe('Test running with REPL', () => {
    function mockReplStart() {
      type MockedReplReturn = (x: string) => Promise<string>

      const mockedReplStart = asMockedFunc(repl.start)
      return new Promise<MockedReplReturn>(resolve => {
        mockedReplStart.mockImplementation((args: repl.ReplOptions) => {
          const runCode = (code: string) =>
            new Promise<any>(resolve => {
              args.eval!.call({}, code, {} as any, '', (err: Error | null, result: any) => {
                if (err) resolve(err)
                resolve(result)
              })
            })

          resolve(async code => {
            const output = await runCode(code)
            return args.writer!.call({}, output)
          })
          return {} as any
        })
      })
    }

    const runRepl = async (args: string[], expected: [string, string][]) => {
      const replPromise = mockReplStart()
      await runCommand(...args)
      const func = await replPromise
      expect(repl.start).toHaveBeenCalledTimes(1)

      for (const [input, output] of expected) {
        await expect(func(input)).resolves.toEqual(output)
      }
    }

    test('Running without file name', () =>
      runRepl(
        [],
        [
          ['const x = 1 + 1;', 'undefined'],
          ['x;', '2']
        ]
      ))

    test('REPL is able to recover from errors', () =>
      runRepl(
        [],
        [
          ['const x = 1 + 1;', 'undefined'],
          ['var0;', 'Error: Line 1: Name var0 not declared.'],
          ['x;', '2'],
          ['var0;', 'Error: Line 1: Name var0 not declared.'],
          ['const var0 = 0;', 'undefined'],
          ['var0;', '0']
        ]
      ))

    test('Running with a file name evaluates code and then enters the REPL', async () => {
      mockReadFiles({
        '/a.js': `
          import { b } from './b.js';
          function a() { return "a"; }
          const c = "c";
        `,
        '/b.js': `
          export function b() { return "b"; }
        `
      })

      await runRepl(
        ['a.js', '-r'],
        [
          ['const x = 1 + 1;', 'undefined'],
          ['x;', '2'],
          ['const y = a();', 'undefined'],
          ['y;', '"a"'],
          ['b();', '"b"'],
          ['c;', '"c"'],
          ['const c = 0;', 'undefined'],
          ['c;', '0']
        ]
      )
    })

    test('REPL handles Source import statements ok', () =>
      runRepl(
        [],
        [
          ['const foo = () => "bar";', 'undefined'],
          ['foo();', '"bar"'],
          ['import { foo } from "one_module";', 'undefined'],
          ['foo();', '"foo"']
        ]
      ))

    test('REPL handles local import statements ok', async () => {
      mockReadFiles({
        '/a.js': `
          export function a() { return "a"; }
        `
      })

      await runRepl(
        [],
        [
          ['import { a } from "./a.js";', 'undefined'],
          ['a();', '"a"']
        ]
      )
    })
  })
})
