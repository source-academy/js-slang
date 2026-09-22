import { parse as acornLooseParse } from 'acorn-loose';
import { describe, expect, test } from 'vitest';

import { ACORN_PARSE_OPTIONS } from '../../../../constants';
import { Chapter } from '../../../../langs';
import { getNames } from '../resolver';

/** Parses `code` with the same tolerant parser the real plugin uses, then asks for completions at
 * the position marked by `|` in `code` (stripped before parsing). */
function complete(code: string, chapter: Chapter = Chapter.SOURCE_2) {
  const cursor = code.indexOf('|');
  if (cursor === -1) throw new Error('code must contain a | marking the cursor position');
  const withoutMarker = code.slice(0, cursor) + code.slice(cursor + 1);

  const lines = withoutMarker.slice(0, cursor).split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length;

  const program = acornLooseParse(withoutMarker, ACORN_PARSE_OPTIONS);
  return getNames(program, withoutMarker, line, column, chapter);
}

describe('getNames', () => {
  test('suggests a top-level const declaration', () => {
    const entries = complete('const accountBalance = 0;\nacc|');
    expect(entries.map(e => e.name)).toContain('accountBalance');
  });

  test('suggests a top-level function declaration', () => {
    const entries = complete('function accumulate_all(xs) { return xs; }\nacc|');
    expect(entries.map(e => e.name)).toContain('accumulate_all');
  });

  test('suggests a function parameter from inside the function body', () => {
    const entries = complete('function f(amount) {\n  return am|;\n}');
    expect(entries.map(e => e.name)).toContain('amount');
  });

  test('an outer declaration is visible from inside a nested block', () => {
    const entries = complete('const outerValue = 1;\nfunction f() {\n  return oute|;\n}');
    expect(entries.map(e => e.name)).toContain('outerValue');
  });

  test('an inner declaration is not visible from an outer scope', () => {
    const entries = complete(
      'function f() {\n  const innerOnly = 1;\n  return innerOnly;\n}\ninn|',
    );
    expect(entries.map(e => e.name)).not.toContain('innerOnly');
  });

  test('a declaration in a sibling function is not visible', () => {
    const entries = complete(
      'function f() {\n  const siblingOnly = 1;\n  return siblingOnly;\n}\nfunction g() {\n  return sibl|;\n}',
    );
    expect(entries.map(e => e.name)).not.toContain('siblingOnly');
  });

  test('an inner scope is suggested ahead of an outer one with the same prefix', () => {
    const entries = complete(
      'const accOuter = 1;\nfunction f() {\n  const accInner = 2;\n  return acc|;\n}',
    );
    const names = entries.map(e => e.name);
    expect(names.indexOf('accInner')).toBeLessThan(names.indexOf('accOuter'));
  });

  test('matches builtins by subsequence, not just prefix', () => {
    const entries = complete('acc|', Chapter.SOURCE_2);
    expect(entries.map(e => e.name)).toContain('accumulate');
  });

  test('a chapter 3+ builtin is not suggested below chapter 3', () => {
    const entries = complete('strea|', Chapter.SOURCE_2);
    expect(entries.map(e => e.name)).not.toContain('stream');
  });

  test('a chapter 3+ builtin is suggested at chapter 3', () => {
    const entries = complete('strea|', Chapter.SOURCE_3);
    expect(entries.map(e => e.name)).toContain('stream');
  });

  // Regression coverage for set_timeout/clear_all_timeout (see #2025's Codex review): they're
  // registered as chapter 3+ builtins in createContext.ts, but had no docs/lib entry, so
  // getBuiltins's chapter-3 JSON list never picked them up.
  test('set_timeout and clear_all_timeout are suggested at chapter 3', () => {
    expect(complete('set_tim|', Chapter.SOURCE_3).map(e => e.name)).toContain('set_timeout');
    expect(complete('clear_all_tim|', Chapter.SOURCE_3).map(e => e.name)).toContain(
      'clear_all_timeout',
    );
  });

  test('a chapter-gated keyword is only suggested from its chapter onward', () => {
    expect(complete('whil|', Chapter.SOURCE_2).map(e => e.name)).not.toContain('while');
    expect(complete('whil|', Chapter.SOURCE_3).map(e => e.name)).toContain('while');
  });

  test('nothing is suggested with no identifier prefix at the cursor', () => {
    expect(complete('const x = 1;\n|')).toEqual([]);
  });

  test('tolerates invalid, mid-edit syntax', () => {
    // A dangling comma / incomplete call - acorn itself would throw on this.
    const entries = complete('const accountBalance = 0;\ndisplay(acc|,');
    expect(entries.map(e => e.name)).toContain('accountBalance');
  });

  // Regression tests for Codex findings on #2090.
  describe('modules', () => {
    test('an aliased named import is a suggestible local binding', () => {
      const entries = complete('import { foo as bar } from "rune";\nba|');
      expect(entries.map(e => e.name)).toContain('bar');
    });

    test('a bare named import is a suggestible local binding', () => {
      const entries = complete('import { show } from "rune";\nsho|');
      expect(entries.map(e => e.name)).toContain('show');
    });

    test('an export const introduces its binding, same as a plain const', () => {
      const entries = complete('export const alpha = 1;\nalp|');
      expect(entries.map(e => e.name)).toContain('alpha');
    });

    test('an export function introduces its binding, same as a plain function', () => {
      const entries = complete('export function alphaFn() {}\nalp|');
      expect(entries.map(e => e.name)).toContain('alphaFn');
    });

    test('a bare re-export (no declaration) introduces no new binding', () => {
      const entries = complete('const alpha = 1;\nexport { alpha };\nalp|');
      // Just confirms this doesn't crash and still finds the *real* declaration once, not that
      // re-exporting is somehow invisible.
      expect(entries.filter(e => e.name === 'alpha')).toHaveLength(1);
    });
  });

  test('a Unicode identifier prefix is matched, not silently dropped', () => {
    const entries = complete('const über = 1;\nüb|');
    expect(entries.map(e => e.name)).toContain('über');
  });
});
