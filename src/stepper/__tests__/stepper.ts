import type * as es from 'estree'

import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter, Context, substituterNodes } from '../../types'
import { codify, getEvaluationSteps } from '../stepper'

function getLastStepAsString(steps: [substituterNodes, string[][], string][]): string {
  return codify(steps[steps.length - 1][0]).trim()
}

describe('Test codify works on non-circular abstract syntax graphs', () => {
  test('arithmetic', () => {
    const code = `
    (1 + 2) * (3 + 4);
  `
    const program = parse(code, mockContext())!
    expect(codify(program)).toMatchInlineSnapshot(`
      "(1 + 2) * (3 + 4);
      "
    `)
  })

  test('pairs', () => {
    const code = `
    [1, 2];
  ` // not valid stepper input, but can be generated by stepper
    const program = parse(code, mockContext(Chapter.SOURCE_4))!
    expect(codify(program)).toMatchInlineSnapshot(`
      "[1, 2];
      "
    `)
  })

  test('functions', () => {
    const code = `
    x => x();
  `
    const program = parse(code, mockContext())!
    expect(codify(program)).toMatchInlineSnapshot(`
      "(x => x());
      "
    `)
  })
})

describe('Test codify works on circular abstract syntax graphs', () => {
  test('functions', async () => {
    const code = `
    x => x();
  `
    const program = parse(code, mockContext())!

    const arrowFunctionExpression = ((program as es.Program).body[0] as es.ExpressionStatement)
      .expression as es.ArrowFunctionExpression
    const callExpression = arrowFunctionExpression.body as es.CallExpression
    callExpression.callee = arrowFunctionExpression
    expect(codify(program)).toMatchInlineSnapshot(`
      "(x => (x => (x => (x => (x => (x => ...)())())())())());
      "
    `)
  })
})

// source 0
const testEvalSteps = (programStr: string, context?: Context) => {
  context = context ?? mockContext()
  const program = parse(programStr, context)!
  return getEvaluationSteps(program, context, 1000, { loadTabs: false, wrapModules: false })
}

test('Test basic substitution', async () => {
  const code = `
    (1 + 2) * (3 + 4);
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "(1 + 2) * (3 + 4);

    (1 + 2) * (3 + 4);

    3 * (3 + 4);

    3 * (3 + 4);

    3 * 7;

    3 * 7;

    21;

    21;
    "
  `)
})

test('Test binary operator error', async () => {
  const code = `
    (1 + 2) * ('a' + 'string');
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "(1 + 2) * ('a' + 'string');

    (1 + 2) * ('a' + 'string');

    3 * ('a' + 'string');

    3 * ('a' + 'string');

    3 * \\"astring\\";

    3 * \\"astring\\";
    "
  `)
})

