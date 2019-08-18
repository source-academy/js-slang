import { mockContext } from '../mocks/context'
import { parse } from '../parser'
import { codify, getEvaluationSteps } from '../substituter'

// source 0
test('Test basic substitution', () => {
  const code = `
    (1 + 2) * (3 + 4);
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"(1 + 2) * (3 + 4);

3 * (3 + 4);

3 * 7;

21;
"
`)
})

test('Test binary operator error', () => {
  const code = `
    (1 + 2) * ('a' + 'string');
  `
  const context = mockContext()
  const program = parse(code, context)!
  const steps = getEvaluationSteps(program, context)
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"(1 + 2) * ('a' + 'string');

3 * ('a' + 'string');

3 * \\"astring\\";
"
`)
})

test('Test two statement substitution', () => {
  const code = `
    (1 + 2) * (3 + 4);
    3 * 5;
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext(4))
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
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
  const code = `
  !!!true || true;
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"!!!true || true;

!!false || true;

!true || true;

false || true;

true;
"
`)
})

test('Test ternary operator', () => {
  const code = `
  1 + -1 === 0
    ? false ? garbage : Infinity
    : anotherGarbage;
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"1 + -1 === 0 ? false ? garbage : Infinity : anotherGarbage;

0 === 0 ? false ? garbage : Infinity : anotherGarbage;

true ? false ? garbage : Infinity : anotherGarbage;

false ? garbage : Infinity;

Infinity;
"
`)
})

test('Test basic function', () => {
  const code = `
  function f(n) {
    return n;
  }
  f(5+1*6-40);
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"function f(n) {
  return n;
}
f(5 + 1 * 6 - 40);

f(5 + 1 * 6 - 40);

f(5 + 6 - 40);

f(11 - 40);

f(-29);

-29;
"
`)
})

test('Test basic bifunction', () => {
  const code = `
  function f(n, m) {
    return n * m;
  }
  f(5+1*6-40, 2-5);
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"function f(n, m) {
  return n * m;
}
f(5 + 1 * 6 - 40, 2 - 5);

f(5 + 1 * 6 - 40, 2 - 5);

f(5 + 6 - 40, 2 - 5);

f(11 - 40, 2 - 5);

f(-29, 2 - 5);

f(-29, -3);

-29 * -3;

87;
"
`)
})

test('Test "recursive" function calls', () => {
  const code = `
  function factorial(n) {
    return n === 0
      ? 1
      : n * factorial(n-1);
  }
  factorial(5);
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"function factorial(n) {
  return n === 0 ? 1 : n * factorial(n - 1);
}
factorial(5);

factorial(5);

5 === 0 ? 1 : 5 * factorial(5 - 1);

false ? 1 : 5 * factorial(5 - 1);

5 * factorial(5 - 1);

5 * factorial(4);

5 * (4 === 0 ? 1 : 4 * factorial(4 - 1));

5 * (false ? 1 : 4 * factorial(4 - 1));

5 * (4 * factorial(4 - 1));

5 * (4 * factorial(3));

5 * (4 * (3 === 0 ? 1 : 3 * factorial(3 - 1)));

5 * (4 * (false ? 1 : 3 * factorial(3 - 1)));

5 * (4 * (3 * factorial(3 - 1)));

5 * (4 * (3 * factorial(2)));

5 * (4 * (3 * (2 === 0 ? 1 : 2 * factorial(2 - 1))));

5 * (4 * (3 * (false ? 1 : 2 * factorial(2 - 1))));

5 * (4 * (3 * (2 * factorial(2 - 1))));

5 * (4 * (3 * (2 * factorial(1))));

5 * (4 * (3 * (2 * (1 === 0 ? 1 : 1 * factorial(1 - 1)))));

5 * (4 * (3 * (2 * (false ? 1 : 1 * factorial(1 - 1)))));

5 * (4 * (3 * (2 * (1 * factorial(1 - 1)))));

5 * (4 * (3 * (2 * (1 * factorial(0)))));

5 * (4 * (3 * (2 * (1 * (0 === 0 ? 1 : 0 * factorial(0 - 1))))));

5 * (4 * (3 * (2 * (1 * (true ? 1 : 0 * factorial(0 - 1))))));

5 * (4 * (3 * (2 * (1 * 1))));

5 * (4 * (3 * (2 * 1)));

5 * (4 * (3 * 2));

5 * (4 * 6);

5 * 24;

120;
"
`)
})
