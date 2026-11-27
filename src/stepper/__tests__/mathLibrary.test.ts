import { afterEach, describe, expect, test } from 'vitest';

import { MATH_LIBRARY_NAMES } from '../../stdlib/mathLibrary';
import { isBuiltinFunction } from '../builtins';

describe('the stepper knows the Math library of Source, not the engine’s', () => {
  afterEach(() => {
    delete (Math as unknown as Record<string, unknown>).aMemberThatAFutureEngineAdds;
  });

  test('every member of the list is a builtin', () => {
    for (const name of MATH_LIBRARY_NAMES) {
      expect(isBuiltinFunction(`math_${name}`)).toBe(true);
    }
  });

  test('a member that an engine adds to Math is not a builtin', () => {
    // As V8 13 did with Math.f16round: the standard evaluator has no such name.
    Object.defineProperty(Math, 'aMemberThatAFutureEngineAdds', {
      value: (a: number) => a,
      configurable: true,
      writable: true,
    });

    expect(isBuiltinFunction('math_aMemberThatAFutureEngineAdds')).toBe(false);
    expect(isBuiltinFunction('math_f16round')).toBe(false);
  });
});
