import { mockContext } from '../../mocks/context'
import { parse } from '../../parser/parser'
import { Chapter } from '../../types'
import * as ast from '../../utils/ast/astCreator'
import { sanitizeAST } from '../../utils/ast/sanitizer'
import { stripIndent } from '../../utils/formatters'
import { transformImportDeclarations, transpile } from '../transpiler'

/*  DO NOT HAVE 'native[<digit>]' AS A SUBSTRING IN CODE STRINGS ANYWHERE IN THIS FILE!
 *  Some code here have a redundant '1;' as the last statement to prevent the
 *  code being tested from being transformed into eval.
 *  Check for variables being stored back by looking at all the tests.
 */
test('builtins do get prepended', () => {
  const code = '"ensure_builtins";'
  const context = mockContext(Chapter.SOURCE_4)
  const { transpiled } = transpile(parse(code, context)!, context)
  // replace native[<number>] as they may be inconsistent
  const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
  // replace the line hiding globals as they may differ between environments
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')
  expect({ code, transpiled: replacedGlobalsLine }).toMatchSnapshot()
})

test('Ensure no name clashes', () => {
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
  const { transpiled } = transpile(parse(code, context)!, context)
  const replacedNative = transpiled.replace(/native0\[\d+]/g, 'native')
  const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')
  expect(replacedGlobalsLine).toMatchSnapshot()
})

describe('test transformImportDeclarations', () => {
  type TestCase = [actualCode: string, expectedCode: string]

  const testCases: TestCase[] = [
    ['import { hi } from "rune";', 'const hi = modules.rune.hi;'],
    ['import { a, b } from "rune";', 'const a = modules.rune.a;\nconst b = modules.rune.b;'],
    ['import a from "rune";', 'const a = modules.rune.default;'],
    ['import a, { b } from "rune";', 'const a = modules.rune.default;\nconst b = modules.rune.b;'],
    ['import * as a from "rune";', 'const a = modules.rune;'],
    [
      'import { a as x, b as y } from "rune";',
      'const x = modules.rune.a;\nconst y = modules.rune.b;'
    ]
  ]

  test.each(testCases)('', (actual, expected) => {
    const expectedContext = mockContext(Chapter.LIBRARY_PARSER)
    const expectedProgram = parse(expected, expectedContext)
    if (!expectedProgram || expectedContext.errors.length > 0) {
      throw new Error('Expected program should not have parse errors')
    }

    const actualContext = mockContext(Chapter.LIBRARY_PARSER)
    const actualProgram = parse(actual, actualContext)

    if (!actualProgram || actualContext.errors.length > 0) {
      throw new Error('Expected program should not have parse errors')
    }

    const [declNodes, otherNodes] = transformImportDeclarations(
      actualProgram,
      ast.identifier('modules')
    )
    expect(otherNodes.length).toEqual(0)

    const finalProgram = ast.program(declNodes)
    expect(sanitizeAST(finalProgram)).toMatchObject(sanitizeAST(expectedProgram))
  })
})
