import { parseError } from '../../../..'
import { mockContext } from '../../../../mocks/context'
import { Chapter, Variant } from '../../../../types'
import { parse } from '../../../parser'
import type { Rule } from '../../../types'
import rules from '..'
import { DisallowedConstructError } from '../../../errors'

const chaptersToTest = [
  Chapter.SOURCE_1,
  Chapter.SOURCE_2,
  Chapter.SOURCE_3,
  Chapter.SOURCE_4,
  Chapter.LIBRARY_PARSER
]

function testSingleChapter(
  code: string,
  expected: string | undefined,
  chapter: Chapter,
  variant: Variant = Variant.DEFAULT
) {
  const context = mockContext(chapter, variant)
  parse(code, context)

  // Parser also produces errors for syntax blacklist
  // We're not interested in those errors here
  const errors = context.errors.filter(err => !(err instanceof DisallowedConstructError))
  if (expected === undefined) {
    if (errors.length > 0) {
      console.error(parseError(errors))
    }

    expect(errors.length).toEqual(0)
  } else {
    expect(errors.length).toBeGreaterThanOrEqual(1)
    const parsedErrors = parseError(errors)
    expect(parsedErrors).toEqual(expect.stringContaining(expected))
  }
}

function testMultipleChapters(code: string, expected: string | undefined, rule: Rule<any>) {
  const chapterCases = chaptersToTest.map(chapter => {
    const isExpectedToError =
      expected !== undefined &&
      (rule.disableFromChapter === undefined || chapter < rule.disableFromChapter)
    const errStr = isExpectedToError ? 'error' : 'no error'

    return [
      `Chapter ${chapter}: ${errStr}`,
      code,
      isExpectedToError ? expected : undefined,
      chapter
    ] as [string, string, string | undefined, Chapter]
  })

  test.each(chapterCases)('%s', (_, code, expected, chapter) => {
    testSingleChapter(code, expected, chapter)
  })
}

describe('General rule tests', () => {
  rules.forEach(rule => {
    if (!rule.testSnippets) {
      console.warn(`${rule.name} has no tests`)
      return
    }

    const disableStr = rule.disableFromChapter
      ? `(Disabled for Chapter ${rule.disableFromChapter} and above)`
      : '(Always enabled)'
    describe(`Testing ${rule.name} ${disableStr}`, () => {
      if (rule.testSnippets!.length === 1) {
        const [[code, expected]] = rule.testSnippets!
        testMultipleChapters(code, expected, rule)
      } else {
        rule.testSnippets!.forEach((snippet, i) =>
          describe(`Testing Snippet ${i + 1}`, () => testMultipleChapters(...snippet, rule))
        )
      }
    })
  })
})

test('no-unspecified-operator', () => {
  // Test specifically the typeof operator
  const sourceChapters = [Chapter.SOURCE_1, Chapter.SOURCE_2, Chapter.SOURCE_3, Chapter.SOURCE_4]

  // To make sure that typeof is allowed for typed variant
  // but not for the default variant
  sourceChapters.forEach(chapter => {
    testSingleChapter('typeof 0;', "Line 1: Operator 'typeof' is not allowed.", chapter)
    testSingleChapter('typeof 0;', undefined, chapter, Variant.TYPED)
  })
})
