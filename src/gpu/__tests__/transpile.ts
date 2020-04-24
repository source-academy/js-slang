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

  expect({ code, transpiled }).toMatchSnapshot()
})

test('many simple for loop gets transpiled correctly', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 1) {
        res[i] = i;
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  expect({ code, transpiled }).toMatchSnapshot()
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

  expect({ code, transpiled }).toMatchSnapshot()
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

  expect({ code, transpiled }).toMatchSnapshot()
})