test('Test two statement substitution', async () => {
  const code = `
    (1 + 2) * (3 + 4);
    3 * 5;
  `
  const steps = await testEvalSteps(code, mockContext(Chapter.SOURCE_4))
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "(1 + 2) * (3 + 4);
    3 * 5;

    (1 + 2) * (3 + 4);
    3 * 5;

    3 * (3 + 4);
    3 * 5;

    3 * (3 + 4);
    3 * 5;

    3 * 7;
    3 * 5;

    3 * 7;
    3 * 5;

    21;
    3 * 5;

    21;
    3 * 5;

    3 * 5;

    3 * 5;

    15;

    15;
    "
  `)
})

test('Test unary and binary boolean operations', async () => {
  const code = `
  !!!true || true;
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "!!!true || true;

    !!!true || true;

    !!false || true;

    !!false || true;

    !true || true;

    !true || true;

    false || true;

    false || true;

    true;

    true;
    "
  `)
})

test('Test ternary operator', async () => {
  const code = `
  1 + -1 === 0
    ? false ? garbage : Infinity
    : anotherGarbage;
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "1 + -1 === 0 ? false ? garbage : Infinity : anotherGarbage;

    1 + -1 === 0 ? false ? garbage : Infinity : anotherGarbage;

    0 === 0 ? false ? garbage : Infinity : anotherGarbage;

    0 === 0 ? false ? garbage : Infinity : anotherGarbage;

    true ? false ? garbage : Infinity : anotherGarbage;

    true ? false ? garbage : Infinity : anotherGarbage;

    false ? garbage : Infinity;

    false ? garbage : Infinity;

    Infinity;

    Infinity;
    "
  `)
})

test('Test basic function', async () => {
  const code = `
  function f(n) {
    return n;
  }
  f(5+1*6-40);
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "function f(n) {
      return n;
    }
    f(5 + 1 * 6 - 40);

    function f(n) {
      return n;
    }
    f(5 + 1 * 6 - 40);

    f(5 + 1 * 6 - 40);

    f(5 + 1 * 6 - 40);

    f(5 + 6 - 40);

    f(5 + 6 - 40);

    f(11 - 40);

    f(11 - 40);

    f(-29);

    f(-29);

    -29;

    -29;
    "
  `)
})

test('Test basic bifunction', async () => {
  const code = `
  function f(n, m) {
    return n * m;
  }
  f(5+1*6-40, 2-5);
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "function f(n, m) {
      return n * m;
    }
    f(5 + 1 * 6 - 40, 2 - 5);

    function f(n, m) {
      return n * m;
    }
    f(5 + 1 * 6 - 40, 2 - 5);

    f(5 + 1 * 6 - 40, 2 - 5);

    f(5 + 1 * 6 - 40, 2 - 5);

    f(5 + 6 - 40, 2 - 5);

    f(5 + 6 - 40, 2 - 5);

    f(11 - 40, 2 - 5);

    f(11 - 40, 2 - 5);

    f(-29, 2 - 5);

    f(-29, 2 - 5);

    f(-29, -3);

    f(-29, -3);

    -29 * -3;

    -29 * -3;

    87;

    87;
    "
  `)
})

test('Test "recursive" function calls', async () => {
  const code = `
  function factorial(n) {
    return n === 0
      ? 1
      : n * factorial(n-1);
  }
  factorial(5);
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "function factorial(n) {
      return n === 0 ? 1 : n * factorial(n - 1);
    }
    factorial(5);

    function factorial(n) {
      return n === 0 ? 1 : n * factorial(n - 1);
    }
    factorial(5);

    factorial(5);

    factorial(5);

    5 === 0 ? 1 : 5 * factorial(5 - 1);

    5 === 0 ? 1 : 5 * factorial(5 - 1);

    false ? 1 : 5 * factorial(5 - 1);

    false ? 1 : 5 * factorial(5 - 1);

    5 * factorial(5 - 1);

    5 * factorial(5 - 1);

    5 * factorial(4);

    5 * factorial(4);

    5 * (4 === 0 ? 1 : 4 * factorial(4 - 1));

    5 * (4 === 0 ? 1 : 4 * factorial(4 - 1));

    5 * (false ? 1 : 4 * factorial(4 - 1));

    5 * (false ? 1 : 4 * factorial(4 - 1));

    5 * (4 * factorial(4 - 1));

    5 * (4 * factorial(4 - 1));

    5 * (4 * factorial(3));

    5 * (4 * factorial(3));

    5 * (4 * (3 === 0 ? 1 : 3 * factorial(3 - 1)));

    5 * (4 * (3 === 0 ? 1 : 3 * factorial(3 - 1)));

    5 * (4 * (false ? 1 : 3 * factorial(3 - 1)));

    5 * (4 * (false ? 1 : 3 * factorial(3 - 1)));

    5 * (4 * (3 * factorial(3 - 1)));

    5 * (4 * (3 * factorial(3 - 1)));

    5 * (4 * (3 * factorial(2)));

    5 * (4 * (3 * factorial(2)));

    5 * (4 * (3 * (2 === 0 ? 1 : 2 * factorial(2 - 1))));

    5 * (4 * (3 * (2 === 0 ? 1 : 2 * factorial(2 - 1))));

    5 * (4 * (3 * (false ? 1 : 2 * factorial(2 - 1))));

    5 * (4 * (3 * (false ? 1 : 2 * factorial(2 - 1))));

    5 * (4 * (3 * (2 * factorial(2 - 1))));

    5 * (4 * (3 * (2 * factorial(2 - 1))));

    5 * (4 * (3 * (2 * factorial(1))));

    5 * (4 * (3 * (2 * factorial(1))));

    5 * (4 * (3 * (2 * (1 === 0 ? 1 : 1 * factorial(1 - 1)))));

    5 * (4 * (3 * (2 * (1 === 0 ? 1 : 1 * factorial(1 - 1)))));

    5 * (4 * (3 * (2 * (false ? 1 : 1 * factorial(1 - 1)))));

    5 * (4 * (3 * (2 * (false ? 1 : 1 * factorial(1 - 1)))));

    5 * (4 * (3 * (2 * (1 * factorial(1 - 1)))));

    5 * (4 * (3 * (2 * (1 * factorial(1 - 1)))));

    5 * (4 * (3 * (2 * (1 * factorial(0)))));

    5 * (4 * (3 * (2 * (1 * factorial(0)))));

    5 * (4 * (3 * (2 * (1 * (0 === 0 ? 1 : 0 * factorial(0 - 1))))));

    5 * (4 * (3 * (2 * (1 * (0 === 0 ? 1 : 0 * factorial(0 - 1))))));

    5 * (4 * (3 * (2 * (1 * (true ? 1 : 0 * factorial(0 - 1))))));

    5 * (4 * (3 * (2 * (1 * (true ? 1 : 0 * factorial(0 - 1))))));

    5 * (4 * (3 * (2 * (1 * 1))));

    5 * (4 * (3 * (2 * (1 * 1))));

    5 * (4 * (3 * (2 * 1)));

    5 * (4 * (3 * (2 * 1)));

    5 * (4 * (3 * 2));

    5 * (4 * (3 * 2));

    5 * (4 * 6);

    5 * (4 * 6);

    5 * 24;

    5 * 24;

    120;

    120;
    "
  `)
})

// source 0
test('undefined || 1', async () => {
  const code = `
  undefined || 1;
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "undefined || 1;

    undefined || 1;
    "
  `)
})

// source 0
test('1 + math_sin', async () => {
  const code = `
  1 + math_sin;
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "1 + math_sin;

    1 + math_sin;
    "
  `)
})

// source 0
test('plus undefined', async () => {
  const code = `
  math_sin(1) + undefined;
  `

  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "math_sin(1) + undefined;

    math_sin(1) + undefined;

    0.8414709848078965 + undefined;

    0.8414709848078965 + undefined;
    "
  `)
})

