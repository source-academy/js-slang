import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { SchemeParser } from '../scheme'

const parser = new SchemeParser(Chapter.SCHEME_1)
const parser_full = new SchemeParser(Chapter.FULL_SCHEME)
let context = mockContext(Chapter.SCHEME_1)
const context_full = mockContext(Chapter.FULL_SCHEME)

beforeEach(() => {
  context = mockContext(Chapter.SCHEME_1)
})

describe('Scheme parser', () => {
  it('formats tokenizer errors correctly', () => {
    const code = `(hello))`

    parser.parse(code, context)
    expect(context.errors.slice(-1)[0]).toMatchObject(
      expect.objectContaining({ message: expect.stringContaining("Unexpected ')'") })
    )
  })

  it('formats parser errors correctly', () => {
    const code = `(define (f x)`

    parser.parse(code, context)
    expect(context.errors.slice(-1)[0]).toMatchObject(
      expect.objectContaining({ message: expect.stringContaining('Unexpected EOF') })
    )
  })

  it('allows usage of builtins/preludes', () => {
    const code = `
    (+ 1 2 3)
    (gcd 10 15)
    `

    parser.parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('allows usage of imports/modules', () => {
    const code = `(import "rune" (show heart))
      (show heart)
    `

    parser.parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('disallows syntax for higher chapters', () => {
    const code = `'(1 2 3)`

    parser.parse(code, context)
    expect(context.errors.slice(-1)[0]).toMatchObject(
      expect.objectContaining({
        message: expect.stringContaining("Syntax ''' not allowed at Scheme §1")
      })
    )
  })

  it('allows syntax for lower chapters', () => {
    const code = `'(1 2 3)`

    parser_full.parse(code, context_full)
    expect(parseError(context_full.errors)).toMatchInlineSnapshot(`""`)
  })
})
