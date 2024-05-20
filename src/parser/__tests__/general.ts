import { parseError } from '../..'
import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { MissingSemicolonError } from '../errors'
import { parse } from '../parser'

describe('Make sure all JavaScript chapters throw errors for missing semicolons', () => {
  test.each([Chapter.SOURCE_1, Chapter.SOURCE_2, Chapter.SOURCE_3, Chapter.SOURCE_4])(
    '%s',
    chapter => {
      const context = mockContext(chapter)
      const result = parse('42', context)

      expect(result).toBeNull()
      expect(context.errors[0]).toBeInstanceOf(MissingSemicolonError)
      expect(parseError(context.errors)).toEqual(
        'Line 1: Missing semicolon at the end of statement'
      )
    }
  )
})

test('parseError for template literals with expressions', () => {
  const context = mockContext(Chapter.SOURCE_1)
  const result = parse('`${1}`;', context)

  expect(result).toBeNull()
  expect(parseError(context.errors)).toEqual(
    'Line 1: Expressions are not allowed in template literals (`multiline strings`)'
  )
})
