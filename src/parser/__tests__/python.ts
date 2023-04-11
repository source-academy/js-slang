import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { PythonParser } from '../python';

const parserPython1 = new PythonParser(Chapter.PYTHON_1)
let context = mockContext(Chapter.PYTHON_1)

beforeEach(() => {
  context = mockContext(Chapter.PYTHON_1)
})

describe('Python parser', () => {
  describe('Python 1 tests', () => {
    it('allows usage of builtins/preludes', () => {
      const code = `display("hello from python")`
  
      parserPython1.parse(code, context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
    })

    it('formats errors correctly', () => {
      const code = `?`
  
      parserPython1.parse(code, context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(`
"
UnknownTokenError: SyntaxError at line 0 column 0


?
^~ Unknown token '?'
"
`)
    })
    it('allows usage of imports/modules', () => {
      const code = `from rune import (show, heart)`
  
      parserPython1.parse(code, context)
      expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
    })        
  });

})
