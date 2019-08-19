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

// source 0
test('undefined || 1', () => {
  const code = `
  undefined || 1;
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"undefined || 1;
"
`)
})

// source 0
test('1 + math_sin', () => {
  const code = `
  1 + math_sin;
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"1 + math_sin;
"
`)
})

// source 0
test('plus undefined', () => {
  const code = `
  math_sin(1) + undefined;
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"math_sin(1) + undefined;

0.8414709848078965 + undefined;
"
`)
})

// source 0
test('math_pow', () => {
  const code = `
  math_pow(3,100) || NaN;
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"math_pow(3, 100) || NaN;

5.153775207320114e+47 || NaN;
"
`)
})

// source 0
test('expmod', () => {
  const code = `
  function is_even(n) {
    return n % 2 === 0;
}

function expmod(base, exp, m) {
    if (exp === 0) {
        return 1;
    } else {
        if (is_even(exp)) {
            const to_half = expmod(base, exp / 2, m);
            return to_half * to_half % m;
        } else {
            return base * expmod(base, exp - 1, m) % m;
        }
    }
}

expmod(4, 3, 5);
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchSnapshot()
})

// source 0
test('Infinite recursion', () => {
  const code = `
  function f() {
    return f();
}
f();
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchSnapshot()
})

// source 0
test('subsets', () => {
  const code = `
  function subsets(s) {
    if (is_null(s)) {
        return list(null);
    } else {
        const rest = subsets(tail(s));
        return append(rest, map(x => pair(head(s), x), rest));
    }
}

 subsets(list(1, 2, 3));
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`""`)
})

// source 0
test('even odd mutual', () => {
  const code = `
  const odd = n => n === 0 ? false : even(n-1);
  const even = n => n === 0 || odd(n-1);
  even(1);
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"const odd = =>;
const even = =>;
even(1);

const even = =>;
even(1);

=>(1);

n === 0 || odd(n - 1);
"
`)
})

// source 0
test('assign undefined', () => {
  const code = `
  const a = undefined;
  a;
  `
  const program = parse(code, mockContext())!
  const steps = getEvaluationSteps(program, mockContext())
  expect(steps).toMatchSnapshot()
  expect(steps.map(codify).join('\n')).toMatchInlineSnapshot(`
"const a = undefined;
a;

undefined;
"
`)
})
