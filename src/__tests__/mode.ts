import * as ace from 'ace-builds'
import { Mode as DefaultMode } from 'ace-builds/src-noconflict/mode-javascript'

import { HighlightRulesSelector, ModeSelector } from '../editors/ace/modes/source'
import { Chapter, Variant  } from '../langs'

// suppress all console warning
console.warn = () => {
  return null
}

// default chapter variant and external library
const defaultVariant: Variant = Variant.DEFAULT
const defaultExternal: string = 'NONE'

// define session
const session = ace.createEditSession('', new DefaultMode())

// tested token types
const CATEGORY = {
  functions: /\bsupport.function\b/,
  types: /\bstorage.type\b/,
  forbidden: /\bvariable.language\b/,
  keywords: /\bkeyword\b/,
  consts: /\bbuiltinconsts\b/,
  number: /\bconstant.numeric\b/,
  bool: /\bconstant.language.boolean\b/
}

const setSession = (chapter: Chapter, variant: Variant, external: string, code: string): void => {
  // load the library
  HighlightRulesSelector(chapter, variant, external)
  ModeSelector(chapter, variant, external)

  // set mode and value
  session.setMode('ace/mode/source' + chapter.toString() + variant + external)
  session.setValue(code)
}

const expectedBool = (token: ace.Ace.Token | null, type: RegExp): boolean => {
  return token !== null && type.test(token.type)
}

test('function token type error', () => {
  const code = `const p = pair(3, 4); \nset_tail(p, 3);`

  setSession(Chapter.SOURCE_2, defaultVariant, defaultExternal, code)
  const token1 = session.getTokenAt(0, 11)
  const token2 = session.getTokenAt(1, 3)

  // at source 2, pair is function but set_tail is not
  expect(expectedBool(token1, CATEGORY.functions)).toBe(true)
  expect(expectedBool(token2, CATEGORY.functions)).toBe(false)

  // at source 4, set_tail is function as well
  setSession(Chapter.SOURCE_4, defaultVariant, defaultExternal, code)
  const newToken1 = session.getTokenAt(0, 11)
  const newToken2 = session.getTokenAt(1, 3)
  expect(expectedBool(newToken1, CATEGORY.functions)).toBe(true)
  expect(expectedBool(newToken2, CATEGORY.functions)).toBe(true)
})

test('constants are not correctly loaded', () => {
  const code = `true; \n5; \nmath_LOG2E;`

  setSession(Chapter.SOURCE_1, defaultVariant, defaultExternal, code)

  const token1 = session.getTokenAt(0, 1)
  expect(expectedBool(token1, CATEGORY.bool)).toBe(true)

  const token2 = session.getTokenAt(1, 1)
  expect(expectedBool(token2, CATEGORY.number)).toBe(true)

  const token3 = session.getTokenAt(2, 1)
  expect(expectedBool(token3, CATEGORY.consts)).toBe(true)
})

test('operator syntax type error', () => {
  const code = 'const num = 3; \nnum++; \nnum--; \nnum += 1; \n5 + num |2;'

  setSession(Chapter.SOURCE_1, defaultVariant, defaultExternal, code)

  const token1 = session.getTokenAt(1, 4)
  expect(expectedBool(token1, CATEGORY.forbidden)).toBe(true)

  const token2 = session.getTokenAt(2, 4)
  expect(expectedBool(token2, CATEGORY.forbidden)).toBe(true)

  const token3 = session.getTokenAt(3, 5)
  expect(expectedBool(token3, CATEGORY.forbidden)).toBe(true)

  const token4 = session.getTokenAt(4, 1)
  expect(expectedBool(token4, CATEGORY.number)).toBe(true)

  const token5 = session.getTokenAt(4, 9)
  expect(expectedBool(token5, CATEGORY.forbidden)).toBe(true)

  const token6 = session.getTokenAt(4, 10)
  expect(expectedBool(token6, CATEGORY.number)).toBe(true)
})

test('forbidden keywords', () => {
  const code = 'let x = 3; \nwhile (x > 0) { x = x - 1; }'

  // not allowed in source 1
  setSession(Chapter.SOURCE_1, defaultVariant, defaultExternal, code)

  const token1 = session.getTokenAt(0, 1)
  expect(expectedBool(token1, CATEGORY.forbidden)).toBe(true)

  const token2 = session.getTokenAt(1, 1)
  expect(expectedBool(token2, CATEGORY.forbidden)).toBe(true)

  // allowed in source 4
  setSession(Chapter.SOURCE_4, defaultVariant, defaultExternal, code)
  const newToken1 = session.getTokenAt(0, 1)
  expect(expectedBool(newToken1, CATEGORY.types)).toBe(true)

  const newToken2 = session.getTokenAt(1, 1)
  expect(expectedBool(newToken2, CATEGORY.keywords)).toBe(true)
})

test('forbidden JavaScript reserved words', () => {
  const code = `private \npackage \nthis`

  setSession(Chapter.SOURCE_4, defaultVariant, defaultExternal, code)

  const token1 = session.getTokenAt(0, 1)
  expect(expectedBool(token1, CATEGORY.forbidden)).toBe(true)

  const token2 = session.getTokenAt(1, 1)
  expect(expectedBool(token2, CATEGORY.forbidden)).toBe(true)

  const token3 = session.getTokenAt(2, 1)
  expect(expectedBool(token3, CATEGORY.forbidden)).toBe(true)
})
