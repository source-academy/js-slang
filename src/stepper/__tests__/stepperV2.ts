import { parse } from 'acorn'
import { getSteps } from '../stepperV2/steppers'
import { convert } from '../stepperV2/generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../stepperV2/interface'

test('arithmetic', () => {
  const code = `
    const x = 1 + (2 * 3) - 4;
    const y = x + 7;
    `
  const program = parse(code, {ecmaVersion: 10})!
  const stringify = (ast: StepperBaseNode | null) => {
    if (ast === null) {
      return ''
    }
    return astring.generate(ast).replace(/\n/g, '').replace(/\s+/g, ' ')
  }

  const steps = getSteps(convert(program))
  const output = steps.map(x => [stringify(x.ast), x.markers && x.markers![0]! ? x.markers![0].explanation : '...'].join(" | "))
  console.log(output.join('\n'))
})