// source 0
test('math_pow', async () => {
  const code = `
  math_pow(2, 20) || NaN;
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "math_pow(2, 20) || NaN;

    math_pow(2, 20) || NaN;

    1048576 || NaN;

    1048576 || NaN;
    "
  `)
})

// source 0
test('expmod', async () => {
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
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
})

// source 0
test('Infinite recursion', async () => {
  const code = `
  function f() {
    return f();
}
f();
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
})

// source 0
test('subsets', async () => {
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
  const steps = await testEvalSteps(code, mockContext(Chapter.SOURCE_2))
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
})

// source 0
test('even odd mutual', async () => {
  const code = `
  const odd = n => n === 0 ? false : even(n-1);
  const even = n => n === 0 || odd(n-1);
  even(1);
  `
  const steps = await testEvalSteps(code)
  expect(getLastStepAsString(steps)).toEqual('false;')
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "const odd = n => n === 0 ? false : even(n - 1);
    const even = n => n === 0 || odd(n - 1);
    even(1);

    const odd = n => n === 0 ? false : even(n - 1);
    const even = n => n === 0 || odd(n - 1);
    even(1);

    const even = n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1);
    even(1);

    const even = n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1);
    even(1);

    (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(1);

    (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(1);

    1 === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(1 - 1);

    1 === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(1 - 1);

    false || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(1 - 1);

    false || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(1 - 1);

    (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(1 - 1);

    (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(1 - 1);

    (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(0);

    (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(0);

    0 === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(0 - 1);

    0 === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(0 - 1);

    true ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(0 - 1);

    true ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : (n => n === 0 || (n => ...)(n - 1))(n - 1))(n - 1))(n - 1))(n - 1))(0 - 1);

    false;

    false;
    "
  `)
})

