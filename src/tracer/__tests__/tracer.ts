import { parse } from 'acorn'
import { getSteps } from '../steppers'
import { convert } from '../generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../interface'
import { IStepperPropContents } from '..'

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
  parse_int("10");
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
