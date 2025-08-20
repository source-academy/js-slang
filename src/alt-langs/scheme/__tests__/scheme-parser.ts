import { parseError } from '../../..'
import { mockContext } from '../../../utils/testing/mocks'
import { Chapter } from '../../../langs'
import { SchemeParser } from '../../../parser/scheme'

const parser_1 = new SchemeParser(Chapter.SCHEME_1)
const parser_2 = new SchemeParser(Chapter.SCHEME_2)
const parser_3 = new SchemeParser(Chapter.SCHEME_3)
const parser_4 = new SchemeParser(Chapter.SCHEME_4)
const parser_full = new SchemeParser(Chapter.FULL_SCHEME)
let context = mockContext(Chapter.SCHEME_1)
let context_full = mockContext(Chapter.FULL_SCHEME)

beforeEach(() => {
  context = mockContext(Chapter.SCHEME_1)
  context_full = mockContext(Chapter.FULL_SCHEME)
})

describe('Scheme parser', () => {
  it('represents itself correctly', () => {
    expect(parser_1.toString()).toMatchInlineSnapshot(`"SchemeParser{chapter: 1}"`)
  })

  it('throws error if given chapter is wrong', () => {
    expect(() => new SchemeParser(Chapter.FULL_PYTHON)).toThrow(
      'SchemeParser was not given a valid chapter!'
    )
  })

  it('throws errors if option throwOnError is selected + parse error is encountered', () => {
    const code = `(hello))`
    expect(() => parser_1.parse(code, context, undefined, true)).toThrow("Unexpected ')'")
  })

  it('formats tokenizer errors correctly', () => {
    const code = `(hello))`

    parser_1.parse(code, context)
    expect(context.errors.slice(-1)[0]).toMatchObject(
      expect.objectContaining({ message: expect.stringContaining("Unexpected ')'") })
    )
  })

  it('formats parser errors correctly', () => {
    const code = `(define (f x)`

    parser_1.parse(code, context)
    expect(context.errors.slice(-1)[0]).toMatchObject(
      expect.objectContaining({ message: expect.stringContaining('Unexpected EOF') })
    )
  })

  it('allows usage of imports/modules', () => {
    const code = `(import "rune" (show heart))
      (show heart)
    `

    parser_1.parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('disallows syntax for higher chapters', () => {
    const code = `'(1 2 3)`

    parser_1.parse(code, context)
    expect(context.errors.slice(-1)[0]).toMatchObject(
      expect.objectContaining({
        message: expect.stringContaining("Syntax ''' not allowed at Scheme §1")
      })
    )
  })

  it('allows syntax for chapters of required or higher chapter', () => {
    const code = `'(1 2 3)`

    // regardless of how many times we parse this code in the same context,
    // there should be no errors in the context as long as the chapter is 2 or higher
    parser_2.parse(code, context_full)
    parser_3.parse(code, context_full)
    parser_4.parse(code, context_full)
    parser_full.parse(code, context_full)
    expect(parseError(context_full.errors)).toMatchInlineSnapshot(`""`)
  })
})
