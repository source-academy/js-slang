import { parse } from 'acorn'
import { getSteps } from '../steppers'
import { convert } from '../generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../interface'
import { IStepperPropContents } from '..'

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

/*
test('recursion', () => {
  const code = `
  const f = x => x <= 1 ? 1 : f(x - 1) + g(x - 1);
  const g = y => y <= 1 ? 1 : g(y - 1) + h(y - 1);
  const h = z => z <= 1 ? 1 : h(z - 1) + f(z - 1);
  f(2);
    `
  const program = parse(code, { ecmaVersion: 10 })!
  const steps = getSteps(convert(program), {stepLimit: 1000})
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})


test('fact', () => {
  const code = `
  const fact = n => n === 1 ? 1 : fact(n - 1) * n;
  fact(5); 
  `
  const program = parse(code, { ecmaVersion: 10 })!


  const steps = getSteps(convert(program), {stepLimit: 1000})
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})


test('substitution-block', () => {
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

  const steps = getSteps(convert(program), {stepLimit: 1000})
  console.log(steps.length)
  // const output = steps.map(x => [stringify(x.ast), x.ast.freeNames(), x.markers && x.markers[0] ? x.markers[0].redexType + " " + stringify(x.markers[0].redex) : '...'])
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})

test('function calling', () => {
  const code = `
    const getFirst = xs => head(xs);
    getFirst(list(1, 3, 5));
  `
  const program = parse(code, { ecmaVersion: 10 })!

  const steps = getSteps(convert(program), {stepLimit: 1000})
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})
*/
test('general', () => {
  const code = `
       function repeat_pattern(n, p, r) {
    function twice_p(r) {
        return p(p(r));
    }
    return n === 0
        ? r
        : n % 2 !== 0
          ? repeat_pattern(n - 1, p, p(r))
          : repeat_pattern(n / 2, twice_p, r);
}

function plus_one(x) {
    return x + 1;
}

repeat_pattern(5, plus_one, 0);
  `
  const program = parse(code, { ecmaVersion: 10 })!
  const steps = getSteps(convert(program), {stepLimit: 200})
  const output = steps.map(stringifyWithExplanation)
  console.log(output.join('\n'))
})

