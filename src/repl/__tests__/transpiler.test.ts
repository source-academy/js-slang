import fs from 'fs/promises'
import { beforeEach, expect, test, vi } from 'vitest'
import { getTranspilerCommand } from '../transpiler'
import { expectWritten, getCommandRunner } from './utils'

vi.mock(import('path'), async importOriginal => {
  const actualPath = await importOriginal()
  return {
    default: {
      ...actualPath.default,
      resolve: (...args: string[]) => actualPath.resolve('/', ...args)
    }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

const mockedWriteFile = vi.spyOn(fs, 'writeFile').mockResolvedValue()
const mockedReadFile = vi.spyOn(fs, 'readFile')
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
