import { parseError, runFilesInContext } from '../../index'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'

describe('syntax errors', () => {
  let context = mockContext(Chapter.SOURCE_4)

  beforeEach(() => {
    context = mockContext(Chapter.SOURCE_4)
  })

  describe('FatalSyntaxError', () => {
    test('file path is not part of error message if the program is single-file', async () => {
      const files: Record<string, string> = {
        '/a.js': `
          const x = 1;
          const x = 1;
        `
      }
      await runFilesInContext(files, '/a.js', context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(
        `"Line 3: SyntaxError: Identifier 'x' has already been declared (3:16)"`
      )
    })

    test('file path is part of error message if the program is multi-file', async () => {
      const files: Record<string, string> = {
        '/a.js': `
          const x = 1;
          const x = 1;
        `,
        '/b.js': `
          const y = 2;
        `
      }
      await runFilesInContext(files, '/a.js', context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(
        `"[/a.js] Line 3: SyntaxError: Identifier 'x' has already been declared (3:16)"`
      )
    })
  })

  describe('MissingSemicolonError', () => {
    test('file path is not part of error message if the program is single-file', async () => {
      const files: Record<string, string> = {
        '/a.js': `
          const x = 1
        `
      }
      await runFilesInContext(files, '/a.js', context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(
        `"Line 2: Missing semicolon at the end of statement"`
      )
    })

    test('file path is part of error message if the program is multi-file', async () => {
      const files: Record<string, string> = {
        '/a.js': `
          const x = 1
        `,
        '/b.js': `
          const y = 2;
        `
      }
      await runFilesInContext(files, '/a.js', context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(
        `"[/a.js] Line 2: Missing semicolon at the end of statement"`
      )
    })
  })

  describe('TrailingCommaError', () => {
    test('file path is not part of error message if the program is single-file', async () => {
      const files: Record<string, string> = {
        '/a.js': `
          const x = [1, 2, 3,];
        `
      }
      await runFilesInContext(files, '/a.js', context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(`"Line 2: Trailing comma"`)
    })

    test('file path is part of error message if the program is multi-file', async () => {
      const files: Record<string, string> = {
        '/a.js': `
          const x = [1, 2, 3,];
        `,
        '/b.js': `
          const y = 2;
        `
      }
      await runFilesInContext(files, '/a.js', context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(`"[/a.js] Line 2: Trailing comma"`)
    })
  })
})

describe('non-syntax errors (non-transpiled)', () => {
  let context = mockContext(Chapter.SOURCE_4)

  beforeEach(() => {
    context = mockContext(Chapter.SOURCE_4)
    context.executionMethod = 'interpreter'
  })

  describe('SourceError', () => {
    test('file path is not part of error message if the program is single-file', async () => {
      const files: Record<string, string> = {
        '/a.js': `
          1 + 'hello';
        `
      }
      await runFilesInContext(files, '/a.js', context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(
        `"Line 2: Expected number on right hand side of operation, got string."`
      )
    })

    test('file path is part of error message if the program is multi-file', async () => {
      const files: Record<string, string> = {
        '/a.js': `
          1 + 'hello';
        `,
        '/b.js': `
          const y = 2;
        `
      }
      await runFilesInContext(files, '/a.js', context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(
        `"[/a.js] Line 2: Expected number on right hand side of operation, got string."`
      )
    })
  })
})
