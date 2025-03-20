import * as fs from 'fs/promises'
import type pathlib from 'path'
import { asMockedFunc } from '../../utils/testing/misc'
import { getTranspilerCommand } from '../transpiler'
import { expectWritten, getCommandRunner } from './utils'

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn()
}))

jest.mock('path', () => {
  const actualPath: typeof pathlib = jest.requireActual('path/posix')
  return {
    ...actualPath,
    resolve: (...args: string[]) => actualPath.resolve('/', ...args)
  }
})

beforeEach(() => {
  jest.clearAllMocks()
})

const mockedWriteFile = asMockedFunc(fs.writeFile)
const mockedReadFile = asMockedFunc(fs.readFile)
const { expectError, expectSuccess } = getCommandRunner(getTranspilerCommand)

test('Nothing should be written if the program has parser errors', async () => {
  mockedReadFile.mockResolvedValueOnce('1+1')
  await expectError('/test.js')
  expect(fs.writeFile).toHaveBeenCalledTimes(0)

  expectWritten(process.stderr.write).toMatchInlineSnapshot(
    `"[/test.js] Line 1: Missing semicolon at the end of statement"`
  )
})

test('Nothing should be written if the program has transpiler errors', async () => {
  mockedReadFile.mockResolvedValueOnce('a;')
  await expectError('/test.js')
  expect(fs.writeFile).toHaveBeenCalledTimes(0)

  expectWritten(process.stderr.write).toMatchInlineSnapshot(
    `"[/test.js] Line 1: Name a not declared."`
  )
})

test('Nothing should be written to disk if no output file was specified', async () => {
  mockedReadFile.mockResolvedValueOnce('1+1;')
  await expectSuccess('test.js')
  expect(fs.writeFile).toHaveBeenCalledTimes(0)

  // Code should have been written to stdout
  expectWritten(process.stdout.write).toMatchSnapshot()
})

test('Writing to file', async () => {
  mockedReadFile.mockResolvedValueOnce('1+1;')
  await expectSuccess('test.js', '-o', 'out.js')
  expect(fs.writeFile).toHaveBeenCalledTimes(1)

  const [[fileName, contents]] = mockedWriteFile.mock.calls
  expect(fileName).toEqual('out.js')
  expect(contents).toMatchSnapshot()
})

test('pretranspile option', async () => {
  mockedReadFile.mockResolvedValueOnce('1+1;')
  await expectSuccess('test.js', '-o', 'out.js', '-p')
  expect(fs.writeFile).toHaveBeenCalledTimes(1)

  const [[fileName, contents]] = mockedWriteFile.mock.calls
  expect(fileName).toEqual('out.js')
  expect(contents).toEqual('1 + 1;\n')
})
