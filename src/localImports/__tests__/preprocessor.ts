import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import preprocessFileImports from '../preprocessor'

describe('preprocessFileImports', () => {
  let context = mockContext(Chapter.SOURCE_2)

  beforeEach(() => {
    context = mockContext(Chapter.SOURCE_2)
  })

  it('returns undefined if the specified entrypoint file does not exist', () => {
    const files: Record<string, string> = {
      'a.js': '1 + 2;'
    }
    const program = preprocessFileImports(files, 'non-existent-file.js', context)
    expect(program).toBeUndefined()
  })
})
