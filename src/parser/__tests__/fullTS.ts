import { describe, expect } from 'vitest'
import { parseError } from '../..'
import { Chapter } from '../../langs'
import { contextIt } from '../../utils/testing'
import { FullTSParser } from '../fullTS'

const it = contextIt.extend<{ parser: FullTSParser }>({
  parser: new FullTSParser()
})

describe('fullTS parser', () => {
  it.scoped({ chapter: Chapter.FULL_TS })

  it('formats errors correctly', ({ parser, context }) => {
    const code = `type StringOrNumber = string | number;
      const x: StringOrNumber = true;
    `

    parser.parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(
      `"Line 2: Type \'boolean\' is not assignable to type \'StringOrNumber\'."`
    )
  })

  it('allows usage of builtins/preludes', ({ parser, context }) => {
    const code = `const xs = list(1);
      const ys = list(1);
      equal(xs, ys);
    `

    parser.parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('allows usage of imports/modules', ({ parser, context }) => {
    const code = `import { show, heart } from "rune";
      show(heart);
    `

    parser.parse(code, context)
    expect(parseError(context.errors)).toMatchInlineSnapshot(`""`)
  })

  it('returns ESTree compliant program', ({ parser, context }) => {
    const code = `type StringOrNumber = string | number;
      const x: StringOrNumber = 1;
    `

    // Resulting program should not have node for type alias declaration
    const parsedProgram = parser.parse(code, context)
    expect(parsedProgram).toMatchSnapshot()
  })
})
