import { asMockedFunc } from '../../utils/testing/misc'
import { compileToChoices, getSVMCCommand } from '../svmc'
import * as vm from '../../vm/svml-compiler'
import * as fs from 'fs/promises'
import { INTERNAL_FUNCTIONS } from '../../stdlib/vm.prelude'
import { expectWritten, getCommandRunner } from './testUtils'

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn()
}))

const mockedReadFile = asMockedFunc(fs.readFile)
const mockedWriteFile = asMockedFunc(fs.writeFile)

jest.spyOn(vm, 'compileToIns')

beforeEach(() => {
  jest.clearAllMocks()
})

const { expectError: rawExpectError, expectSuccess: rawExpectSuccess } =
  getCommandRunner(getSVMCCommand)

async function expectSuccess(code: string, ...args: string[]) {
  mockedReadFile.mockResolvedValueOnce(code)

  await rawExpectSuccess(...args)
  expect(fs.readFile).toHaveBeenCalledTimes(1)
  expect(fs.writeFile).toHaveBeenCalledTimes(1)
}

function expectError(code: string, ...args: string[]) {
  mockedReadFile.mockResolvedValueOnce(code)
  return rawExpectError(...args)
}

test('Running with defaults', async () => {
  await expectSuccess('1+1;', 'test.js')

  const [[fileName]] = mockedWriteFile.mock.calls
  expect(fileName).toEqual('test.svm')
})

it("won't run if the program has parsing errors", async () => {
  await expectError('1 + 1', '/test.js')
  expect(vm.compileToIns).toHaveBeenCalledTimes(0)
  expectWritten(process.stderr.write).toMatchInlineSnapshot(
    `"Line 1: Missing semicolon at the end of statement"`
  )
})

it("won't perform compilation if the output type is 'ast'", async () => {
  await expectSuccess('1+1;', 'test.js', '-t', 'ast')
  expect(vm.compileToIns).toHaveBeenCalledTimes(0)
})

describe('--internals option', () => {
  test('with valid values', async () => {
    await expectSuccess('1+1;', 'test.js', '--internals', '["func1", "func2"]')
    expect(vm.compileToIns).toHaveBeenCalledTimes(1)
    const [[, , internals]] = asMockedFunc(vm.compileToIns).mock.calls

    expect(internals).toEqual(['func1', 'func2'])
  })

  test('with non-string values in array', async () => {
    await expectError('1+1;', 'test.js', '--internals', '[1, 2]')
    expectWritten(process.stderr.write).toMatchInlineSnapshot(`
      "error: option '-i, --internals <names>' argument '[1, 2]' is invalid. Expected a JSON array of strings!
      "
    `)
  })

  test('with a non-array', async () => {
    await expectError('1+1;', 'test.js', '--internals', '{ "a": 1, "b": 2}')
    expectWritten(process.stderr.write).toMatchInlineSnapshot(`
      "error: option '-i, --internals <names>' argument '{ \\"a\\": 1, \\"b\\": 2}' is invalid. Expected a JSON array of strings!
      "
    `)
  })

  it('is ignored if variant is concurrent', async () => {
    await expectSuccess(
      '1+1;',
      'test.js',
      '--internals',
      '["func1", "func2"]',
      '--variant',
      'concurrent'
    )

    expect(vm.compileToIns).toHaveBeenCalledTimes(1)
    const [[, , internals]] = asMockedFunc(vm.compileToIns).mock.calls
    const expectedNames = INTERNAL_FUNCTIONS.map(([name]) => name)
    expect(internals).toEqual(expectedNames)
  })
})

describe('Test output options', () => {
  compileToChoices.forEach(choice => {
    test(choice, async () => {
      await expectSuccess('1 + 1;', 'test.js', '-t', choice)
      const [[fileName, contents]] = mockedWriteFile.mock.calls

      expect((fileName as string).startsWith('test')).toEqual(true)
      expect(contents).toMatchSnapshot()
    })
  })
})
