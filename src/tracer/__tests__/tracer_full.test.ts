import { describe, expect, test } from 'vitest'
import * as acorn from 'acorn'
import * as astring from 'astring'
import { getSteps } from '../steppers'
import { convert } from '../generator'
import type { StepperBaseNode } from '../interface'
import { StepperProgram } from '../nodes/Program'
import { StepperExpressionStatement } from '../nodes/Statement/ExpressionStatement'
import { StepperArrowFunctionExpression } from '../nodes/Expression/ArrowFunctionExpression'
import { StepperVariableDeclaration } from '../nodes/Statement/VariableDeclaration'
import createContext from '../../createContext'
import { mockContext } from '../../utils/testing/mocks'

function codify(node: StepperBaseNode) {
  const steps = getSteps(convert(node), createContext(2), { stepLimit: 1000 })
  const stringify = (ast: StepperBaseNode) => {
    if (ast === undefined || ast!.type === undefined) {
      return ''
    }
    return astring.generate(ast)
  }
  return steps.map(prop => {
    const code = stringify(prop.ast).replace(/\n/g, '').replace(/\s+/g, ' ')
    let explanation = '...'
    if (prop.markers && prop.markers[0]) {
      if (prop.markers[0].explanation !== undefined && prop.markers[0].explanation !== '') {
        explanation = prop.markers[0].explanation
      } else {
        explanation = `Missing explanation for type ${prop.markers![0].redex?.type}.`
        throw new Error(explanation)
      }
    }
    const markerAnnotation =
      prop.markers && prop.markers[0] && prop.markers[0].redexType !== undefined
        ? `[${prop.markers[0].redexType}]`
        : '[noMarker]'
    return code + '\n' + markerAnnotation + ' ' + explanation + '\n'
  })
}

function acornParser(code: string): StepperBaseNode {
  return convert(acorn.parse(code, { ecmaVersion: 10, locations: true }))
}

describe('Expressions', () => {
  test('No extra step for UnaryExpression', () => {
    const code = `
    - (1 + 2);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('')).toMatchSnapshot()
  })
  test('Extra step for UnaryExpression', () => {
    const code = `
    - (1 - 5);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('')).toMatchSnapshot()
  })
  test('Unary and Binary Expressions', () => {
    const code = `
    - 1 + 2 * 3 - (5 * 6 - 7);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('')).toMatchSnapshot()
  })
  test('Logical Expression', () => {
    const code = `
    !!!true || true;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('')).toMatchSnapshot()
  })
  test('Conditional Expression', () => {
    const code = `
    (-1 * 3 === 3) ? 2 * 4 - 7 : 1 + 3 * 6;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('')).toMatchSnapshot()
  })
})

test('Test two statements', () => {
  const code = `
    (1 + 2) * (3 + 4);
    3 * 5;
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
})

