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
