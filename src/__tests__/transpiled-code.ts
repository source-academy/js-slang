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
      wrap0;wrap1;wrap2;wrap3;wrap4;wrap5;wrap6;wrap7;wrap8;wrap9;
    }
    native;
  `
  const context = mockContext(4)
  const transpiled = transpile(parse(code, context)!, context.contextId).transpiled
  const replacedNative = transpiled.replace(/native0\[\d+]/g, 'native')
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')
  expect(replacedGlobalsLine).toMatchSnapshot()
})
