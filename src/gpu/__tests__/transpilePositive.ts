import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { stripIndent } from '../../utils/formatters'
import { transpile } from '../../transpiler/transpiler'

test('simple for loop gets transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = i;
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('many simple for loop gets transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = i;
    }

    let res1 = [];
    for (let i = 0; i < 5; i = i + 1) {
      res1[i] = i;
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('simple for loop with constant condition transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    const c = 10;
    for (let i = 0; i < c; i = i + 1) {
        res[i] = i;
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect({ code, transpiled }).toMatchSnapshot()
})

test('simple for loop with let condition transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    let c = 10;
    for (let i = 0; i < c; i = i + 1) {
        res[i] = i;
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('simple for loop with math function call transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    let c = 10;
    for (let i = 0; i < c; i = i + 1) {
        res[i] = math_abs(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('simple for loop with different end condition transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    const f = () => 5;
    let c = f();
    for (let i = 0; i < c; i = i + 1) {
        res[i] = i;
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('2 for loop case gets transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        for (let j = 0; j < 5; j = j + 1) {
            res[i] = i;
        }
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('2 for loop case with body gets transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        let sum = 0;
        for (let j = 0; j < 5; j = j + 1) {
            sum = sum + j;
        }
        res[i] = sum;
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('2 for loop case with 2 indices being written to gets transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        for (let j = 0; j < 5; j = j + 1) {
            res[i][j] = i*j;
        }
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('3 for loop case with 1 indices being written to gets transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        for (let j = 0; j < 5; j = j + 1) {
            for (let k = 0; k < 5; k = k + 1) {
              res[i] = i*j;
            }
        }
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('3 for loop case with 2 indices being written to gets transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        for (let j = 0; j < 5; j = j + 1) {
            for (let k = 0; k < 5; k = k + 1) {
              res[i][j] = i*j;
            }
        }
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})

test('3 for loop case with 3 indices being written to gets transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        for (let j = 0; j < 5; j = j + 1) {
            for (let k = 0; k < 5; k = k + 1) {
              res[i][j][k] = i*j;
            }
        }
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect(transpiled).toMatchSnapshot()
})
