import * as acorn from 'acorn'
import { getSteps } from '../steppers'
import { convert } from '../generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../interface'
import { StepperProgram } from '../nodes/Program'
import { StepperExpressionStatement } from '../nodes/Statement/ExpressionStatement'
import { StepperArrowFunctionExpression } from '../nodes/Expression/ArrowFunctionExpression'
import { StepperVariableDeclaration } from '../nodes/Statement/VariableDeclaration'

function codify(node: StepperBaseNode) {
  const steps = getSteps(convert(node), { stepLimit: 1000 })
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
      prop.markers && prop.markers[0] && prop.markers[0].redexType
        ? `[${prop.markers[0].redexType}]`
        : '[noMarker]'
    return code + '\n' + markerAnnotation + ' ' + explanation + '\n'
  })
}

function acornParser(code: string): StepperBaseNode {
  return convert(acorn.parse(code, { ecmaVersion: 10 }))
}

describe('Expressions', () => {
  test('No extra step for UnaryExpression', async () => {
    const code = `
    - (1 + 2);
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('')).toMatchSnapshot()
  }),
    test('Extra step for UnaryExpression', async () => {
      const code = `
    - (1 - 5);
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('')).toMatchInlineSnapshot(`
        "-(1 - 5);
        [noMarker] Start of evaluation
        -(1 - 5);
        [beforeMarker] Binary expression 1 - 5 evaluated
        --4;
        [afterMarker] Binary expression 1 - 5 evaluated
        --4;
        [beforeMarker] Unary expression evaluated, value -4 negated.
        4;
        [afterMarker] Unary expression evaluated, value -4 negated.
        4;
        [noMarker] Evaluation complete
        "
      `)
    }),
    test('Unary and Binary Expressions', async () => {
      const code = `
    - 1 + 2 * 3 - (5 * 6 - 7);
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('')).toMatchInlineSnapshot(`
        "-1 + 2 * 3 - (5 * 6 - 7);
        [noMarker] Start of evaluation
        -1 + 2 * 3 - (5 * 6 - 7);
        [beforeMarker] Binary expression 2 * 3 evaluated
        -1 + 6 - (5 * 6 - 7);
        [afterMarker] Binary expression 2 * 3 evaluated
        -1 + 6 - (5 * 6 - 7);
        [beforeMarker] Binary expression -1 + 6 evaluated
        5 - (5 * 6 - 7);
        [afterMarker] Binary expression -1 + 6 evaluated
        5 - (5 * 6 - 7);
        [beforeMarker] Binary expression 5 * 6 evaluated
        5 - (30 - 7);
        [afterMarker] Binary expression 5 * 6 evaluated
        5 - (30 - 7);
        [beforeMarker] Binary expression 30 - 7 evaluated
        5 - 23;
        [afterMarker] Binary expression 30 - 7 evaluated
        5 - 23;
        [beforeMarker] Binary expression 5 - 23 evaluated
        -18;
        [afterMarker] Binary expression 5 - 23 evaluated
        -18;
        [noMarker] Evaluation complete
        "
      `)
    }),
    test('Logical Expression', async () => {
      const code = `
    !!!true || true;
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('')).toMatchInlineSnapshot(`
        "!!!true || true;
        [noMarker] Start of evaluation
        !!!true || true;
        [beforeMarker] Unary expression evaluated, boolean true negated.
        !!false || true;
        [afterMarker] Unary expression evaluated, boolean true negated.
        !!false || true;
        [beforeMarker] Unary expression evaluated, boolean false negated.
        !true || true;
        [afterMarker] Unary expression evaluated, boolean false negated.
        !true || true;
        [beforeMarker] Unary expression evaluated, boolean true negated.
        false || true;
        [afterMarker] Unary expression evaluated, boolean true negated.
        false || true;
        [beforeMarker] OR operation evaluated, left of operator is false, continue evaluating right of operator
        true;
        [afterMarker] OR operation evaluated, left of operator is false, continue evaluating right of operator
        true;
        [noMarker] Evaluation complete
        "
      `)
    })
  test('Conditional Expression', async () => {
    const code = `
    (-1 * 3 === 3) ? 2 * 4 - 7 : 1 + 3 * 6;
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('')).toMatchInlineSnapshot(`
      "-1 * 3 === 3 ? 2 * 4 - 7 : 1 + 3 * 6;
      [noMarker] Start of evaluation
      -1 * 3 === 3 ? 2 * 4 - 7 : 1 + 3 * 6;
      [beforeMarker] Binary expression -1 * 3 evaluated
      -3 === 3 ? 2 * 4 - 7 : 1 + 3 * 6;
      [afterMarker] Binary expression -1 * 3 evaluated
      -3 === 3 ? 2 * 4 - 7 : 1 + 3 * 6;
      [beforeMarker] Binary expression -3 === 3 evaluated
      false ? 2 * 4 - 7 : 1 + 3 * 6;
      [afterMarker] Binary expression -3 === 3 evaluated
      false ? 2 * 4 - 7 : 1 + 3 * 6;
      [beforeMarker] Conditional expression evaluated, condition is false, alternate evaluated
      1 + 3 * 6;
      [afterMarker] Conditional expression evaluated, condition is false, alternate evaluated
      1 + 3 * 6;
      [beforeMarker] Binary expression 3 * 6 evaluated
      1 + 18;
      [afterMarker] Binary expression 3 * 6 evaluated
      1 + 18;
      [beforeMarker] Binary expression 1 + 18 evaluated
      19;
      [afterMarker] Binary expression 1 + 18 evaluated
      19;
      [noMarker] Evaluation complete
      "
    `)
  })
})

test('Test two statements', async () => {
  const code = `
    (1 + 2) * (3 + 4);
    3 * 5;
  `
  const steps = await codify(acornParser(code))
  expect(steps.join('\n')).toMatchInlineSnapshot(`
    "(1 + 2) * (3 + 4);3 * 5;
    [noMarker] Start of evaluation

    (1 + 2) * (3 + 4);3 * 5;
    [beforeMarker] Binary expression 1 + 2 evaluated

    3 * (3 + 4);3 * 5;
    [afterMarker] Binary expression 1 + 2 evaluated

    3 * (3 + 4);3 * 5;
    [beforeMarker] Binary expression 3 + 4 evaluated

    3 * 7;3 * 5;
    [afterMarker] Binary expression 3 + 4 evaluated

    3 * 7;3 * 5;
    [beforeMarker] Binary expression 3 * 7 evaluated

    21;3 * 5;
    [afterMarker] Binary expression 3 * 7 evaluated

    21;3 * 5;
    [beforeMarker] Binary expression 3 * 5 evaluated

    21;15;
    [afterMarker] Binary expression 3 * 5 evaluated

    21;15;
    [beforeMarker] 21 finished evaluating

    15;
    [afterMarker] 21 finished evaluating

    15;
    [noMarker] Evaluation complete
    "
  `)
})

test('Test constant declaration substitution', async () => {
  const code = `
    const x = -1;
    x;
    const y = 2;
    y;
  `
  const steps = await codify(acornParser(code))
  expect(steps.join('\n')).toMatchInlineSnapshot(`
    "const x = -1;x;const y = 2;y;
    [noMarker] Start of evaluation

    const x = -1;x;const y = 2;y;
    [beforeMarker] Constant x declared and substituted into the rest of block

    -1;const y = 2;y;
    [afterMarker] Constant x declared and substituted into the rest of block

    -1;const y = 2;y;
    [beforeMarker] Constant y declared and substituted into the rest of block

    -1;2;
    [afterMarker] Constant y declared and substituted into the rest of block

    -1;2;
    [beforeMarker] -1 finished evaluating

    2;
    [afterMarker] -1 finished evaluating

    2;
    [noMarker] Evaluation complete
    "
  `)
})

describe('Lambda expression', () => {
  test('Basic function', async () => {
    const code = `
      const y = 2;
      const f = x => x + y;
      f(1);
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchInlineSnapshot(`
      "const y = 2;const f = x => x + y;f(1);
      [noMarker] Start of evaluation

      const y = 2;const f = x => x + y;f(1);
      [beforeMarker] Constant y declared and substituted into the rest of block

      const f = x => x + 2;f(1);
      [afterMarker] Constant y declared and substituted into the rest of block

      const f = x => x + 2;f(1);
      [beforeMarker] Constant f declared and substituted into the rest of block

      (x => x + 2)(1);
      [afterMarker] Constant f declared and substituted into the rest of block

      (x => x + 2)(1);
      [beforeMarker] 1 substituted into x of x => x + 2

      1 + 2;
      [afterMarker] 1 substituted into x of x => x + 2

      1 + 2;
      [beforeMarker] Binary expression 1 + 2 evaluated

      3;
      [afterMarker] Binary expression 1 + 2 evaluated

      3;
      [noMarker] Evaluation complete
      "
    `)
  }),
    test('Basic bi function', async () => {
      const code = `
      const add = (x, y) => x + y;
      add(2, 3);
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchInlineSnapshot(`
        "const add = (x, y) => x + y;add(2, 3);
        [noMarker] Start of evaluation

        const add = (x, y) => x + y;add(2, 3);
        [beforeMarker] Constant add declared and substituted into the rest of block

        ((x, y) => x + y)(2, 3);
        [afterMarker] Constant add declared and substituted into the rest of block

        ((x, y) => x + y)(2, 3);
        [beforeMarker] 2, 3 substituted into x, y of (x, y) => x + y

        2 + 3;
        [afterMarker] 2, 3 substituted into x, y of (x, y) => x + y

        2 + 3;
        [beforeMarker] Binary expression 2 + 3 evaluated

        5;
        [afterMarker] Binary expression 2 + 3 evaluated

        5;
        [noMarker] Evaluation complete
        "
      `)
    }),
    test('Currying', async () => {
      const code = `
      const add = x => y => x + y;
      add(2)(3);
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchInlineSnapshot(`
        "const add = x => y => x + y;add(2)(3);
        [noMarker] Start of evaluation

        const add = x => y => x + y;add(2)(3);
        [beforeMarker] Constant add declared and substituted into the rest of block

        (x => y => x + y)(2)(3);
        [afterMarker] Constant add declared and substituted into the rest of block

        (x => y => x + y)(2)(3);
        [beforeMarker] 2 substituted into x of x => y => x + y

        (y => 2 + y)(3);
        [afterMarker] 2 substituted into x of x => y => x + y

        (y => 2 + y)(3);
        [beforeMarker] 3 substituted into y of y => 2 + y

        2 + 3;
        [afterMarker] 3 substituted into y of y => 2 + y

        2 + 3;
        [beforeMarker] Binary expression 2 + 3 evaluated

        5;
        [afterMarker] Binary expression 2 + 3 evaluated

        5;
        [noMarker] Evaluation complete
        "
      `)
    }),
    test('Recursive function call', async () => {
      const code = `
      const factorial = n => n === 0 ? 1 : n * factorial(n - 1);
      factorial(2);
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
    test('Mu term after substitution', async () => {
      const code = `
      const f = x => f;
      f(1);
    `
      const steps = await getSteps(convert(acornParser(code)), { stepLimit: 1000 })
      expect(steps.length).toBe(6)
      const firstStatement = (steps[0].ast as StepperProgram).body[0]
      // No mu term before substitution
      expect(firstStatement.type).toBe('VariableDeclaration')
      const declaration = (firstStatement as StepperVariableDeclaration).declarations[0].init!
      expect(declaration.type).toBe('ArrowFunctionExpression')
      expect((declaration as StepperArrowFunctionExpression).name).toBeUndefined();
      
      // Mu term after substitution
      const lastStatement = ((steps[5].ast as StepperProgram).body[0] as StepperExpressionStatement)
        .expression
      expect(lastStatement.type).toBe('ArrowFunctionExpression')
      expect((lastStatement as StepperArrowFunctionExpression).name).toBe('f')
    })
})

describe('Alpha renaming', () => {
  test('Basic', async () => {
    const code = `
        const f = x => g();
        const g = () => x;
        const x = 1;
        f(0);
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  }),
    test('Avoiding naming conflicts', async () => {
      const code = `
        const f = (x_1, x_3, x_2) => g();
        const g = () => x_1 + x_3 + x_2;
        const x_1 = 1;
        const x_3 = 3;
        const x_2 = 2;
        f(0, 1, 2);
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    })
})

describe('SOURCE 0', () => {
  test('undefined || 1', async () => {
    const code = `
    undefined || 1;
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  }),
    test('1 + math_sin', async () => {
      const code = `
    1 + math_sin;
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
    test('plus undefined', async () => {
      const code = `
    math_sin(1) + undefined;
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
    test('math_pow', async () => {
      const code = `
    math_pow(2, 20) || NaN;
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
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
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
    test('Even odd mutual', async () => {
      const code = `
    const odd = n => n === 0 ? false : even(n-1);
    const even = n => n === 0 || odd(n-1);
    even(1);
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
    test('Infinite recursion', async () => {
      const code = `
    function f() {
      return f();
  }
  f();
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    })
})

describe('List operations', () => {
  test('is_null', async () => {
    const code = 'is_null(tail(list(1)));'
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  }),
    test('Append on list of null', async () => {
      const code = 'const a = list(null); append(a, a);'
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
    test('map on list', async () => {
      const code = 'map(x => list(x, 1), list(1, 2, 3));'
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
    test('filter on list', async () => {
      const code = 'filter(x => x % 2 === 1, list(1, 2, 3));'
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
    test('accumulate on list', async () => {
      const code = 'accumulate((x, y) => x + y, 0, list(1, 2, 3));'
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    }),
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
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot();
    }),
    test('flatmap', async () => {
      const code = `
    const flatMap = (f, xs) => 
    accumulate((acc, init) => append(f(acc), init), null, xs);
    flatMap(x => list(x, x + 1), list(2, 3, 4));
`
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchSnapshot()
    })
})

test('triple equals work on function', async () => {
  const code = `
    function f() { return g(); } function g() { return f(); }
    f === f;
    g === g;
    f === g;
  `
  const steps = await codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
})

test('Function declaration with if else block', async () => {
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
const steps = await codify(acornParser(code))
  expect(steps.join('\n')).toMatchSnapshot()
})