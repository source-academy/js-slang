import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { FatalSyntaxError } from '../errors'
import { parse } from '../parser'
import { PythonParser } from '../python'

const parserPython1 = new PythonParser(Chapter.PYTHON_1)
let context = mockContext(Chapter.PYTHON_1)

beforeEach(() => {
  context = mockContext(Chapter.PYTHON_1)
})

describe('Python parser', () => {
  describe('Overall parser test', () => {
    it('Generic parse function works', () => {
      const code = 'x = 1'
      parse(code, context)

      expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
      expect(parserPython1.toString()).toEqual(expect.stringContaining('PythonParser'))
    })
  })
  describe('Python 1 tests', () => {
    it('allows usage of builtins/preludes', () => {
      const code = `display("hello from python")`

      const prgm = parserPython1.parse(code, context)
      if (prgm !== null) {
        expect(parserPython1.validate(prgm, context, false)).toEqual(true)
      }
      expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
    })

    it('formats errors correctly', () => {
      const code = `?`

      parserPython1.parse(code, context)
      expect(context.errors.slice(-1)[0]).toMatchObject(
        expect.objectContaining({ message: expect.stringContaining('UnknownTokenError') })
      )
    })
    it('allows usage of imports/modules', () => {
      const code = `from rune import (show, heart)`

      parserPython1.parse(code, context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
    })

    it('throws on error', () => {
      const code = `?`

      expect(() => parserPython1.parse(code, context, undefined, true)).toThrowError(
        FatalSyntaxError
      )
    })

    it('throws the right error for translator unsupported syntax', () => {
      // Note: this test can be removed once we add support in py-slang.
      const code = `1 is not 2`

      expect(() => parserPython1.parse(code, context, undefined, true)).toThrowError(
        FatalSyntaxError
      )
    })
  })
})
