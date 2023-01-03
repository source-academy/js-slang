import { InvalidFilePathError } from '../../errors/localImportErrors'
import { runFilesInContext } from '../../index'
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
    expect(context.errors).toEqual([new InvalidFilePathError('+-.js')])
  })
})
