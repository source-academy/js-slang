import { test } from 'vitest'
import { parse } from 'acorn'
import * as astring from 'astring'
import { getSteps } from '../steppers'
import { convert } from '../generator'
import type { Context } from '../../types'
import type { StepperBaseNode } from '../interface'
import type { IStepperPropContents } from '..'
import createContext from '../../createContext'

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

test.skip('recursion', () => {
  const code = `
  const f = x => x <= 1 ? 1 : f(x - 1) + g(x - 1);
  const g = y => y <= 1 ? 1 : g(y - 1) + h(y - 1);
  const h = z => z <= 1 ? 1 : h(z - 1) + f(z - 1);
  f(2);
    `
  const program = parse(code, { ecmaVersion: 10 })!
  const steps = getSteps(convert(program), {} as Context, { stepLimit: 1000 })
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})

test.skip('fact', () => {
  const code = `
  const fact = n => n === 1 ? 1 : fact(n - 1) * n;
  fact(5); 
  `
  const program = parse(code, { ecmaVersion: 10 })!

  const steps = getSteps(convert(program), {} as Context, { stepLimit: 1000 })
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})

test.skip('substitution-block', () => {
  const code = `
  const x = 3;
  const y = 5;
  x + y;
  {
    const x = 2;
    x + y;
  }
    `
  const program = parse(code, { ecmaVersion: 10 })!

  const steps = getSteps(convert(program), {} as Context, { stepLimit: 1000 })
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})

test.skip('function calling', () => {
  const code = `
    const getFirst = xs => head(xs);
    getFirst(list(1, 3, 5));
  `
  const program = parse(code, { ecmaVersion: 10 })!

  const steps = getSteps(convert(program), {} as Context, { stepLimit: 1000 })
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})

test('general', ({ expect }) => {
  expect(() => {
    const code = `math_sqrt("TEST");`
    const program = parse(code, { ecmaVersion: 10, locations: true })!
    const steps = getSteps(convert(program), createContext(2), { stepLimit: 200 })
    const output = steps.map(stringifyWithExplanation)
    console.log(output.join('\n\n'))
  }).not.toThrow()
})
