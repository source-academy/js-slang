import * as acorn from 'acorn'
import { getSteps } from '../steppers'
import { convert } from '../generator'
import * as astring from 'astring'
import { StepperBaseNode } from '../interface'

function codify(node: StepperBaseNode) {
  const steps = getSteps(convert(node))
  const stringify = (ast: StepperBaseNode) => {
    if (ast === undefined || ast!.type === undefined) {
      return ''
    }
    return astring.generate(ast)
  }
  return steps.map(prop => stringify(prop.ast))
}

function acornParser(code: string): StepperBaseNode {
  return convert(acorn.parse(code, { ecmaVersion: 10 }))
}

describe('Test calling anonymous functions', () => {
  test('Function that exists', async () => {
    const code = `
    const foo = x => x + 1;
    foo(1 + 2);
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
})

describe('Test statements', () => {
  test('Undefined', async () => {
    const code = `
    undefined;
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('Non value statement', async () => {
    const code = `
    const x = 3;
    `
    const steps = await codify(acornParser(code))
    expect(steps).toMatchInlineSnapshot(`
      Array [
        "const x = 3;
      ",
        "const x = 3;
      ",
        "",
        "undefined;",
      ]
    `)
  })
  test('Value inducing', async () => {
    const code = `
    1 + 1;
    2 + 3 * 4;
    5;
    2;
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
  test('constant declaration', async () => {
    const code = `
    1 + 1;
    const x = 3;
    const y = 4;
    2 + 7;
    1 + 9;
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })
})

describe('Block statement', () => {
  test('empty block', async () => {
    const code = `
    {}
    `
    const steps = await codify(acornParser(code))
    expect(steps).toMatchInlineSnapshot(`
      Array [
        "{}
      ",
        "{}
      ",
        "",
        "undefined;",
      ]
    `)
  })

  test('non value producing block', async () => {
    const code = `
    {
      const x = 1;
    }
    `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchInlineSnapshot(`
      "{
        const x = 1;
      }

      {
        const x = 1;
      }

      {}

      {}


      undefined;"
    `)
  })

  test('Empty blocks in block', async () => {
    const code = `
      {
        3;
        {
          {}
          {}
        }
      }
      `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchSnapshot()
  })

  test('Empty block in function', async () => {
    const code = `
      function f() {
        3;
        {}
      }
      f();
      `
    const steps = await codify(acornParser(code))
    expect(steps.join('\n')).toMatchInlineSnapshot(`
      "function f() {
        3;
        {}
      }
      f();

      function f() {
        3;
        {}
      }
      f();

      f();

      {
        3;
        {}
      };

      {
        3;
        {}
      };

      {
        3;
      };

      {
        3;
      };

      undefined;
      "
    `)
  })
})