// source 0
test('assign undefined', async () => {
  const code = `
  const a = undefined;
  a;
  `
  const steps = await testEvalSteps(code)
  expect(getLastStepAsString(steps)).toEqual('undefined;')
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "const a = undefined;
    a;

    const a = undefined;
    a;

    undefined;

    undefined;
    "
  `)
})

test('builtins return identifiers', async () => {
  const code = `
  math_sin();
  `
  const steps = await testEvalSteps(code)
  expect(getLastStepAsString(steps)).toEqual('NaN;')
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "math_sin();

    math_sin();

    NaN;

    NaN;
    "
  `)
})

test('negative numbers as arguments', async () => {
  const code = `
  math_sin(-1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "math_sin(-1);

    math_sin(-1);

    -0.8414709848078965;

    -0.8414709848078965;
    "
  `)
})

test('is_function checks for builtin', async () => {
  const code = `
    is_function(is_function);
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "is_function(is_function);

    is_function(is_function);

    true;

    true;
    "
  `)
})

test('triple equals work on function', async () => {
  const code = `
    function f() { return g(); } function g() { return f(); }
    f === f;
    g === g;
    f === g;
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "function f() {
      return g();
    }
    function g() {
      return f();
    }
    f === f;
    g === g;
    f === g;

    function f() {
      return g();
    }
    function g() {
      return f();
    }
    f === f;
    g === g;
    f === g;

    function g() {
      return f();
    }
    f === f;
    g === g;
    f === g;

    function g() {
      return f();
    }
    f === f;
    g === g;
    f === g;

    f === f;
    g === g;
    f === g;

    f === f;
    g === g;
    f === g;

    true;
    g === g;
    f === g;

    true;
    g === g;
    f === g;

    g === g;
    f === g;

    g === g;
    f === g;

    true;
    f === g;

    true;
    f === g;

    f === g;

    f === g;

    false;

    false;
    "
  `)
})

test('constant declarations in blocks are protected', async () => {
  const code = `
    const z = 1;

function f(g) {
    const z = 3;
    return g(z);
}

f(y => y + z);
  `
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
    "const z = 1;
    function f(g) {
      const z = 3;
      return g(z);
    }
    f(y => y + z);

    const z = 1;
    function f(g) {
      const z = 3;
      return g(z);
    }
    f(y => y + z);

    function f(g) {
      const z = 3;
      return g(z);
    }
    f(y => y + 1);

    function f(g) {
      const z = 3;
      return g(z);
    }
    f(y => y + 1);

    f(y => y + 1);

    f(y => y + 1);

    {
      const z = 3;
      return (y => y + 1)(z);
    };

    {
      const z = 3;
      return (y => y + 1)(z);
    };

    {
      return (y => y + 1)(3);
    };

    {
      return (y => y + 1)(3);
    };

    (y => y + 1)(3);

    (y => y + 1)(3);

    3 + 1;

    3 + 1;

    4;

    4;
    "
  `)
  expect(getLastStepAsString(steps)).toEqual('4;')
})

test('function declarations in blocks are protected', async () => {
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
  const steps = await testEvalSteps(code)
  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('5;')
})

test('const declarations in blocks subst into call expressions', async () => {
  const code = `
  const z = 1;
  function f(g) {
    const z = 3;
    return (y => z + z)(z);
  }
  f(undefined);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('6;')
})

test('scoping test for lambda expressions nested in blocks', async () => {
  const code = `
  {
    const f = x => g();
    const g = () => x;
    const x = 1;
    f(0);
  }
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('1;')
})

test('scoping test for blocks nested in lambda expressions', async () => {
  const code = `
  const f = x => { g(); };
  const g = () => { x; };
  const x = 1;
  f(0);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('undefined;')
})

test('scoping test for function expressions', async () => {
  const code = `
  function f(x) {
    return g();
  }
  function g() {
    return x;
  }
  const x = 1;
  f(0);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('1;')
})

test('scoping test for lambda expressions', async () => {
  const code = `
  const f = x => g();
  const g = () => x;
  const x = 1;
  f(0);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('1;')
})

