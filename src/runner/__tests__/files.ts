import { parseError, runFilesInContext } from '../../index'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'

describe('runFilesInContext', () => {
  let context = mockContext(Chapter.SOURCE_4)

  beforeEach(() => {
    context = mockContext(Chapter.SOURCE_4)
  })

  it('returns InvalidFilePathError if file paths are invalid', () => {
    const files: Record<string, string> = {
      'a.js': '1 + 2;',
      '+-.js': '"hello world";'
    }
    runFilesInContext(files, 'a.js', context)
    expect(parseError(context.errors)).toEqual(
      `'+-.js' must only contain alphanumeric chars or one of '/', '.', '-'.`
    )
  })

  it('returns CannotFindModuleError if entrypoint file does not exist', () => {
    const files: Record<string, string> = {}
    runFilesInContext(files, 'a.js', context)
    expect(parseError(context.errors)).toEqual(`Cannot find module 'a.js'.`)
  })
})
