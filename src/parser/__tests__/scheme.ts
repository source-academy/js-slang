import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { SchemeParser } from '../scheme'

const parser = new SchemeParser(Chapter.SCHEME_1)
const parser_2 = new SchemeParser(Chapter.SCHEME_2)
const parser_3 = new SchemeParser(Chapter.SCHEME_3)
const parser_4 = new SchemeParser(Chapter.SCHEME_4)
const parser_full = new SchemeParser(Chapter.FULL_SCHEME)
let context = mockContext(Chapter.SCHEME_1)
let context_2 = mockContext(Chapter.SCHEME_2)
let context_3 = mockContext(Chapter.SCHEME_3)
let context_4 = mockContext(Chapter.SCHEME_4)
let context_full = mockContext(Chapter.FULL_SCHEME)

beforeEach(() => {
  // reset the contexts
  context = mockContext(Chapter.SCHEME_1)
  context_2 = mockContext(Chapter.SCHEME_2)
  context_3 = mockContext(Chapter.SCHEME_3)
  context_4 = mockContext(Chapter.SCHEME_4)
  context_full = mockContext(Chapter.FULL_SCHEME)
})

describe('Scheme parser', () => {
  it('represents itself correctly', () => {
    expect(parser.toString()).toMatchInlineSnapshot(`"SchemeParser{chapter: 1}"`)
    expect(parser_2.toString()).toMatchInlineSnapshot(`"SchemeParser{chapter: 2}"`)
    expect(parser_3.toString()).toMatchInlineSnapshot(`"SchemeParser{chapter: 3}"`)
    expect(parser_4.toString()).toMatchInlineSnapshot(`"SchemeParser{chapter: 4}"`)
    expect(parser_full.toString()).toMatchInlineSnapshot(`"SchemeParser{chapter: Infinity}"`)
  })

  it('throws error if given chapter is wrong', () => {
    expect(() => new SchemeParser(Chapter.FULL_PYTHON)).toThrow(
      'SchemeParser was not given a valid chapter!'
    )
  })

  it('throws errors if option throwOnError is selected + parse error is encountered', () => {
    const code = `(hello))`
    expect(() => parser.parse(code, context, undefined, true)).toThrow("Unexpected ')'")
  })

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

  it('disallows syntax for higher chapters (2)', () => {
    const code = `#(1 2 3)`

    parser_2.parse(code, context_2)
    expect(context_2.errors.slice(-1)[0]).toMatchObject(
      expect.objectContaining({
        message: expect.stringContaining("Syntax '#' not allowed at Scheme §2")
      })
    )
  })

  it('allows syntax for lower chapters', () => {
    const code = `'(1 2 3)`

    parser_full.parse(code, context_full)
    expect(parseError(context_full.errors)).toMatchInlineSnapshot(`""`)
    parser_4.parse(code, context_4)
    expect(parseError(context_4.errors)).toMatchInlineSnapshot(`""`)
    parser_3.parse(code, context_3)
    expect(parseError(context_3.errors)).toMatchInlineSnapshot(`""`)
  })
})
