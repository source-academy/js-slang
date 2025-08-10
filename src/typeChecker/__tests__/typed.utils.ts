import { it as baseIt } from 'vitest';
import type { Context } from '../..';
import { Chapter, Variant } from '../../types';
import { mockContext } from '../../utils/testing/mocks';

export const it = baseIt.extend<{ 
  context: Context
  chapter: Chapter
}>({
  chapter: Chapter.SOURCE_1,
  context: ({ chapter }, use) => use(mockContext(chapter, Variant.TYPED))
})