import { describe, expect, test } from 'vitest';

import { Chapter } from '../../../../langs';
import sourceHighlightRules from '../highlight-rules';

/** Every regex string in the produced rules must actually compile — a malformed pattern here
 * would only surface, cryptically, once the host tries to build its Ace mode from this data. */
function assertAllRegexesCompile(chapter: Chapter) {
  const rules = sourceHighlightRules(chapter);
  for (const [state, stateRules] of Object.entries(rules)) {
    for (const rule of stateRules) {
      if (!('regex' in rule)) continue;
      expect(() => new RegExp(rule.regex), `${state}: ${rule.regex}`).not.toThrow();
    }
  }
}

describe('sourceHighlightRules', () => {
  test.each([Chapter.SOURCE_1, Chapter.SOURCE_2, Chapter.SOURCE_3, Chapter.SOURCE_4])(
    'every regex compiles at chapter %i',
    chapter => {
      assertAllRegexesCompile(chapter);
    },
  );

  test('every state referenced by `next` actually exists', () => {
    for (const chapter of [
      Chapter.SOURCE_1,
      Chapter.SOURCE_2,
      Chapter.SOURCE_3,
      Chapter.SOURCE_4,
    ]) {
      const rules = sourceHighlightRules(chapter);
      for (const stateRules of Object.values(rules)) {
        for (const rule of stateRules) {
          if ('next' in rule && rule.next) {
            expect(rules).toHaveProperty(rule.next);
          }
        }
      }
    }
  });

  function findKeywordMapperKeywords(chapter: Chapter): string {
    for (const rule of sourceHighlightRules(chapter).start) {
      // Arrays are also `typeof === 'object'` and inherit `.map` from Array.prototype (a couple
      // of rules above have an array `token`, for multi-group regexes) - Array.isArray rules
      // those out, leaving only the genuine KeywordMapperArgs `{map, defaultToken}` shape.
      if (
        'token' in rule &&
        typeof rule.token === 'object' &&
        !Array.isArray(rule.token) &&
        'map' in rule.token
      ) {
        return rule.token.map.keyword;
      }
    }
    throw new Error('expected a keyword-mapper rule in the start state');
  }

  test('the keyword mapper is chapter-gated', () => {
    expect(findKeywordMapperKeywords(Chapter.SOURCE_3)).toContain('while');
    expect(findKeywordMapperKeywords(Chapter.SOURCE_1)).not.toContain('while');
  });
});
