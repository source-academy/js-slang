import * as acorn from 'acorn'
import { getSteps } from '../steppers'
import { convert } from '../generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../interface'
import { StepperProgram } from '../nodes/Program'
import { StepperExpressionStatement } from '../nodes/Statement/ExpressionStatement'
import { StepperArrowFunctionExpression } from '../nodes/Expression/ArrowFunctionExpression'

function codify(node: StepperBaseNode) {
  const steps = getSteps(convert(node))
  const stringify = (ast: StepperBaseNode) => {
    if (ast === undefined || ast!.type === undefined) {
      return ''
    }
    return astring.generate(ast)
  }
  return steps.map(prop => stringify(prop.ast).replace(/\n/g, '').replace(/\s+/g, ' '))
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
      expect(steps.join('')).toMatchInlineSnapshot(`"-(1 - 5);-(1 - 5);--4;--4;4;4;"`)
    }),
    test('Unary and Binary Expressions', async () => {
      const code = `
    - 1 + 2 * 3 - (5 * 6 - 7);
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('')).toMatchInlineSnapshot(
        `"-1 + 2 * 3 - (5 * 6 - 7);-1 + 2 * 3 - (5 * 6 - 7);-1 + 6 - (5 * 6 - 7);-1 + 6 - (5 * 6 - 7);5 - (5 * 6 - 7);5 - (5 * 6 - 7);5 - (30 - 7);5 - (30 - 7);5 - 23;5 - 23;-18;-18;"`
      )
    }),
    test('Logical Expression', async () => {
      const code = `
    !!!true || true;
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('')).toMatchInlineSnapshot(
        `"!!!true || true;!!!true || true;!!false || true;!!false || true;!true || true;!true || true;false || true;false || true;true;true;"`
      )
    })
  test('Conditional Expression', async () => {
    const code = `
    (-1 * 3 === 3) ? 2 * 4 - 7 : 1 + 3 * 6;
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('')).toMatchInlineSnapshot(
      `"-1 * 3 === 3 ? 2 * 4 - 7 : 1 + 3 * 6;-1 * 3 === 3 ? 2 * 4 - 7 : 1 + 3 * 6;-3 === 3 ? 2 * 4 - 7 : 1 + 3 * 6;-3 === 3 ? 2 * 4 - 7 : 1 + 3 * 6;false ? 2 * 4 - 7 : 1 + 3 * 6;false ? 2 * 4 - 7 : 1 + 3 * 6;1 + 3 * 6;1 + 3 * 6;1 + 18;1 + 18;19;19;"`
    )
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
    (1 + 2) * (3 + 4);3 * 5;
    3 * (3 + 4);3 * 5;
    3 * (3 + 4);3 * 5;
    3 * 7;3 * 5;
    3 * 7;3 * 5;
    21;3 * 5;
    21;3 * 5;
    21;15;
    21;15;
    15;
    15;"
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
    const x = -1;x;const y = 2;y;
    -1;const y = 2;y;
    -1;const y = 2;y;
    -1;2;
    -1;2;
    2;
    2;"
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
      const y = 2;const f = x => x + y;f(1);
      const f = x => x + 2;f(1);
      const f = x => x + 2;f(1);
      (x => x + 2)(1);
      (x => x + 2)(1);
      1 + 2;
      1 + 2;
      3;
      3;"
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
        const add = (x, y) => x + y;add(2, 3);
        ((x, y) => x + y)(2, 3);
        ((x, y) => x + y)(2, 3);
        2 + 3;
        2 + 3;
        5;
        5;"
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
        const add = x => y => x + y;add(2)(3);
        (x => y => x + y)(2)(3);
        (x => y => x + y)(2)(3);
        (y => 2 + y)(3);
        (y => 2 + y)(3);
        2 + 3;
        2 + 3;
        5;
        5;"
      `)
    }),
    test('Recursive function call', async () => {
      const code = `
      const factorial = n => n === 0 ? 1 : n * factorial(n - 1);
      factorial(2);
    `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchInlineSnapshot(`
        "const factorial = n => n === 0 ? 1 : n * factorial(n - 1);factorial(2);
        const factorial = n => n === 0 ? 1 : n * factorial(n - 1);factorial(2);
        (n => n === 0 ? 1 : n * factorial(n - 1))(2);
        (n => n === 0 ? 1 : n * factorial(n - 1))(2);
        2 === 0 ? 1 : 2 * (n => n === 0 ? 1 : n * factorial(n - 1))(2 - 1);
        2 === 0 ? 1 : 2 * (n => n === 0 ? 1 : n * factorial(n - 1))(2 - 1);
        false ? 1 : 2 * (n => n === 0 ? 1 : n * factorial(n - 1))(2 - 1);
        false ? 1 : 2 * (n => n === 0 ? 1 : n * factorial(n - 1))(2 - 1);
        2 * (n => n === 0 ? 1 : n * factorial(n - 1))(2 - 1);
        2 * (n => n === 0 ? 1 : n * factorial(n - 1))(2 - 1);
        2 * (n => n === 0 ? 1 : n * factorial(n - 1))(1);
        2 * (n => n === 0 ? 1 : n * factorial(n - 1))(1);
        2 * (1 === 0 ? 1 : 1 * (n => n === 0 ? 1 : n * factorial(n - 1))(1 - 1));
        2 * (1 === 0 ? 1 : 1 * (n => n === 0 ? 1 : n * factorial(n - 1))(1 - 1));
        2 * (false ? 1 : 1 * (n => n === 0 ? 1 : n * factorial(n - 1))(1 - 1));
        2 * (false ? 1 : 1 * (n => n === 0 ? 1 : n * factorial(n - 1))(1 - 1));
        2 * (1 * (n => n === 0 ? 1 : n * factorial(n - 1))(1 - 1));
        2 * (1 * (n => n === 0 ? 1 : n * factorial(n - 1))(1 - 1));
        2 * (1 * (n => n === 0 ? 1 : n * factorial(n - 1))(0));
        2 * (1 * (n => n === 0 ? 1 : n * factorial(n - 1))(0));
        2 * (1 * (0 === 0 ? 1 : 0 * (n => n === 0 ? 1 : n * factorial(n - 1))(0 - 1)));
        2 * (1 * (0 === 0 ? 1 : 0 * (n => n === 0 ? 1 : n * factorial(n - 1))(0 - 1)));
        2 * (1 * (true ? 1 : 0 * (n => n === 0 ? 1 : n * factorial(n - 1))(0 - 1)));
        2 * (1 * (true ? 1 : 0 * (n => n === 0 ? 1 : n * factorial(n - 1))(0 - 1)));
        2 * (1 * 1);
        2 * (1 * 1);
        2 * 1;
        2 * 1;
        2;
        2;"
      `)
    }),
    test('Even odd mutual', async () => {
      const code = `
      const odd = n => n === 0 ? false : even(n-1);
      const even = n => n === 0 || odd(n-1);
      even(1);
      `
      const steps = await codify(acornParser(code))
      expect(steps.join('\n')).toMatchInlineSnapshot(`
        "const odd = n => n === 0 ? false : even(n - 1);const even = n => n === 0 || odd(n - 1);even(1);
        const odd = n => n === 0 ? false : even(n - 1);const even = n => n === 0 || odd(n - 1);even(1);
        const even = n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1);even(1);
        const even = n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1);even(1);
        (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(1);
        (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(1);
        1 === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(n - 1))(1 - 1);
        1 === 0 || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(n - 1))(1 - 1);
        false || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(n - 1))(1 - 1);
        false || (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(n - 1))(1 - 1);
        (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(n - 1))(1 - 1);
        (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(n - 1))(1 - 1);
        (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(n - 1))(0);
        (n => n === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(n - 1))(0);
        0 === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(0 - 1);
        0 === 0 ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(0 - 1);
        true ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(0 - 1);
        true ? false : (n => n === 0 || (n => n === 0 ? false : even(n - 1))(n - 1))(0 - 1);
        false;
        false;"
      `)
    })
  test('Mu term after substitution', async () => {
    const code = `
      const f = x => f;
      f(1);
    `
    const steps = await getSteps(convert(acornParser(code)))
    expect(steps.length).toBe(6)
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
    expect(steps.join('\n')).toMatchInlineSnapshot(`
    "const f = x => g();const g = () => x;const x = 1;f(0);
    const f = x => g();const g = () => x;const x = 1;f(0);
    const g = () => x;const x = 1;(x => g())(0);
    const g = () => x;const x = 1;(x => g())(0);
    const x = 1;(x_1 => (() => x)())(0);
    const x = 1;(x_1 => (() => x)())(0);
    (x_1 => (() => 1)())(0);
    (x_1 => (() => 1)())(0);
    (() => 1)();
    (() => 1)();
    1;
    1;"
  `)
  }),
  test('Avoiding naming conflicts', async () => {
    const code = `
        const f = (x_1, x_3, x_2) => g();
        const g = () => x_1 + x_3 + x_2;
        const x_1 = 1;
        const x_3 = 3;
        const x_2 = 2;
        f(0);
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchInlineSnapshot();
  })
})

describe('Function declaration', () => {
  test.todo("")
})

describe('SOURCE 0', () => {
  test.todo("")
})


describe('SOURCE 1', () => {
  test.todo("")
})

describe('SOURCE 2', () => {
  test.todo("")
})