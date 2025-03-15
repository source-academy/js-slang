import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { getSteps } from '../stepperV2/steppers'
import { convert } from '../stepperV2/generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../stepperV2/interface'

test('arithmetic', () => {
  const code = `
  if (1 === 2) {
      const x = 1;
      1 + x;
} else {
    const y = 2;
    y + 2;
}
    `
  const program = parse(code, mockContext())!
  const stringify = (ast: StepperBaseNode | null) => {
    if (ast === null) {
      return ''
    }
    return astring.generate(ast).replace(/\n/g, '').replace(/\s+/g, ' ')
  }

  const steps = getSteps(convert(program))
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(x => stringify(x.ast))
  console.log(output.join('\n'))
})
