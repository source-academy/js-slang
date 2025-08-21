import { describe, expect } from 'vitest'
import { parseError } from '../..'
import { Chapter } from '../../langs'
import { contextIt } from '../../utils/testing'
import { FatalSyntaxError } from '../errors'
import { parse } from '../parser'
import { PythonParser } from '../python'

const it = contextIt.extend<{
  parser: PythonParser
}>({
  parser: new PythonParser(Chapter.PYTHON_1)
})

describe('Python parser', () => {
  it.scoped({ chapter: Chapter.PYTHON_1 })

  describe('Overall parser test', () => {
    it('Generic parse function works', ({ context, parser }) => {
      const code = 'x = 1'
      parse(code, context)

      expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
      expect(parser.toString()).toEqual(expect.stringContaining('PythonParser'))
    })
  })

  describe('Python 1 tests', () => {
    it('allows usage of builtins/preludes', ({ context, parser }) => {
      const code = `print("hello from python")`

      const prgm = parser.parse(code, context)
      if (prgm !== null) {
        expect(parser.validate(prgm, context, false)).toEqual(true)
      }
      expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
    })

    it('formats errors correctly', ({ context, parser }) => {
      const code = `?`

      parser.parse(code, context)
      expect(context.errors.slice(-1)[0]).toMatchObject(
        expect.objectContaining({ message: expect.stringContaining('UnknownTokenError') })
      )
    })
    it('allows usage of imports/modules', ({ context, parser }) => {
      const code = `from rune import (show, heart)`

      parser.parse(code, context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
    })

    it('throws on error', ({ parser, context }) => {
      const code = `?`

      expect(() => parser.parse(code, context, undefined, true)).toThrowError(FatalSyntaxError)
    })

    it('throws the right error for translator unsupported syntax', ({ parser, context }) => {
      // Note: this test can be removed once we add support in py-slang.
      const code = `1 is not 2`

      expect(() => parser.parse(code, context, undefined, true)).toThrowError(FatalSyntaxError)
    })
  })
})
