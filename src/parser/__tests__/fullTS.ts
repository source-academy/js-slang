import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { FullTSParser } from '../fullTS'

const parser = new FullTSParser()
let context = mockContext(Chapter.FULL_TS)

beforeEach(() => {
  context = mockContext(Chapter.FULL_TS)
})

describe('fullTS parser', () => {
  it('formats errors correctly', () => {
    const code = `type StringOrNumber = string | number;
      const x: StringOrNumber = true;
    `

    parser.parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Type \'boolean\' is not assignable to type \'StringOrNumber\'."`
    )
  })

  it('returns ESTree compliant program', () => {
    const code = `type StringOrNumber = string | number;
      const x: StringOrNumber = 1;
    `

    // Resulting program should not have node for type alias declaration
    const parsedProgram = parser.parse(code, context)
    expect(parsedProgram).toMatchSnapshot()
  })
})
