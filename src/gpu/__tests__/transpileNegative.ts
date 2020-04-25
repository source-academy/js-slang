import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { stripIndent } from '../../utils/formatters'
import { transpile } from '../../transpiler/transpiler'

test('simple for loop with different update does not get transpiled', () => {
  const code = stripIndent`
    let res = [];
    for (let i = 0; i < 5; i = i + 2) {
        res[i] = i;
    }
    `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')

  expect(replacedGlobalsLine).toMatchSnapshot()
})

test('simple for loop with different initialization does not get transpiled', () => {
  const code = stripIndent`
      let res = [];
      let i = 0;
      for (i = 0; i < 5; i = i + 2) {
          res[i] = i;
      }
      `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')

  expect(replacedGlobalsLine).toMatchSnapshot()
})

test('simple for loop with global variable update does not get transpiled', () => {
  const code = stripIndent`
      let res = [];
      let y = 5;
      for (let i = 0; i < 5; i = i + 1) {
          y = y + 1;
          res[i] = i;
      }
      `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')

  expect(replacedGlobalsLine).toMatchSnapshot()
})

test('simple for loop with function call does not get transpiled', () => {
  const code = stripIndent`
        let res = [];
        let y = () => 1;
        for (let i = 0; i < 5; i = i + 1) {
            y();
            res[i] = i;
        }
        `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')

  expect(replacedGlobalsLine).toMatchSnapshot()
})

test('simple for loop with double update does not get transpiled', () => {
  const code = stripIndent`
        let res = [];
        for (let i = 0; i < 5; i = i + 1) {
            res[i] = i;
            res[i] = i + 1;
        }
        `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')

  expect(replacedGlobalsLine).toMatchSnapshot()
})

test('2 for loops with wrong indice order does not get transpiled', () => {
  const code = stripIndent`
        let res = [];
        for (let i = 0; i < 5; i = i + 1) {
            for (let j = 0; j < 5; j = j + 1) {
                res[j][i] = i + 1;
            }
        }
        `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')

  expect(replacedGlobalsLine).toMatchSnapshot()
})

test('2 for loops with wrong indices order does not get transpiled', () => {
  const code = stripIndent`
        let res = [];
        for (let i = 0; i < 5; i = i + 1) {
            for (let j = 0; j < 5; j = j + 1) {
                res[j] = i + 1;
            }
        }
        `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')

  expect(replacedGlobalsLine).toMatchSnapshot()
})

test('3 for loops with wrong indice order does not get transpiled', () => {
  const code = stripIndent`
        let res = [];
        for (let i = 0; i < 5; i = i + 1) {
            for (let j = 0; j < 5; j = j + 1) {
                for (let k = 0; k < 5; k = k + 1) {
                    res[k][j][i] = i + 1;
                }
            }
        }
        `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')

  expect(replacedGlobalsLine).toMatchSnapshot()
})

test('3 for loops with wrong indice order does not get transpiled', () => {
  const code = stripIndent`
        let res = [];
        for (let i = 0; i < 5; i = i + 1) {
            for (let j = 0; j < 5; j = j + 1) {
                for (let k = 0; k < 5; k = k + 1) {
                    res[j][k] = i + 1;
                }
            }
        }
        `
  const context = mockContext(4, 'gpu')
  const transpiled = transpile(parse(code, context)!, context.contextId, false, context.variant)
    .transpiled

  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')

  expect(replacedGlobalsLine).toMatchSnapshot()
})
