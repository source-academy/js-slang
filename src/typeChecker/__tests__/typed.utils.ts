import { it as baseIt } from 'vitest'
import type { Context } from '../..'
import { Chapter, Variant } from '../../langs'
import { mockContext } from '../../utils/testing/mocks'

/**
 * A version of the `it` function used for testing the typed variants
 */
export const it = baseIt.extend<{ 
  context: Context
  chapter: Chapter
}>({
  chapter: Chapter.SOURCE_1,
  context: ({ chapter }, use) => use(mockContext(chapter, Variant.TYPED))
})