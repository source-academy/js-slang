import { stripIndent } from 'common-tags'
import { mockContext } from '../mocks/context'
import { parse } from '../parser'
import { transpile } from '../transpiler'

// DO NOT HAVE 'native[<digit>]' AS A SUBSTRING IN CODE STRINGS ANYWHERE IN THIS FILE!
function expectTranspiledToMatchSnapshot(code: string) {
  return () => {
    const context = mockContext(100)
    const transpiled = transpile(parse(code, context)!, context.contextId).transpiled
    // replace native[<number>] as they may be inconsistent
    const replacedNative = transpiled.replace(/native\[\d+]/g, 'native')
    // replace the line hiding globals as they may differ between environments
    const replacedGlobalsLine = replacedNative.replace(/\n\(\(.*\)/, '\n(( <globals redacted> )')
    // replace declaration of builtins since they're repetitive
    const replacedBuiltins = replacedGlobalsLine.replace(
      /\n *const \w+ = native\.builtins\.get\("\w+"\);/g,
      ''
    )
    expect({ code, transpiled: replacedBuiltins }).toMatchSnapshot()
  }
}

/** Some code here have a redundant '1;' as the last statement to prevent the
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

test('Empty code returns empty string', expectTranspiledToMatchSnapshot(''))

test('Single non-declaration statement transforms to eval', expectTranspiledToMatchSnapshot('2;'))

test(
  'Single declaration statement does not transform to eval',
  expectTranspiledToMatchSnapshot('const a = 1;')
)

test(
  'If condition is wrapped to expect boolean',
  expectTranspiledToMatchSnapshot('if(true){}else{}1;')
)

// this does not work now, forgot to add it in, is fixed in later pr
test(
  'While condition is wrapped to expect boolean',
  expectTranspiledToMatchSnapshot('while(true){}1;')
)

// this does not work now, forgot to add it in, is fixed in later pr
test(
  'For condition is wrapped to expect boolean',
  expectTranspiledToMatchSnapshot('for(1;1;1){}1;')
)

test('Function call gets transformed', expectTranspiledToMatchSnapshot('runtime(1);1;'))

test('Non-function call gets transformed', expectTranspiledToMatchSnapshot('1(1);1;'))

test(
  'Non-tailcall block arrow function gets transformed to return {isTail:false...} for PTC',
  expectTranspiledToMatchSnapshot(stripIndent`
    const f = () => {
      return 1;
    };
  `)
)

test(
  'Tailcall block arrow function gets transformed to return {isTail:true...} for PTC',
  expectTranspiledToMatchSnapshot(stripIndent`
    const f = () => {
      return f();
    };
  `)
)

test(
  'Tailcall block arrow function gets transformed to return {isTail:true...} for PTC',
  expectTranspiledToMatchSnapshot(stripIndent`
    const f = () => {
      return f();
    };
  `)
)

test(
  'block arrow function with if gets transformed to return {isTail:...} for every branch for PTC',
  expectTranspiledToMatchSnapshot(stripIndent`
    const f = () => {
      if (true) {
        return true;
      } else {
        return f();
      }
    };
  `)
)

test(
  'block arrow function with && gets transformed to return {isTail:...} for RHS for PTC',
  expectTranspiledToMatchSnapshot(stripIndent`
    const f = () => {
      return true && false;
    };
  `)
)

test(
  'block arrow function with || gets transformed to return {isTail:...} for RHS for PTC',
  expectTranspiledToMatchSnapshot(stripIndent`
    const f = () => {
      return true || false;
    };
  `)
)

test(
  'block arrow function with ?: gets transformed to return {isTail:...} for consequent and alternate for PTC',
  expectTranspiledToMatchSnapshot(stripIndent`
    const f = () => {
      return true ? true : false;
    };
  `)
)

test(
  'function declarations get transformed to constant declaration of block arrow functions',
  expectTranspiledToMatchSnapshot(stripIndent`
    function f() {
      1; 2; 3;
    }
  `)
)

test(
  'Ensure return values are of the form {isTail...} after function declarations are transformed',
  expectTranspiledToMatchSnapshot(stripIndent`
    function f() {
      return null;
    }
  `)
)

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
