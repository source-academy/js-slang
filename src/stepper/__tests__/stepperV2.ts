import { parse } from 'acorn'
import { getSteps } from '../stepperV2/steppers'
import { convert } from '../stepperV2/generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../stepperV2/interface'
import { IStepperPropContents } from '../stepperV2'

test('recursion', () => {
  const code = `
  const f = () => x + 1;
  const x = 1;
  const h = x => f();
  h(2);
    `
  const program = parse(code, {ecmaVersion: 10})!
  const stringify = (ast: StepperBaseNode) => {
    if (ast === undefined || ast!.type === undefined) {
      return ''
    }
    return astring.generate(ast).replace(/\n/g, '').replace(/\s+/g, ' ')
  }

  const stringifyWithExplanation = (step: IStepperPropContents) => {
    const stringifyAST = stringify(step.ast);
    if (step.markers && step.markers[0]) {
      const explanation = step.markers[0].explanation
      return (step.markers[0].redexType ? `[${step.markers[0].redexType}] ` : '') + explanation + "\n" + stringifyAST;
    } else {
      return stringifyAST;
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
  const f = () => x;
  const x = 1;
  (x => f())(2);

  `
  const program = parse(code, {ecmaVersion: 10})!
  const stringify = (ast: StepperBaseNode) => {
    if (ast === undefined || ast!.type === undefined) {
      return ''
    }
    return astring.generate(ast).replace(/\n/g, '').replace(/\s+/g, ' ')
  }

  const stringifyWithExplanation = (step: IStepperPropContents) => {
    const stringifyAST = stringify(step.ast);
    if (step.markers && step.markers[0]) {
      const explanation = step.markers[0].explanation
      return (step.markers[0].redexType ? `[${step.markers[0].redexType}] ` : '') + explanation + "\n" + stringifyAST;
    } else {
      return stringifyAST;
    }
  }

  const steps = getSteps(convert(program))
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})
