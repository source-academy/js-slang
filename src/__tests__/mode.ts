import * as ace from 'ace-builds'
import DefaultMode from 'ace-builds/src-noconflict/mode-javascript'
import { HighlightRulesSelector, ModeSelector } from '../editors/ace/modes/source'

// suppress all console warning
console.warn = () => {
  return null
}

// load all source chapter libraries
HighlightRulesSelector(1)
ModeSelector(1)
HighlightRulesSelector(2)
ModeSelector(2)
HighlightRulesSelector(3)
ModeSelector(3)
HighlightRulesSelector(4)
ModeSelector(4)

// define session
const session = ace.createEditSession('', DefaultMode)

// tested token types
const CATEGORY = {
  functions: /\bsupport.function\b/,
  types: /\bstorage.type\b/,
  forbidden: /\bvariable.language\b/,
  keywords: /\bkeyword\b/
}

const setSession = (chapter: number, code: string): void => {
  session.setMode('ace/mode/source' + chapter.toString())
  session.setValue(code)
}

const expectedBool = (
  token: ace.Ace.Token | null,
  type: { test: (arg0: string) => any }
): boolean => {
  return token !== null && type.test(token.type)
}

test('function token type error', () => {
  const code = `const p = pair(3, 4); \nset_tail(p, 3);`

  setSession(2, code)
  const token1 = session.getTokenAt(0, 11)
  const token2 = session.getTokenAt(1, 3)

  // at source 2, pair is function but set_tail is not
  expect(expectedBool(token1, CATEGORY.functions)).toBe(true)
  expect(expectedBool(token2, CATEGORY.functions)).toBe(false)

  // at source 4, set_tail is function as well
  setSession(4, code)
  const newToken1 = session.getTokenAt(0, 11)
  const newToken2 = session.getTokenAt(1, 3)
  expect(expectedBool(newToken1, CATEGORY.functions)).toBe(true)
  expect(expectedBool(newToken2, CATEGORY.functions)).toBe(true)
})

test('operator syntax type error', () => {
  const code = 'const num = 3; \nnum++; \nnum--; \nnum += 1;'

  setSession(1, code)

  const token1 = session.getTokenAt(1, 4)
  expect(expectedBool(token1, CATEGORY.forbidden)).toBe(true)

  const token2 = session.getTokenAt(2, 4)
  expect(expectedBool(token2, CATEGORY.forbidden)).toBe(true)

  const token3 = session.getTokenAt(3, 5)
  expect(expectedBool(token3, CATEGORY.forbidden)).toBe(true)
})

test('forbidden keywords', () => {
  const code = 'let x = 3; \nwhile (x > 0) { x = x - 1; }'

  // not allowed in source 1
  setSession(1, code)

  const token1 = session.getTokenAt(0, 1)
  expect(expectedBool(token1, CATEGORY.forbidden)).toBe(true)

  const token2 = session.getTokenAt(1, 1)
  expect(expectedBool(token2, CATEGORY.forbidden)).toBe(true)

  // allowed in source 4
  setSession(4, code)
  const newToken1 = session.getTokenAt(0, 1)
  expect(expectedBool(newToken1, CATEGORY.types)).toBe(true)

  const newToken2 = session.getTokenAt(1, 1)
  expect(expectedBool(newToken2, CATEGORY.keywords)).toBe(true)
})

test('forbidden JavaScript reserved words', () => {
  const code = `private \nArray \nthis`

  setSession(4, code)

  const token1 = session.getTokenAt(0, 1)
  expect(expectedBool(token1, CATEGORY.forbidden)).toBe(true)

  const token2 = session.getTokenAt(1, 1)
  expect(expectedBool(token2, CATEGORY.forbidden)).toBe(true)

  const token3 = session.getTokenAt(2, 1)
  expect(expectedBool(token3, CATEGORY.forbidden)).toBe(true)
})
