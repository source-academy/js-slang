import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import { stripIndent } from '../../utils/formatters'
import { transpile } from '../transpiler'

/*  DO NOT HAVE 'native[<digit>]' AS A SUBSTRING IN CODE STRINGS ANYWHERE IN THIS FILE!
 *  Some code here have a redundant '1;' as the last statement to prevent the
 *  code being tested from being transformed into eval.
 *  Check for variables being stored back by looking at all the tests.
 */
test('builtins do get prepended', async () => {
  const code = '"ensure_builtins";'
  const context = mockContext(Chapter.SOURCE_4)
  const { transpiled } = await transpile(parse(code, context)!, context)
  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')
  expect({ code, transpiled: replacedGlobalsLine }).toMatchSnapshot()
})

test('Ensure no name clashes', async () => {
  const code = stripIndent`
    const boolOrErr = 1;
    boolOrErr[123] = 1;
    function f(callIfFuncAndRightArgs, wrap0, wrap1, wrap2,
      wrap3, wrap4, wrap5, wrap6, wrap7, wrap8, wrap9) {
      let wrap = 2;
      wrap0;wrap1;wrap2;wrap3;wrap4;wrap5;wrap6;wrap7;wrap8;wrap9;
    }
    const native = 123;
  `
  const context = mockContext(Chapter.SOURCE_4)
  const { transpiled } = await transpile(parse(code, context)!, context)
  const replacedNative = transpiled.replace(/native0\[\d+]/g, 'native')
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')
  expect(replacedGlobalsLine).toMatchSnapshot()
})
