import { generate } from 'astring'
import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { stripIndent } from '../../utils/formatters'
import { transpileToGPU } from '../../gpu/gpu'

test('simple custom function gets transpiled', () => {
  const code = stripIndent`
    function add(x, y) {
        return x + y;
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = add(i, i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)?.length
  expect(cnt).toEqual(1)
})

test('math function gets transpiled', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = math_sin(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)?.length
  expect(cnt).toEqual(1)
})

test('custom function calling custom function gets transpiled', () => {
  const code = stripIndent`
    function add(x, y) {
        return x + y;
    }
    function add_twice(x, y) {
        return add(x, y) + add(x, y);
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = add_twice(i, i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)?.length
  expect(cnt).toEqual(1)
})

test('custom function calling math function gets transpiled', () => {
  const code = stripIndent`
    function sin(x) {
        return math_sin(x);
    }
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = sin(i);
    }
    `
  const context = mockContext(4, 'gpu')
  const program = parse(code, context)!
  transpileToGPU(program)
  const transpiled = generate(program)

  const cnt = transpiled.match(/__createKernelSource/g)?.length
  expect(cnt).toEqual(1)
})
