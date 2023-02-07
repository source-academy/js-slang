import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parsers'
import { Chapter, Variant } from '../../types'

let context = mockContext(Chapter.SOURCE_4, Variant.TYPED)

beforeEach(() => {
  context = mockContext(Chapter.SOURCE_4, Variant.TYPED)
})

describe('parse', () => {
  it('takes in string', () => {
    const code = `const x1 = parse('1;');
      const x2 = parse(1);
    `

    parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Type 'number' is not assignable to type 'string'."`
    )
  })
})
