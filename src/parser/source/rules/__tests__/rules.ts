import { parseError } from "../../../.."
import { mockContext } from "../../../../mocks/context"
import { Chapter } from "../../../../types"
import { parse } from "../../../parser"
import type { Rule } from "../../../types"
import rules from '..'

const chaptersToTest = [
  Chapter.SOURCE_1,
  Chapter.SOURCE_2,
  Chapter.SOURCE_3,
  Chapter.SOURCE_4,
  Chapter.LIBRARY_PARSER,
]

function testSnippet(code: string, expected: string, rule: Rule<any>) {
  const chapterCases = chaptersToTest.map(chapter => {
    const isExpectedToError = rule.disableFromChapter === undefined || chapter < rule.disableFromChapter
    const errStr = isExpectedToError ? 'error' : 'no error'

    return [
      `Chapter ${chapter}: ${errStr}`,
      code,
      isExpectedToError ? expected : undefined,
      chapter
    ] as [string, string, string, Chapter]
  })

  test.each(chapterCases)("%s", (_, code, expected, chapter) => {
    const context = mockContext(chapter)
    parse(code, context)

    if (expected === undefined) {
      expect(context.errors.length).toEqual(0)
    } else {
      expect(context.errors.length).toBeGreaterThanOrEqual(1)
      const parsedErrors = parseError(context.errors)
      expect(parsedErrors).toEqual(expect.stringContaining(expected))
    }
  })
}

describe('Test rules', () => {
  rules.forEach(rule => {
      if (!rule.testSnippets) return

      const disableStr = rule.disableFromChapter ? `(Disabled for Chapter ${rule.disableFromChapter} and above)` : '(Always enabled)'
      describe(`Testing ${rule.name} ${disableStr}`, () => {
        if (rule.testSnippets!.length === 1) { 
          const [[code, expected]] = rule.testSnippets!
          testSnippet(code, expected, rule)
        } else {
          rule.testSnippets!.forEach((snippet, i) => describe(`Testing Snippet ${i+1}`, () => testSnippet(...snippet, rule)))
        }
      })
    })
})