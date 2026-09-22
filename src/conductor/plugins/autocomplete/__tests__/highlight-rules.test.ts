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

  function findKeywordMapperFunctions(chapter: Chapter): string {
    for (const rule of sourceHighlightRules(chapter).start) {
      if (
        'token' in rule &&
        typeof rule.token === 'object' &&
        !Array.isArray(rule.token) &&
        'map' in rule.token
      ) {
        return rule.token.map['support.function'];
      }
    }
    throw new Error('expected a keyword-mapper rule in the start state');
  }

  // Regression coverage for set_timeout/clear_all_timeout (see #2025's Codex review): they're
  // registered as chapter 3+ builtins in createContext.ts, but had no docs/lib entry, so
  // builtinsByMeta's chapter-3 JSON list never picked them up for syntax highlighting either.
  test('set_timeout and clear_all_timeout highlight as builtins from chapter 3 onward', () => {
    expect(findKeywordMapperFunctions(Chapter.SOURCE_2)).not.toContain('set_timeout');
    const ch3 = findKeywordMapperFunctions(Chapter.SOURCE_3);
    expect(ch3).toContain('set_timeout');
    expect(ch3).toContain('clear_all_timeout');
  });

  test('import/export/debugger are keywords from their actual chapter, per syntaxBlacklist', () => {
    const ch1 = findKeywordMapperKeywords(Chapter.SOURCE_1);
    expect(ch1).toContain('import');
    expect(ch1).toContain('debugger');
    expect(ch1).not.toContain('export');
    expect(findKeywordMapperKeywords(Chapter.SOURCE_2)).toContain('export');
  });

  /** Finds the first rule in `start` whose regex matches `sample` as a whole token (anchored at
   * both ends) — lets a test assert "this specific rule recognizes this input" without hand-
   * rolling a full Ace-style tokenizer. */
  function findMatchingStartRule(chapter: Chapter, sample: string) {
    for (const rule of sourceHighlightRules(chapter).start) {
      if (!('regex' in rule)) continue;
      const whole = new RegExp(`^(?:${rule.regex})$`);
      if (whole.test(sample)) return rule;
    }
    return undefined;
  }

  // Regression tests for Codex findings on #2090.
  test('the division operator is tokenized, not left as unstyled text', () => {
    const rule = findMatchingStartRule(Chapter.SOURCE_1, '/');
    expect(rule?.token).toBe('keyword.operator');
  });

  test('a Unicode identifier is tokenized as an identifier-shaped token, not dropped', () => {
    // Before the fix, no `start` rule matched `über` at all (the identifier regex was
    // ASCII-only), so this would find nothing rather than the keyword-mapper rule.
    const rule = findMatchingStartRule(Chapter.SOURCE_1, 'über');
    expect(
      rule && typeof rule.token === 'object' && !Array.isArray(rule.token) && 'map' in rule.token,
    ).toBe(true);
  });

  test('a template literal opens the qtemplate (plain multiline string) state', () => {
    const rule = sourceHighlightRules(Chapter.SOURCE_1).start.find(
      r => 'regex' in r && r.regex === '`',
    );
    expect(rule).toMatchObject({ token: 'string', next: 'qtemplate' });
    // No interpolation handling — Source's own restriction treats a template literal purely as a
    // backtick-delimited multiline string (see NoTemplateExpressionError), so `${` is just two
    // ordinary characters here, not the start of an embedded expression.
    expect(sourceHighlightRules(Chapter.SOURCE_1).qtemplate).toBeDefined();
    expect(Object.keys(sourceHighlightRules(Chapter.SOURCE_1))).not.toContain(
      'qtemplateExpression',
    );
  });

  test('`from` colors as a keyword only directly before a module string, not as a plain identifier', () => {
    const fromKeywordRule = sourceHighlightRules(Chapter.SOURCE_1).start.find(
      (r): r is Extract<typeof r, { regex: string }> =>
        'token' in r && r.token === 'keyword' && 'regex' in r && r.regex.startsWith('from'),
    );
    expect(fromKeywordRule).toBeDefined();
    const re = new RegExp(`^(?:${fromKeywordRule!.regex})`);
    expect(re.test('from "rune"')).toBe(true);
    expect(re.test('from_the_top')).toBe(false);
  });
});
