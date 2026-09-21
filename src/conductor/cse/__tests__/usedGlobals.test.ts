import { describe, expect, test } from 'vitest';

import createContext from '../../../createContext';
import { evaluate as cseEvaluate } from '../../../cse-machine/interpreter';
import { Chapter, Variant } from '../../../langs';
import { parse } from '../../../parser/parser';
import type { Context } from '../../../types';
import { collectUsedGlobalNames } from '../usedGlobals';

function analyse(code: string, chapter: Chapter = Chapter.SOURCE_3) {
  const context: Context = createContext(chapter, Variant.DEFAULT);
  // The prelude defines map/filter/accumulate in Source, so it has to run before those names
  // exist at all — exactly as SourceCseEvaluator does before its first chunk.
  if (context.prelude !== null) {
    const preludeProgram = parse(context.prelude, context)!;
    context.prelude = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cseEvaluate(preludeProgram, context, { isPrelude: true, envSteps: -1, stepLimit: 1e9 } as any);
  }
  const program = parse(code, context)!;
  expect(program).not.toBeNull();
  const globalEnv = context.runtime.environments.find(env => env.tail === null)!;
  const preludeEnv = context.runtime.environments.find(env => env.name === 'prelude');
  return {
    used: collectUsedGlobalNames(program, globalEnv.head, preludeEnv?.head),
    available: new Set(Object.keys(globalEnv.head)),
  };
}

describe('collectUsedGlobalNames', () => {
  test('keeps a builtin the program calls', () => {
    const { used } = analyse('display(1);');
    expect(used.has('display')).toBe(true);
  });

  test('drops the ones it does not', () => {
    const { used, available } = analyse('display(1);');
    expect(available.size).toBeGreaterThan(20);
    expect(used.has('math_abs')).toBe(false);
    expect(used.has('parse_int')).toBe(false);
    // The whole point: a small program should not carry the standard library.
    expect(used.size).toBeLessThan(available.size / 2);
  });

  test('a program using nothing global keeps nothing', () => {
    const { used } = analyse('const x = 1 + 2;\nx;');
    expect(used.size).toBe(0);
  });

  test('keeps every name a program that uses many of them needs', () => {
    const { used } = analyse('display(math_abs(-1));\nstringify(is_number(2));');
    for (const name of ['display', 'math_abs', 'stringify', 'is_number']) {
      expect(used.has(name), `${name} should be kept`).toBe(true);
    }
  });

  test('follows a prelude function into the builtins its body uses', () => {
    // A program calling `map` never mentions `is_null`, but `map`'s body does — and the student
    // watches it being applied, so the frame must not be missing it.
    const { used } = analyse('map(x => x + 1, list(1, 2));');
    expect(used.has('map')).toBe(true);
    expect(used.size).toBeGreaterThan(1);
  });

  test('over-approximates rather than hiding: a shadowing local keeps the builtin', () => {
    // Scopes are deliberately not tracked. Showing one binding too many is cosmetic; hiding one
    // the student is using would be a wrong picture.
    const { used } = analyse('function f(display) {\n  return display;\n}\nf(1);');
    expect(used.has('display')).toBe(true);
  });
});