test('Test constant declaration substitution', () => {
  const code = `
    const x = -1;
    x;
    const y = 2;
    y;
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
})

describe('Lambda expression', () => {
  test('Basic function', () => {
    const code = `
      const y = 2;
      const f = x => x + y;
      f(1);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('Basic bi function', () => {
    const code = `
      const add = (x, y) => x + y;
      add(2, 3);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('Currying', () => {
    const code = `
      const add = x => y => x + y;
      add(2)(3);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('Recursive function call', () => {
    const code = `
      const factorial = n => n === 0 ? 1 : n * factorial(n - 1);
      factorial(2);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('Mu term after substitution', () => {
    const code = `
      const f = x => f;
      f(1);
    `
    const steps = getSteps(convert(acornParser(code)), mockContext(), { stepLimit: 1000 })
    expect(steps.length).toBe(6)
    const firstStatement = (steps[0].ast as StepperProgram).body[0]
    // No mu term before substitution
    expect(firstStatement.type).toBe('VariableDeclaration')
    const declaration = (firstStatement as StepperVariableDeclaration).declarations[0].init!
    expect(declaration.type).toBe('ArrowFunctionExpression')
    expect((declaration as StepperArrowFunctionExpression).name).toBeUndefined()

    // Mu term after substitution
    const lastStatement = ((steps[5].ast as StepperProgram).body[0] as StepperExpressionStatement)
      .expression
    expect(lastStatement.type).toBe('ArrowFunctionExpression')
    expect((lastStatement as StepperArrowFunctionExpression).name).toBe('f')
  })
})

describe('If else statements', () => {
  test('test if', () => {
    const code = `
      if (1 === 1) {
        1;
      } else if (2 === 2) {
        2; 
      } else {
        3; 
      }
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
  })
  test('test else if', () => {
    const code = `
      if (1 !== 1) {
        1;
      } else if (2 === 2) {
        2; 
      } else {
        3; 
      }
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })
  test('test else', () => {
    const code = `
      if (1 !== 1) {
        1;
      } else if (2 !== 2) {
        2; 
      } else {
        3; 
      }
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })
})

describe('Alpha renaming', () => {
  test('Basic', () => {
    const code = `
        const f = x => g();
        const g = () => x;
        const x = 1;
        f(0);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('Avoiding naming conflicts', () => {
    const code = `
        const f = (x_1, x_3, x_2) => g();
        const g = () => x_1 + x_3 + x_2;
        const x_1 = 1;
        const x_3 = 3;
        const x_2 = 2;
        f(0, 1, 2);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('renaming clash test for lambda function', () => {
    const code = `
      const f = w_11 => w_10 => w_11 + w_10 + g();
      const g = () => w_10;
      const w_10 = 0;
      f(1)(2);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })
  test('renaming clash test for functions', () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })

  test('renaming clash in replacement for lambda function', () => {
    const code = `
      const g = () => x_1 + x_2;
      const f = x_1 => x_2 => g();
      const x_1 = 0;
      const x_2 = 0;
      f(1)(1);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('0;\n[noMarker] Evaluation complete\n')
  })

  test(`renaming clash in replacement for function expression`, () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('0;\n[noMarker] Evaluation complete\n')
  })

  test(`renaming clash in replacement for function declaration`, () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('0;\n[noMarker] Evaluation complete\n')
  })

  test(`multiple clash for function declaration`, () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('4;\n[noMarker] Evaluation complete\n')
  })

  test(`multiple clash for function expression`, () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('4;\n[noMarker] Evaluation complete\n')
  })

  test(`multiple clash for lambda function`, () => {
    const code = `
      const f = x_2 => x_3 => x_4 + g();
      const g = () => x_2 + x_3;
      const x_3 = 0;
      const x_2 = 2;
      const x_4 = 2;
      f(1)(1);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('4;\n[noMarker] Evaluation complete\n')
  })

  test(`multiple clash 2 for lambda function`, () => {
    const code = `
      const f = x => x_1 => x_2 + g();
      const g = () => x + x_1;
      const x_2 = 0;
      const x_1 = 2;
      const x = 1;
      f(1)(1);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })

  test(`multiple clash for lambda function with block expression`, () => {
    const code = `
      const f = x => {
        const x_1 = 1;
        return x_1 => x_2 + g();  
      };
      const g = () => x + x_1;
      const x_2 = 0;
      const x_1 = 2;
      const x = 1;
      f(1)(1);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })

  test(`multiple clash 2 for function expression`, () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })

  test(`multiple clash 2 for function declaration`, () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })

  test(`renaming clash with declaration in replacement for function declaration`, () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })

  test(`renaming clash with declaration in replacement for function expression`, () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })

  test(`renaming clash with declaration in replacement for lambda function`, () => {
    const code = `
      const f = x => x_1 => g();
      const g = () => { const x_2 = 2; return x_1 + x + x_2; };
      const x = 0;
      const x_1 = 0;
      f(1)(1);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })

  test(`renaming clash with parameter of lambda function declaration in block`, () => {
    const code = `
      const g = () => x_1;
      const f = x_1 => {
          const h = x_2 => x_1 + g();
          return h;
      };
    
      const x_1 = 1;
      f(3)(2);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('4;\n[noMarker] Evaluation complete\n')
  })

  test(`renaming clash with parameter of function declaration in block`, () => {
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('4;\n[noMarker] Evaluation complete\n')
  })

  test(`renaming of outer parameter in lambda function`, () => {
    const code = `
      const g = () =>  w_1;
      const f = w_1 => w_2 => w_1 + g();
      const w_1 = 0;
      f(1)(1);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
  })
})

