import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { testMultipleCases } from '../../utils/testing'
import { FullTSParser } from '../fullTS'

const parser = new FullTSParser()

describe('fullTS parser', () => {
  testMultipleCases<[string, string | undefined]>(
    [
      [
        'formats errors correctly',
        `type StringOrNumber = string | number;
        const x: StringOrNumber = true;
      `,
        "Line 2: Type 'boolean' is not assignable to type 'StringOrNumber'."
      ],
      [
        'allows usage of builtins/preludes',
        `
        const xs = list(1);
        const ys = list(1);
        equal(xs, ys);
      `,
        undefined
      ],
      [
        'allows usage of imports from modules',
        `
        import { show, heart } from 'rune';
        show(heart);
      `,
        undefined
      ]
    ],
    ([code, expected]) => {
      const context = mockContext(Chapter.FULL_TS)
      parser.parse(code, context)

      if (expected === undefined) {
        expect(context.errors.length).toEqual(0)
      } else {
        expect(context.errors.length).toBeGreaterThanOrEqual(1)
        expect(parseError(context.errors)).toEqual(expected)
      }
    }
  )

  it('returns ESTree compliant program', () => {
    const code = `type StringOrNumber = string | number;
      const x: StringOrNumber = 1;
    `
    const context = mockContext(Chapter.FULL_TS)

    // Resulting program should not have node for type alias declaration
    const parsedProgram = parser.parse(code, context)
    expect(parsedProgram).toMatchSnapshot()
  })
})
