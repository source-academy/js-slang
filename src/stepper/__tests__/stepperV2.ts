import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { getSteps } from '../stepperV2/steppers'
import { convert } from '../stepperV2/generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../stepperV2/interface'
import { ArrowFunctionExpression, CallExpression, ExpressionStatement } from 'estree'

test('arithmetic', () => {
  const code = `
  (x => {return x + 1;})(1);
    `
  const program = parse(code, mockContext())!
  console.log((((program.body[0] as ExpressionStatement).expression as CallExpression).callee as ArrowFunctionExpression).body)
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
