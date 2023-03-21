import { compileFiles, parseError, runFilesInContext } from '../../index'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'

describe('runFilesInContext', () => {
  let context = mockContext(Chapter.SOURCE_4)

  beforeEach(() => {
    context = mockContext(Chapter.SOURCE_4)
  })

  it('returns IllegalCharInFilePathError if any file path contains invalid characters', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/+-.js': '"hello world";'
    }
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"File path '/+-.js' must only contain alphanumeric chars and/or '_', '/', '.', '-'."`
    )
  })

  it('returns IllegalCharInFilePathError if any file path contains invalid characters - verbose', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/+-.js': '"hello world";'
    }
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors, true)).toMatchInlineSnapshot(`
      "File path '/+-.js' must only contain alphanumeric chars and/or '_', '/', '.', '-'.
      Rename the offending file path to only use valid chars.
      "
    `)
  })

  it('returns ConsecutiveSlashesInFilePathError if any file path contains consecutive slash characters', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/dir//dir2/b.js': '"hello world";'
    }
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"File path '/dir//dir2/b.js' cannot contain consecutive slashes '//'."`
    )
  })

  it('returns ConsecutiveSlashesInFilePathError if any file path contains consecutive slash characters - verbose', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/dir//dir2/b.js': '"hello world";'
    }
    runFilesInContext(files, '/a.js', context)
    expect(parseError(context.errors, true)).toMatchInlineSnapshot(`
      "File path '/dir//dir2/b.js' cannot contain consecutive slashes '//'.
      Remove consecutive slashes from the offending file path.
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

describe('compileFiles', () => {
  let context = mockContext(Chapter.SOURCE_4)

  beforeEach(() => {
    context = mockContext(Chapter.SOURCE_4)
  })

  it('returns IllegalCharInFilePathError if any file path contains invalid characters', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/+-.js': '"hello world";'
    }
    compileFiles(files, '/a.js', context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"File path '/+-.js' must only contain alphanumeric chars and/or '_', '/', '.', '-'."`
    )
  })

  it('returns IllegalCharInFilePathError if any file path contains invalid characters - verbose', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/+-.js': '"hello world";'
    }
    compileFiles(files, '/a.js', context)
    expect(parseError(context.errors, true)).toMatchInlineSnapshot(`
      "File path '/+-.js' must only contain alphanumeric chars and/or '_', '/', '.', '-'.
      Rename the offending file path to only use valid chars.
      "
    `)
  })

  it('returns ConsecutiveSlashesInFilePathError if any file path contains consecutive slash characters', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/dir//dir2/b.js': '"hello world";'
    }
    compileFiles(files, '/a.js', context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"File path '/dir//dir2/b.js' cannot contain consecutive slashes '//'."`
    )
  })

  it('returns ConsecutiveSlashesInFilePathError if any file path contains consecutive slash characters - verbose', () => {
    const files: Record<string, string> = {
      '/a.js': '1 + 2;',
      '/dir//dir2/b.js': '"hello world";'
    }
    compileFiles(files, '/a.js', context)
    expect(parseError(context.errors, true)).toMatchInlineSnapshot(`
      "File path '/dir//dir2/b.js' cannot contain consecutive slashes '//'.
      Remove consecutive slashes from the offending file path.
      "
    `)
  })

  it('returns CannotFindModuleError if entrypoint file does not exist', () => {
    const files: Record<string, string> = {}
    compileFiles(files, '/a.js', context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`"Cannot find module '/a.js'."`)
  })

  it('returns CannotFindModuleError if entrypoint file does not exist - verbose', () => {
    const files: Record<string, string> = {}
    compileFiles(files, '/a.js', context)
    expect(parseError(context.errors, true)).toMatchInlineSnapshot(`
      "Cannot find module '/a.js'.
      Check that the module file path resolves to an existing file.
      "
    `)
  })
})
