import { generate } from 'astring'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { stripIndent } from '../../utils/formatters'
import { transpileToGPU } from '../../gpu/gpu'

test('function does not get transpiled if not defined in program', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = add(i, i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('higher order function does not get transpiled', () => {
  const code = stripIndent`
    function apply(f, x) {
        return f(x);
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = apply(math_sin, i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('recursive function does not get transpiled', () => {
  const code = stripIndent`
    function factorial(x) {
        if (x === 0) {
            return 1;
        } else {
            return x * factorial(x - 1);
        }
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = factorial(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('cyclically recursive functions do not get transpiled', () => {
  const code = stripIndent`
    function fun1(x) {
        if (x === 0) {
            return 0;
        } else {
            return fun2(x - 1);
        }
    }

    function fun2(x) {
        if (x === 0) {
            return 0;
        } else {
            return fun1(x - 1);
        }
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = fun1(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('function using reserved keyword does not get transpiled', () => {
  const code = stripIndent`
    function double(x) {
      return x * 2;
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = double(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('function beginning with double underscores does not get transpiled', () => {
  const code = stripIndent`
    function __fun(x) {
      return x;
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = __fun(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('function referencing external variable does not get transpiled', () => {
  const code = stripIndent`
    const j = 1;
    function fun(x) {
      return x + j;
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = fun(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('function assigning to external variable does not get transpiled', () => {
  const code = stripIndent`
    let j = 0;
    function fun(x) {
      j = 1;
      return x;
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = fun(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('function not defined in global scope does not get transpiled', () => {
  const code = stripIndent`
    {
      function fun(x) {
        return x;
      }
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = fun(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('function using Source library does not get transpiled', () => {
  const code = stripIndent`
    function fun(x) {
      return list(x);
    }

    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = fun(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})

test('function calling an invalid function does not get transpiled', () => {
  const code = stripIndent`
    let j = 1;
    function fun_invalid(x) {
      return x + j;
    }

    function fun(x) {
      return fun_invalid(x);
    }

    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = fun(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)
  expect(cnt).toEqual(null)
})
