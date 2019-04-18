import { generate } from 'astring'
import { stripIndent } from 'common-tags'
import { parseError } from '../index'
import { mockContext } from '../mocks/context'
import { getEvaluationSteps } from '../substituter'

test('Test basic substitution', () => {
  const code = stripIndent`
    (1 + 2) * (3 + 4);
  `
  const steps = getEvaluationSteps(code, mockContext(4))
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"(1 + 2) * (3 + 4);

3 * (3 + 4);

3 * 7;

21;
"
`)
})

test('Test binary operator error', () => {
  const code = stripIndent`
    (1 + 2) * ('a' + 'string');
  `
  const context = mockContext(4)
  const steps = getEvaluationSteps(code, context)
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"(1 + 2) * ('a' + 'string');

3 * ('a' + 'string');

3 * \\"astring\\";
"
`)
  expect(parseError(context.errors)).toBe(
    'Line 1: Expected number on right hand side of operation, got string.'
  )
})

test('Test two statement substitution', () => {
  const code = stripIndent`
    (1 + 2) * (3 + 4);
    3 * 5;
  `
  const steps = getEvaluationSteps(code, mockContext(4))
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"(1 + 2) * (3 + 4);
3 * 5;

3 * (3 + 4);
3 * 5;

3 * 7;
3 * 5;

21;
3 * 5;

3 * 5;

15;
"
`)
})

test('Test unary and binary boolean operations', () => {
  const code = stripIndent`
  !!!true || true;
  `
  const steps = getEvaluationSteps(code, mockContext(4))
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"!!!true || true;

!!false || true;

!true || true;

false || true;

true;
"
`)
})

test('Test ternary operator', () => {
  const code = stripIndent`
  1 + -1 === 0
    ? false ? garbage : Infinity
    : anotherGarbage;
  `
  const steps = getEvaluationSteps(code, mockContext(4))
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"1 + -1 === 0 ? false ? garbage : Infinity : anotherGarbage;

1 + -1 === 0 ? false ? garbage : Infinity : anotherGarbage;

0 === 0 ? false ? garbage : Infinity : anotherGarbage;

true ? false ? garbage : Infinity : anotherGarbage;
"
`)
})
test('Test basic function', () => {
  const code = stripIndent`
  function f(n) {
    return n;
  }
  f(5+1*6-40);
  `
  const steps = getEvaluationSteps(code, mockContext(4))
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"function f(n) {
  return n;
}
f(5 + 1 * 6 - 40);

(function f(n) {
  return n;
})(5 + 1 * 6 - 40);

(function f(n) {
  return n;
})(5 + 6 - 40);

(function f(n) {
  return n;
})(11 - 40);

(function f(n) {
  return n;
})(-29);

{
  return -29;
};

-29;
"
`)
})

test('Test basic bifunction', () => {
  const code = stripIndent`
  function f(n, m) {
    return n * m;
  }
  f(5+1*6-40, 2-5);
  `
  const steps = getEvaluationSteps(code, mockContext(4))
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"function f(n, m) {
  return n * m;
}
f(5 + 1 * 6 - 40, 2 - 5);

(function f(n, m) {
  return n * m;
})(5 + 1 * 6 - 40, 2 - 5);

(function f(n, m) {
  return n * m;
})(5 + 6 - 40, 2 - 5);

(function f(n, m) {
  return n * m;
})(11 - 40, 2 - 5);

(function f(n, m) {
  return n * m;
})(-29, 2 - 5);

(function f(n, m) {
  return n * m;
})(-29, -3);
"
`)
})

test('Test "iterative" function calls', () => {
  const code = stripIndent`
  function factorial(n) {
    return n === 0
      ? 1
      : n * factorial(n-1);
  }
  factorial(5);
  `
  const steps = getEvaluationSteps(code, mockContext(4))
  expect(steps).toMatchSnapshot()
  expect(steps.map(generate).join('\n')).toMatchInlineSnapshot(`
"function factorial(n) {
  return n === 0 ? 1 : n * factorial(n - 1);
}
factorial(5);

(function factorial(n) {
  return n === 0 ? 1 : n * factorial(n - 1);
})(5);
"
`)
})
