import { parse } from 'acorn'
import { getSteps } from '../stepperV2/steppers'
import { convert } from '../stepperV2/generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../stepperV2/interface'
import { IStepperPropContents } from '../stepperV2'

test('recursion', () => {
  const code = `
  1 + 1;
    `
  const program = parse(code, { ecmaVersion: 10 })!
  const stringify = (ast: StepperBaseNode) => {
    if (ast === undefined || ast!.type === undefined) {
      return ''
    }
    return astring.generate(ast).replace(/\n/g, '').replace(/\s+/g, ' ')
  }

  const stringifyWithExplanation = (step: IStepperPropContents) => {
    const stringifyAST = stringify(step.ast)
    if (step.markers && step.markers[0]) {
      const explanation = step.markers[0].explanation
      return (
        (step.markers[0].redexType ? `[${step.markers[0].redexType}] ` : '') +
        explanation +
        '\n' +
        stringifyAST
      )
    } else {
      return stringifyAST
    }
  }

  const steps = getSteps(convert(program))
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})

// FIX: x not renamed to x_1
test('renaming', () => {
  const code = `
  const f = x => x <= 1 ? 1 : f(x - 1) + g(x - 1);
const g = y => y <= 1 ? 1 : g(y - 1) + h(y - 1);
const h = z => z <= 1 ? 1 : h(z - 1) + f(z - 1);
f(3);
  `
  const program = parse(code, { ecmaVersion: 10 })!

  const stringify = (ast: StepperBaseNode) => {
    if (ast === undefined || ast!.type === undefined) {
      return ''
    }
    return astring.generate(ast).replace(/\n/g, '').replace(/\s+/g, ' ')
  }

  const stringifyWithExplanation = (step: IStepperPropContents) => {
    const stringifyAST = stringify(step.ast)
    if (step.markers && step.markers[0]) {
      const explanation = step.markers[0].explanation
      return (
        (step.markers[0].redexType ? `[${step.markers[0].redexType}] ` : '') +
        explanation +
        '\n' +
        stringifyAST
      )
    } else {
      return stringifyAST
    }
  }

  const steps = getSteps(convert(program))
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})
