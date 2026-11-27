import { afterEach, describe, expect, test } from 'vitest';

import { Chapter } from '../../langs';
import { mockContext } from '../../utils/testing/mocks';
import { MATH_LIBRARY_NAMES } from '../mathLibrary';

/** The names of the `math_` builtins that Source has in a fresh context. */
function mathBuiltinsOf(chapter: Chapter): string[] {
  const context = mockContext(chapter);
  const globals = context.runtime.environments[context.runtime.environments.length - 1].head;
  return Object.keys(globals)
    .filter(name => name.startsWith('math_'))
    .map(name => name.slice('math_'.length));
}

describe('the Math library of Source', () => {
  afterEach(() => {
    delete (Math as unknown as Record<string, unknown>).aMemberThatAFutureEngineAdds;
  });

  test('is the ECMAScript 2015 Math: 8 constants and 35 functions', () => {
    expect(MATH_LIBRARY_NAMES).toHaveLength(43);
    expect(new Set(MATH_LIBRARY_NAMES).size).toBe(43);
    expect(MATH_LIBRARY_NAMES.filter(name => typeof Math[name] !== 'function')).toEqual([
      'E',
      'LN10',
      'LN2',
      'LOG10E',
      'LOG2E',
      'PI',
      'SQRT1_2',
      'SQRT2',
    ]);
  });

  test('is what the list says, in a context of every Source chapter', () => {
    for (const chapter of [
      Chapter.SOURCE_1,
      Chapter.SOURCE_2,
      Chapter.SOURCE_3,
      Chapter.SOURCE_4,
    ]) {
      expect(mathBuiltinsOf(chapter)).toEqual([...MATH_LIBRARY_NAMES]);
    }
  });

  test('does not depend on the engine: a member that an engine adds to Math is not a builtin', () => {
    // As V8 13 did with Math.f16round: a member that the language does not have.
    Object.defineProperty(Math, 'aMemberThatAFutureEngineAdds', {
      value: (a: number) => a,
      configurable: true,
      writable: true,
    });
    expect(Object.getOwnPropertyNames(Math)).toContain('aMemberThatAFutureEngineAdds');

    const names = mathBuiltinsOf(Chapter.SOURCE_4);

    expect(names).not.toContain('aMemberThatAFutureEngineAdds');
    expect(names).toEqual([...MATH_LIBRARY_NAMES]);
  });
});