describe('SOURCE 0 (Tests from previous stepper)', () => {
  test('undefined || 1', () => {
    const code = `
    undefined || 1;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('1 + math_sin', () => {
    const code = `
    1 + math_sin;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('plus undefined', () => {
    const code = `
    math_sin(1) + undefined;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('math_pow', () => {
    const code = `
    math_pow(2, 20) || NaN;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
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
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('Even odd mutual', () => {
    const code = `
    const odd = n => n === 0 ? false : even(n-1);
    const even = n => n === 0 || odd(n-1);
    even(1);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('Infinite recursion', () => {
    const code = `
    function f() {
      return f();
  }
  f();
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
})

describe('Builtin math', () => {
  test('PI returns its value', () => {
    const code = 'math_PI;'
    const steps = codify(acornParser(code))
    expect(steps[steps.length - 1]).toEqual('3.141592653589793;\n[noMarker] Evaluation complete\n')
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('math_sin() returns NaN', () => {
    const code = 'math_sin();'
    const steps = codify(acornParser(code))
    expect(steps[steps.length - 1]).toEqual('NaN;\n[noMarker] Evaluation complete\n')
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('negative numbers as arguments', () => {
    const code = `
    math_sin(-1);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
})

describe('Misc', () => {
  test('is function', () => {
    const code = `
        is_function(is_function);
      `
    const steps = codify(acornParser(code))
    expect(steps[steps.length - 1]).toEqual('true;\n[noMarker] Evaluation complete\n')
  })
  test('arity', () => {
    const code = `
        arity(is_function) === arity(arity);
      `
    const steps = codify(acornParser(code))
    expect(steps[steps.length - 1]).toEqual('true;\n[noMarker] Evaluation complete\n')
  })
})

describe('List operations', () => {
  test('is_null', () => {
    const code = 'is_null(tail(list(1)));'
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('true;\n[noMarker] Evaluation complete\n')
  })
  test('Append on list of null', () => {
    const code = 'const a = list(null); append(a, a);'
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('map on list', () => {
    const code = 'equal(map(x => 2 * x, list(1, 2, 3)), list(2, 4, 6))'
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('true;\n[noMarker] Evaluation complete\n')
  })
  test('filter on list', () => {
    const code = 'equal(filter(x => x % 2 === 1, list(1, 2, 3)), list(1, 3));'
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('true;\n[noMarker] Evaluation complete\n')
  })
  test('accumulate on list', () => {
    const code = 'accumulate((x, y) => x + y, 0, list(1, 2, 3)) === 6;'
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('true;\n[noMarker] Evaluation complete\n')
  })
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
    equal(subsets(list(1, 2)), list(null, list(2), list(1), list(1, 2)));
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('true;\n[noMarker] Evaluation complete\n')
  })
  test('flatmap', () => {
    const code = `
    const flatMap = (f, xs) => 
    accumulate((acc, init) => append(f(acc), init), null, xs);
    equal(flatMap(x => list(x, x + 1), list(2, 3, 4)), list(2, 3, 3, 4, 4, 5));
    
`
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('true;\n[noMarker] Evaluation complete\n')
  })
})

test('triple equals work on function', () => {
  const code = `
    function f() { return g(); } function g() { return f(); }
    f === f;
    g === g;
    f === g;
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
})

test('Function declaration with if else block', () => {
  const code = `
function f() {
    const x = 2;
    if (true) {
        5 + x;
        return 2;
    } else {}
}

f();
`
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
})

test('constant declarations in blocks are protected', () => {
  const code = `
    const z = 1;

function f(g) {
    const z = 3;
    return g(z);
}

f(y => y + z);
  `
  const steps = codify(acornParser(code))
  expect(steps[steps.length - 1]).toEqual('4;\n[noMarker] Evaluation complete\n')
  expect(steps.join('\n')).toMatchSnapshot()
})

test('function declarations in blocks are protected', () => {
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
  const steps = codify(acornParser(code))
  expect(steps[steps.length - 1]).toEqual('5;\n[noMarker] Evaluation complete\n')
  expect(steps.join('\n')).toMatchSnapshot()
})

test('const declarations in blocks subst into call expressions', () => {
  const code = `
  const z = 1;
  function f(g) {
    const z = 3;
    return (y => z + z)(z);
  }
  f(undefined);
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('6;\n[noMarker] Evaluation complete\n')
})

test('scoping test for lambda expressions nested in blocks', () => {
  const code = `
  {
    const f = x => g();
    const g = () => x;
    const x = 1;
    f(0);
  }
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
})

test('scoping test for blocks nested in lambda expressions', () => {
  const code = `
  const f = x => { g(); };
  const g = () => { x; };
  const x = 1;
  f(0);
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
})

test('scoping test for function expressions', () => {
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
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
})

test('scoping test for lambda expressions', () => {
  const code = `
  const f = x => g();
  const g = () => x;
  const x = 1;
  f(0);
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
})

test('scoping test for block expressions', () => {
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
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
})

test('scoping test for block expressions, no renaming', () => {
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
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
})

test('return in nested blocks', () => {
  const code = `
  function f(x) {{ return 1; }}
  f(0);
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
})

describe(`#1109: Empty function bodies don't break execution`, () => {
  test('Function declaration', () => {
    const code = `
    function a() {}
    "other statement";
    a();
    "Gets returned by normal run";
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(
      '"Gets returned by normal run";\n[noMarker] Evaluation complete\n'
    )
  })

  test('Constant declaration of lambda', () => {
    const code = `
    const a = () => {};
    "other statement";
    a();
    "Gets returned by normal run";
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(
      '"Gets returned by normal run";\n[noMarker] Evaluation complete\n'
    )
  })
})

describe(`#1342: Test the fix of #1341: Stepper limit off by one`, () => {
  test('Program steps equal to Stepper limit', () => {
    const code = `
      function factorial(n) {
        return n === 1
          ? 1
          : n * factorial(n - 1);
      }
      factorial(100);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(
      '9.33262154439441e+157;\n[noMarker] Evaluation complete\n'
    )
  })
})

describe(`Evaluation of empty code and imports`, () => {
  test('Evaluate empty program', () => {
    const code = ``
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
})

/**
 * start of stepper specification tests
 */
describe(`Programs`, () => {
  //Program-intro:
  test('Program-intro test case 1', () => {
    const code = `1 + 1;`
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })

  test('Program-intro test case 2', () => {
    const code = `
      1;
      1 + 1;
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })
  //Program-reduce:
  test('Program-reduce test case', () => {
    const code = `
      1;
      2;
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })
  //Eliminate-function-declaration:
  test('Eliminate-function-declaration test case 1', () => {
    const code = `
      function foo(x) {
        return 0;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })

  test('Eliminate-function-declaration test case 2', () => {
    const code = `
      1;
      function foo(x) {
        return 0;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
  })
  //Eliminate-constant-declaration:
  test('Eliminate-constant-declaration test case 1', () => {
    const code = `
      const x = 0;
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })

  test('Eliminate-constant-declaration test case 2', () => {
    const code = `
      1;
      const x = 0;
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
  })
})

describe(`Statements: Expression statements`, () => {
  //Expression-statement-reduce:
  test('Expression-statement-reduce test case', () => {
    const code = `
      1 + 2 + 3;
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('6;\n[noMarker] Evaluation complete\n')
  })
})

describe(`Statements: Constant declarations`, () => {
  //Evaluate-constant-declaration:
  test('Evaluate-constant-declaration test case', () => {
    const code = `
      const x = 1 + 2 + 3;
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
})

describe(`Statements: Conditionals`, () => {
  //Conditional-statement-predicate:
  test('Conditional-statement-predicate test case', () => {
    const code = `
      if (1 + 2 + 3 === 1) {

      } else {

      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
  //Conditional-statement-consequent:
  test('Conditional-statement-consequent test case', () => {
    const code = `
      if (true) {
        1;
      } else {
        2;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
  })
  //Conditional-statement-alternative:
  test('Conditional-statement-alternative test case', () => {
    const code = `
      if (false) {
        1;
      } else {
        2;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })
  //Conditional-statement-blockexpr-consequent:
  test('Conditional-statement-blockexpr-consequent test case 1', () => {
    const code = `
      function foo(x) {
        if (true) {
          1;
        } else {
          2;
        }
      }
      foo(0);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })

  test('Conditional-statement-blockexpr-consequent test case 2', () => {
    const code = `
      function foo(x) {
        3;
        if (true) {
          1;
        } else {
          2;
        }
      }
      foo(0);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
  //Conditional-statement-blockexpr-alternative:
  test('Conditional-statement-blockexpr-alternative test case 1', () => {
    const code = `
    function foo(x) {
      if (false) {
        1;
      } else {
        2;
      }
    }
    foo(0);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })

  test('Conditional-statement-blockexpr-alternative test case 2', () => {
    const code = `
    function foo(x) {
      3;
      if (false) {
        1;
      } else {
        2;
      }
    }
    foo(0);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
})

describe(`Statements: Blocks`, () => {
  //Block-statement-intro:
  test('Block-statement-intro test case', () => {
    const code = `
      {
        1 + 1;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })
  //Block-statement-single-reduce:
  test('Block-statement-single-reduce test case', () => {
    const code = `
      {
        1;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
  })
  //Block-statement-empty-reduce:
  test('Block-statement-empty-reduce test case 1', () => {
    const code = `
      {

      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })

  test('Block-statement-empty-reduce test case 2', () => {
    const code = `
      {
        {
          {

          }
          {

          }
        }

        {
          {

          }
          {

          }
        }
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
})

describe(`Expresssions: Blocks`, () => {
  //Block-expression-intro:
  test('Block-expression-intro test case', () => {
    const code = `
      function foo(x) {
        1 + 1;
      }
      foo(0);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
  //Block-expression-single-reduce:
  test('Block-expression-single-reduce test case', () => {
    const code = `
      function foo(x) {
        1;
      }
      foo(0);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
  //Block-expression-empty-reduce:
  test('Block-expression-empty-reduce test case', () => {
    const code = `
      function foo(x) {
      }
      foo(0);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
  /**
   * Block-expression-return-reduce is not included as test cases
   * This section needs further discussion
   */
})

describe(`Expressions: Binary operators`, () => {
  //Left-binary-reduce:
  test('Left-binary-reduce test case', () => {
    const code = `
      if (1 + 2 + 3 === 1 + 2 + 3) {
        1;
      } else {
        2;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
  })
  //And-shortcut-false:
  test('And-shortcut-false test case', () => {
    const code = `
      if (false && 1 + 2 === 1 + 2) {
        1;
      } else {
        2;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })
  //And-shortcut-true:
  test('And-shortcut-true test case', () => {
    const code = `
      if (true && 1 + 2 === 2 + 3) {
        1;
      } else {
        2;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })
  //Or-shortcut-true:
  test('Or-shortcut-true test case', () => {
    const code = `
      if (true || 1 + 2 === 2 + 3) {
        1;
      } else {
        2;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
  })
  //Or-shortcut-false:
  test('Or-shortcut-false test case', () => {
    const code = `
      if (false || 1 + 2 === 1 + 2) {
        1;
      } else {
        2;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('1;\n[noMarker] Evaluation complete\n')
  })
  //Right-binary-reduce:
  test('Right-binary-reduce test case', () => {
    const code = `
      if (1 >= 1 + 1) {
        1;
      } else {
        2;
      }
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })
  //Prim-binary-reduce:
  test('Prim-binary-reduce test case', () => {
    const code = `
      if (1 >= 2) {
        1;
      } else {
        2;
      }
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('2;\n[noMarker] Evaluation complete\n')
  })
})

describe(`Expressions: conditionals`, () => {
  //Conditional-predicate-reduce:
  test('Conditional-predicate-reduce test case', () => {
    const code = `
      1 + 1 === 2 ? 1 + 2 : 2 + 3;
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })
  //Conditional-true-reduce:
  test('Conditional-true-reduce test case', () => {
    const code = `true ? 1 + 2 : 2 + 3;`
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })
  //Conditional-false-reduce:
  test('Conditional-false-reduce test case', () => {
    const code = `false ? 1 + 2 : 2 + 3;`
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('5;\n[noMarker] Evaluation complete\n')
  })
})

describe('Test reducing of empty block into epsilon', () => {
  test('Empty block in program', () => {
    const code = `
    3;
    {}
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })

  test('Empty blocks in block', () => {
    const code = `
    {
      3;
      {
        {}
        {}
      }
    }
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('3;\n[noMarker] Evaluation complete\n')
  })

  test('Empty block in function', () => {
    const code = `
    function f() {
      3;
      {}
    }
    f();
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('undefined;\n[noMarker] Evaluation complete\n')
  })
})

describe('Test correct evaluation sequence when first statement is a value', () => {
  test('Reducible second statement in program', () => {
    const code = `
    "value";
    const x = 10;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('"value";\n[noMarker] Evaluation complete\n')
  })

  test('Irreducible second statement in program', () => {
    const code = `
    'value';
    'also a value';
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(`'also a value';\n[noMarker] Evaluation complete\n`)
  })

  test('Reducible second statement in block', () => {
    const code = `
    {
      'value';
      const x = 10;
    }
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(`'value';\n[noMarker] Evaluation complete\n`)
  })

  test('Irreducible second statement in block', () => {
    const code = `
    {
      'value';
      'also a value';
    }
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(`'also a value';\n[noMarker] Evaluation complete\n`)
  })

  test('Reducible second statement in function', () => {
    const code = `
    function f () {
      'value';
      const x = 10;
      return 'another value';
    }
    f();
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(`'another value';\n[noMarker] Evaluation complete\n`)
  })

  test('Irreducible second statement in functions', () => {
    const code = `
    function f () {
      'value';
      'also a value';
      return 'another value';
    }
    f();
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(`'another value';\n[noMarker] Evaluation complete\n`)
  })

  test('Mix statements', () => {
    const code = `
    'value';
    const x = 10;
    function f() {
      20;
      function p() {
        22;
      }
    }
    const z = 30;
    'also a value';
    {
      'another value';
      const a = 40;
      a;
    }
    'another value';
    const a = 40;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(`'another value';\n[noMarker] Evaluation complete\n`)
  })
})
// Other tests
test('Church numerals', () => {
  const code = `
  const one = f => x => f(x);
  const inc = a => f => x => f(a(f)(x));
  const decode = a => a(x => x + 1)(0);
  decode(inc(inc(one))) === 3;
  
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('true;\n[noMarker] Evaluation complete\n')
})

test('steps appear as if capturing happens #1714', () => {
  const code = `
  function h(f, x) {
    function h(g, x) {
        return x <= 1 ? 1 : 3 * g(f, x - 1);
    }
        return x <= 1 ? 1 : 2 * f(h, x - 1);
    }
    h(h, 5);
  `
  const steps = codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
  expect(steps[steps.length - 1]).toEqual('36;\n[noMarker] Evaluation complete\n')
})

describe('Error handling on calling functions', () => {
  test('Literal function should error', () => {
    const code = `
    1(2);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('(1)(2);\n[noMarker] Evaluation stuck\n')
  })
  test('Literal function should error 2', () => {
    const code = `
      (1 * 3)(2 * 3 + 10);
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('(3)(16);\n[noMarker] Evaluation stuck\n')
  })
  test('Incorrect number of argument (less)', () => {
    const code = `
    function foo(a) {
      return a;
    }
    foo();
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual('(a => { return a;})();\n[noMarker] Evaluation stuck\n')
  })

  test('Incorrect number of argument (more)', () => {
    const code = `
    function foo(a) {
      return a;
    }
    foo(1, 2, 3);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1]).toEqual(
      '(a => { return a;})(1, 2, 3);\n[noMarker] Evaluation stuck\n'
    )
  })
})

describe('Test runtime errors', () => {
  test.skip('Variable used before assigning in program', () => {
    const code = `
    unassigned_variable;
    const unassigned_variable = "assigned";
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('Evaluation stuck')).toBe(true)
  })

  test.skip('Variable used before assigning in functions', () => {
    const code = `
    function foo() {
      unassigned_variable;
      const unassigned_variable = "assigned";
    }
    foo();
      `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('Evaluation stuck')).toBe(true)
  })

  test('Incompatible types operation', () => {
    const code = `
    "1" + 2 * 3;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('Evaluation stuck')).toBe(true)
  })
})

describe('Test catching errors from built in function', () => {
  /*
    While SOURCE 1 and 2 allow math function to receive boolean as argument,
    the legacy stepper prohibits this behavior.
  */
  test('Incorrect type of argument for math function', () => {
    const code = `
    math_sin(true);
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('Evaluation stuck')).toBe(true)
  })

  test('Incorrect type of arguments for module function', () => {
    const code = `
   arity("not a function"); 
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('Evaluation stuck')).toBe(true)
  })

  test('Incorrect number of arguments', () => {
    const code = `pair(2);`
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('Evaluation stuck')).toBe(true)
  })
})

describe('Test catching undefined variables', () => {
  test('Undefined variables 1', () => {
    const code = `
    x;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('not declared')).toBe(true)
  })

  test('Name declared later but not yet assigned', () => {
    const code = `
    x;
    const x = 1;
    x;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('Evaluation stuck')).toBe(true)
  })

  test('Undefined variables 3', () => {
    const code = `
    const f = () => x;
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('not declared')).toBe(true)
  })

  test('Undefined variables 4', () => {
    const code = `
    const f = () => x;
    const x = 1;
    f(); // should not error
    `
    const steps = codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
    expect(steps[steps.length - 1].includes('not declared')).toBe(false)
  })
})
