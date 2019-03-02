import { stripIndent } from 'common-tags'
import { mockContext } from '../mocks/context'
import { parse } from '../parser'
import { transpile } from '../transpiler'

/*  DO NOT HAVE 'native[<digit>]' AS A SUBSTRING IN CODE STRINGS ANYWHERE IN THIS FILE!
 *  Some code here have a redundant '1;' as the last statement to prevent the
 *  code being tested from being transformed into eval.
 *  Check for variables being stored back by looking at all the tests.
 */
test('builtins do get prepended', () => {
  const code = 'ensure_builtins;'
  const context = mockContext(4)
  const transpiled = transpile(parse(code, context)!, context.contextId).transpiled
  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')
  expect({ code, transpiled: replacedGlobalsLine }).toMatchSnapshot()
})

test('Ensure no name clashes', () => {
  const code = stripIndent`
    boolOrErr[123] = 1;
    function f(callIfFuncAndRightArgs) {
      let wrap = 2;
    }
    native;
  `
  const context = mockContext(4)
  const transpiled = transpile(parse(code, context)!, context.contextId).transpiled
  expect(transpiled.match(/const boolOrErr[A-Z0-9_$] = /)).not.toBe(null)
  expect(transpiled.match(/const wrap[A-Z0-9_$] = /)).not.toBe(null)
  expect(transpiled.match(/const callIfFuncAndRightArgs[A-Z0-9_$] = /)).not.toBe(null)
  expect(transpiled.match(/const native[A-Z0-9_$] = /)).not.toBe(null)
})
