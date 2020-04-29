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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(4)
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
  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
})

test('2 for loop case with 2 indices being written + local updates to gets transpiled correctly', () => {
  const code = stripIndent`
    let res1 = [];
    for (let i = 0; i < 5; i = i + 1) {
      res1[i] = [];
      for (let j = 0; j < 5; j = j + 1) {
        res1[i][j] = j;
      }
    }

    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        for (let j = 0; j < 5; j = j + 1) {
            let x = res1[i][j];
            let y = math_abs(x * -5);
            res[i][j] = x + y;
        }
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
})

test('2 for loop case with 2 indices being written + use of result variable[i][j] gets transpiled', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
      res[i] = [];
      for (let j = 0; j < 5; j = j + 1) {
        res[i][j] = j;
      }
    }

    for (let i = 0; i < 5; i = i + 1) {
        for (let j = 0; j < 5; j = j + 1) {
            let x = res[i][j];
            let y = math_abs(x * -5);
            res[i][j] = x + y;
        }
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled
  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
})

test('3 for loop case with 1 index being written to gets transpiled correctly', () => {
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
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

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(3)
})

test('many for loop case - matrix multiplication (2 transpilations)', () => {
  const code = stripIndent`
    const size = 10;
    const L = [];
    const R = [];
    for (let r = 0; r < size; r = r + 1) {
        L[r] = [];
        R[r] = [];
        for (let c = 0; c < size; c = c + 1) {
            L[r][c] = r*c;
            R[r][c] = r + c;
        }
    }

    const res = [];
    for (let r = 0; r < size; r = r + 1) {
        res[r] = [];
    }

    for (let r = 0; r < size; r = r + 1) {
        for (let c = 0; c < size; c = c + 1) {
            let sum = 0;
            for (let i = 0; i < size; i = i + 1) {
                sum = sum + L[r][i] * R[i][c];
            }
            res[r][c] = sum;
        }
    }
  `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  const cnt = transpiled.match(/__createKernel/g)?.length
  expect(cnt).toEqual(4)
})

test('resolve naming conflicts if __createKernel is used', () => {
  const code = stripIndent`
    const __createKernel = 10;

    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = i;
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // a new kernel function with name __createKernel0 should be created here
  const cntNewName = transpiled.match(/__createKernel0/g)?.length
  expect(cntNewName).toEqual(2)
})