test('scoping test for block expressions', async () => {
  const code = `
  function f(x) {
    const y = x;
    return g();
  }
  function g() {
    return y;
  }
  const y = 1;
  f(0);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('1;')
})

test('scoping test for block expressions, no renaming', async () => {
  const code = `
  function h(w) {
    function f(w) {
        return g();
    }
    function g() {
        return w;
    }
    return f(0);
  }
  h(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('1;')
})

test('scoping test for block expressions, with renaming', async () => {
  const code = `
  function f(w) {
    return g();
  }
  function h(f) {
      function g() {
          return w;
      }
      const w = 0;
      return f(1);
  }
  h(f);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('g();')
})

test('return in nested blocks', async () => {
  const code = `
  function f(x) {{ return 1; }}
  f(0);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('1;')
})

test('renaming clash test for lambda function', async () => {
  const code = `
  const f = w_11 => w_10 => w_11 + w_10 + g();
  const g = () => w_10;
  const w_10 = 0;
  f(1)(2);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('3;')
})

test('renaming clash test for functions', async () => {
  const code = `
  function f(w_8) {
    function h(w_9) {
        return w_8 + w_9 + g();
    }
    return h;
}

function g() {
    return w_9;
}

const w_9 = 0;
f(1)(2);
`
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('3;')
})

test('renaming clash in replacement for lambda function', async () => {
  const code = `
  const g = () => x_1 + x_2;
  const f = x_1 => x_2 => g();
  const x_1 = 0;
  const x_2 = 0;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('0;')
})

test(`renaming clash in replacement for function expression`, async () => {
  const code = `
  function f(x_1) {
    function h(x_2) {
        return g();
    }
      return h;
  }
  function g() {
    return x_1 + x_2;
  }
  const x_1 = 0;
  const x_2 = 0;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('0;')
})

test(`renaming clash in replacement for function declaration`, async () => {
  const code = `
  function g() {
    return x_1 + x_2;
  }
  function f(x_1) {
      function h(x_2) {
          return g();
      }
      return h;
  }
  const x_1 = 0;
  const x_2 = 0;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('0;')
})

test(`multiple clash for function declaration`, async () => {
  const code = `
  function g() {
    return x_2 + x_3;
  }
  function f(x_2) {
      function h(x_3) {
          return x_4 + g();
      }
      return h;
  }
  const x_3 = 0;
  const x_2 = 2;
  const x_4 = 2;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('4;')
})

test(`multiple clash for function expression`, async () => {
  const code = `
  function f(x_2) {
    function h(x_3) {
        return x_4 + g();
    }
    return h;
  }
  function g() {
      return x_2 + x_3;
  }
  const x_3 = 0;
  const x_2 = 2;
  const x_4 = 2;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('4;')
})

test(`multiple clash for lambda function`, async () => {
  const code = `
  const f = x_2 => x_3 => x_4 + g();
  const g = () => x_2 + x_3;
  const x_3 = 0;
  const x_2 = 2;
  const x_4 = 2;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('4;')
})

test(`multiple clash 2 for lambda function`, async () => {
  const code = `
  const f = x => x_1 => x_2 + g();
  const g = () => x + x_1;
  const x_2 = 0;
  const x_1 = 2;
  const x = 1;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('3;')
})

test(`multiple clash 2 for function expression`, async () => {
  const code = `
  function f(x) {
    function h(x_1) {
        return x_2 + g();
    }
    return h;
  }
  function g() {
      return x + x_1;
  }
  const x_2 = 0;
  const x_1 = 2;
  const x = 1;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('3;')
})

test(`multiple clash 2 for function declaration`, async () => {
  const code = `
  function g() {
    return x + x_1;
  }
  function f(x) {
      function h(x_1) {
          return x_2 + g();
      }
      return h;
  }
  const x_2 = 0;
  const x_1 = 2;
  const x = 1;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('3;')
})

test(`renaming clash with declaration in replacement for function declaration`, async () => {
  const code = `
  function g() {
    const x_2 = 2;
    return x_1 + x_2 + x;
  }

  function f(x) {
      function h(x_1) {
          return x + g();
      }
        return h;
  }

  const x_1 = 0;
  const x = 0;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('3;')
})

test(`renaming clash with declaration in replacement for function expression`, async () => {
  const code = `
  function f(x) {
    function h(x_1) {
        return g();
    }
      return h;
  }

  function g() {
      const x_2 = 2;
      return x_1 + x_2 + x;
  }

  const x_1 = 0;
  const x = 0;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('2;')
})

test(`renaming clash with declaration in replacement for lambda function`, async () => {
  const code = `
  const f = x => x_1 => g();
  const g = () => { const x_2 = 2; return x_1 + x + x_2; };
  const x = 0;
  const x_1 = 0;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('2;')
})

test(`renaming clash with parameter of lambda function declaration in block`, async () => {
  const code = `
  const g = () => x_1;
  const f = x_1 => {
      const h = x_2 => x_1 + g();
      return h;
  };

  const x_1 = 1;
  f(3)(2);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('4;')
})

test(`renaming clash with parameter of function declaration in block`, async () => {
  const code = `
  function g() {
    return x_1;
  }
  function f (x_1) {
      function h(x_2) {
          return x_1 + g();
      }
      return h;
  }
  const x_1 = 1;
  f(3)(2);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('4;')
})

test(`renaming of outer parameter in lambda function`, async () => {
  const code = `
  const g = () =>  w_1;
  const f = w_1 => w_2 => w_1 + g();
  const w_1 = 0;
  f(1)(1);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('1;')
})

test(`correctly avoids capture by other parameter names`, async () => {
  const code = `
  function f(g, x) {
      return g(x);
  }
  f(y => x + 1, 2);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('x + 1;')
})

test(`removes debugger statements`, async () => {
  const code = `
  function f(n) {
    debugger;
    return n === 0 ? 1 : n * f(n - 1);
  }
  debugger;
  f(3);
  `
  const steps = await testEvalSteps(code)

  expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
  expect(getLastStepAsString(steps)).toEqual('6;')
})

describe(`redeclaration of predeclared functions work`, () => {
  test('control', async () => {
    const code = `
    length(list(1, 2, 3));
    `

    const steps = await testEvalSteps(code, mockContext(Chapter.SOURCE_2))
    expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
    expect(getLastStepAsString(steps)).toEqual('3;')
  })

  test('test', async () => {
    const code = `
    function length(xs) {
      return 0;
    }
    length(list(1, 2, 3));
    `
    const steps = await testEvalSteps(code, mockContext(Chapter.SOURCE_2))

    expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
    expect(getLastStepAsString(steps)).toEqual('0;')
  })
})

describe(`#1109: Empty function bodies don't break execution`, () => {
  test('Function declaration', async () => {
    const code = `
    function a() {}
    "other statement";
    a();
    "Gets returned by normal run";
    `
    const steps = await testEvalSteps(code, mockContext(Chapter.SOURCE_2))

    expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
    expect(getLastStepAsString(steps)).toEqual('"Gets returned by normal run";')
  })

  test('Constant declaration of lambda', async () => {
    const code = `
    const a = () => {};
    "other statement";
    a();
    "Gets returned by normal run";
    `
    const steps = await testEvalSteps(code, mockContext(Chapter.SOURCE_2))

    expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
    expect(getLastStepAsString(steps)).toEqual('"Gets returned by normal run";')
  })
})

describe(`#1342: Test the fix of #1341: Stepper limit off by one`, () => {
  test('Program steps equal to Stepper limit', async () => {
    const code = `
      function factorial(n) {
        return n === 1
          ? 1
          : n * factorial(n - 1);
      }
      factorial(100);
      `
    const steps = await testEvalSteps(code, mockContext(Chapter.SOURCE_2))
    expect(steps.map(x => codify(x[0])).join('\n')).toMatchSnapshot()
    expect(getLastStepAsString(steps)).toEqual('9.33262154439441e+157;')
  })
})

// describe(`#1223: Stepper: Import statements cause errors`, () => {
//   test('import a module and invoke its functions', async () => {
//     const code = `
//     import {circle, show, red, stack} from "rune";
//     show(stack(red(circle), circle));
//     `
//     const steps = await testEvalSteps(code)
//
//     expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
//       "show(stack(red(circle), circle));

//       show(stack(red(circle), circle));

//       show(stack(<Rune>, circle));

//       show(stack(<Rune>, circle));

//       show(<Rune>);

//       show(<Rune>);

//       <Rune>;

//       <Rune>;
//       "
//     `)
//   })

//   test('return function from module function and invoke built-in with lambda', async () => {
//     const code = `
//     import {draw_points, make_point} from "curve";
//     draw_points(100)(t => make_point(t, t));
//     `
//     const steps = await testEvalSteps(code)
//
//     expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
//       "draw_points(100)(t => make_point(t, t));

//       draw_points(100)(t => make_point(t, t));

//       [Function](t => make_point(t, t));

//       [Function](t => make_point(t, t));

//       <CurveDrawn>;

//       <CurveDrawn>;
//       "
//     `)
//   })

//   test('invoke built-in with function expression', async () => {
//     const code = `
//     import {draw_3D_points, make_3D_point} from "curve";
//     function f(t) {
//         return make_3D_point(t, t, t);
//     }
//     draw_3D_points(100)(f);
//     `
//     const steps = await testEvalSteps(code)
//
//     expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
//       "function f(t) {
//         return make_3D_point(t, t, t);
//       }
//       draw_3D_points(100)(f);

//       function f(t) {
//         return make_3D_point(t, t, t);
//       }
//       draw_3D_points(100)(f);

//       draw_3D_points(100)(f);

//       draw_3D_points(100)(f);

//       [Function](f);

//       [Function](f);

//       <CurveDrawn>;

//       <CurveDrawn>;
//       "
//     `)
//   })

//   test('recursive function and invoking with module function and object', async () => {
//     const code = `
//     import { stack, heart, show, make_cross } from "rune";
//     function repeat(n, f, i) {
//         return n === 0
//               ? i
//               : repeat(n - 1, f, f(i));
//     }
//     show(repeat(1, make_cross, heart));
//     `
//     const steps = await testEvalSteps(code)
//
//     expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
//       "function repeat(n, f, i) {
//         return n === 0 ? i : repeat(n - 1, f, f(i));
//       }
//       show(repeat(1, make_cross, heart));

//       function repeat(n, f, i) {
//         return n === 0 ? i : repeat(n - 1, f, f(i));
//       }
//       show(repeat(1, make_cross, heart));

//       show(repeat(1, make_cross, heart));

//       show(repeat(1, make_cross, heart));

//       show(1 === 0 ? heart : repeat(1 - 1, make_cross, make_cross(heart)));

//       show(1 === 0 ? heart : repeat(1 - 1, make_cross, make_cross(heart)));

//       show(false ? heart : repeat(1 - 1, make_cross, make_cross(heart)));

//       show(false ? heart : repeat(1 - 1, make_cross, make_cross(heart)));

//       show(repeat(1 - 1, make_cross, make_cross(heart)));

//       show(repeat(1 - 1, make_cross, make_cross(heart)));

//       show(repeat(0, make_cross, make_cross(heart)));

//       show(repeat(0, make_cross, make_cross(heart)));

//       show(repeat(0, make_cross, <Rune>));

//       show(repeat(0, make_cross, <Rune>));

//       show(0 === 0 ? <Rune> : repeat(0 - 1, make_cross, make_cross(<Rune>)));

//       show(0 === 0 ? <Rune> : repeat(0 - 1, make_cross, make_cross(<Rune>)));

//       show(true ? <Rune> : repeat(0 - 1, make_cross, make_cross(<Rune>)));

//       show(true ? <Rune> : repeat(0 - 1, make_cross, make_cross(<Rune>)));

//       show(<Rune>);

//       show(<Rune>);

//       <Rune>;

//       <Rune>;
//       "
//     `)
//   })

//   test('display unnamed object', async () => {
//     const code = `
//     import {play, sine_sound} from "sound";
//     play(sine_sound(440, 5));
//     `
//     const steps = await testEvalSteps(code)
//
//     expect(steps.map(x => codify(x[0])).join('\n')).toMatchInlineSnapshot(`
//       "play(sine_sound(440, 5));

//       play(sine_sound(440, 5));

//       play([Object]);

//       play([Object]);

//       <AudioPlayed>;

//       <AudioPlayed>;
//       "
//     `)
//   })
// })
