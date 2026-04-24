import { describe, test } from 'vitest';
import { Chapter } from '../../langs';
import { stripIndent } from '../../utils/formatters';
import { expectFinishedResult, expectParsedError } from '../../utils/testing';

describe('parse_int', () => {
  test('parse_int with valid args is ok, radix 2', () => {
    return expectFinishedResult(`parse_int('1100101010101', 2);`, Chapter.SOURCE_1).toBe(
      parseInt('1100101010101', 2),
    );
  });

  test('parse_int with valid args is ok, radix 36', () => {
    return expectFinishedResult(`parse_int('uu1', 36);`, Chapter.SOURCE_1).toBe(
      parseInt('uu1', 36),
    );
  });

  test('parse_int with valid args is ok, but invalid str for radix', () => {
    return expectFinishedResult(`parse_int('uu1', 2);`, Chapter.SOURCE_1).toBe(parseInt('uu1', 2));
  });

  test('parse_int with non-string arg str throws error', () => {
    return expectParsedError(`parse_int(42, 2);`).toEqual(
      'Line 1: parse_int: Expected string for str, got 42.',
    );
  });

  test('parse_int with non-integer arg radix throws error', () => {
    return expectParsedError(`parse_int('42', 2.1);`).toEqual(
      'Line 1: parse_int: Expected integer between 2 and 36 for radix, got 2.1.',
    );
  });

  test('parse_int with radix outside [2, 36] throws error, radix=1', () => {
    return expectParsedError(`parse_int('10', 1);`).toEqual(
      'Line 1: parse_int: Expected integer between 2 and 36 for radix, got 1.',
    );
  });

  test('parse_int with radix outside [2, 36] throws error, radix=37', () => {
    return expectParsedError(`parse_int('10', 37);`).toEqual(
      'Line 1: parse_int: Expected integer between 2 and 36 for radix, got 37.',
    );
  });

  test('parse_int with string arg radix throws error', () => {
    return expectParsedError(`parse_int('42', '2'); `).toEqual(
      'Line 1: parse_int: Expected integer between 2 and 36 for radix, got "2".',
    );
  });
});

describe('char_at', () => {
  test('char_at with non string first argument errors', () => {
    return expectParsedError(`char_at(42, 123);`).toEqual(
      'Line 1: char_at: Expected string for str, got 42.',
    );
  });

  test('char_at with non nonnegative integer second argument errors', () => {
    return expectParsedError(`char_at('', -1);`).toEqual(
      'Line 1: char_at: Expected integer greater than 0 for index, got -1.',
    );
  });

  test('char_at with string for second argument errors', () => {
    return expectParsedError(`char_at('', "");`).toEqual(
      'Line 1: char_at: Expected integer greater than 0 for index, got "".',
    );
  });

  test('char_at with valid args is ok', () => {
    return expectFinishedResult(`char_at("123", 0);`).toBe('1');
  });

  test('char_at with valid args (but index out of bounds) returns undefined', () => {
    return expectFinishedResult(
      stripIndent`
      char_at("123", 3);
    `,
    ).toBe(undefined);
  });
});

describe('arity', () => {
  test('arity with nullary function is ok', () => {
    return expectFinishedResult(`arity(math_random);`, Chapter.SOURCE_1).toBe(0);
  });

  test('arity with function with parameters is ok', () => {
    return expectFinishedResult(`arity(arity);`, Chapter.SOURCE_1).toBe(1);
  });

  test('arity ignores the rest parameter', () => {
    return expectFinishedResult(`arity(display); `, Chapter.SOURCE_1).toBe(1);
  });

  test('arity with user-made function is ok', () => {
    return expectFinishedResult(
      stripIndent`
      function test(x, y) {
        return x + y;
      }
      arity(test);
    `,
      Chapter.SOURCE_1,
    ).toBe(2);
  });

  test('arity with user-made lambda function is ok', () => {
    return expectFinishedResult(`arity(x => x);`, Chapter.SOURCE_1).toBe(1);
  });

  test('arity with user-made nullary function is ok', () => {
    return expectFinishedResult(`arity(() => undefined);`, Chapter.SOURCE_1).toBe(0);
  });

  test('arity with user-made function with rest parameter is ok', () => {
    return expectFinishedResult(
      stripIndent`
      function test(...xs) {
        return xs;
      }
      arity(test);
    `,
      Chapter.SOURCE_3,
    ).toBe(0);
  });

  test('arity with non-function arg f throws error', () => {
    return expectParsedError(`arity('function');`, Chapter.SOURCE_1).toEqual(
      'Line 1: arity: Expected function, got "function".',
    );
  });
});
