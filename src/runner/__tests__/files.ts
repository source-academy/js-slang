import { parseError, runFilesInContext } from '../../index'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'

describe('runFilesInContext', () => {
  let context = mockContext(Chapter.SOURCE_4)

  beforeEach(() => {
    context = mockContext(Chapter.SOURCE_4)
  })

  it('returns InvalidFilePathError if any file path contains invalid characters', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/+-.js': '"hello world";'
    }
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"'/+-.js' must only contain alphanumeric chars or one of '_', '/', '.', '-', and must not contain consecutive slashes '//'."`
    )
  })

  it('returns InvalidFilePathError if any file path contains invalid characters - verbose', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/+-.js': '"hello world";'
    }
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors, true)).toMatchInlineSnapshot(`
      "'/+-.js' must only contain alphanumeric chars or one of '_', '/', '.', '-', and must not contain consecutive slashes '//'.
      Rename the offending file path to only use valid chars and remove consecutive slashes.
      "
    `)
  })

  it('returns InvalidFilePathError if any file path contains consecutive slash characters', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/dir//dir2/b.js': '"hello world";'
    }
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"'/dir//dir2/b.js' must only contain alphanumeric chars or one of '_', '/', '.', '-', and must not contain consecutive slashes '//'."`
    )
  })

  it('returns InvalidFilePathError if any file path contains consecutive slash characters - verbose', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/dir//dir2/b.js': '"hello world";'
    }
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors, true)).toMatchInlineSnapshot(`
      "'/dir//dir2/b.js' must only contain alphanumeric chars or one of '_', '/', '.', '-', and must not contain consecutive slashes '//'.
      Rename the offending file path to only use valid chars and remove consecutive slashes.
      "
    `)
  })

  it('returns CannotFindModuleError if entrypoint file does not exist', () => {
    const files: Record<string, string> = {}
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`"Cannot find module '/a.js'."`)
  })

  it('returns CannotFindModuleError if entrypoint file does not exist - verbose', () => {
    const files: Record<string, string> = {}
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors, true)).toMatchInlineSnapshot(`
      "Cannot find module '/a.js'.
      Check that the module file path resolves to an existing file.
      "
    `)
  })
})
