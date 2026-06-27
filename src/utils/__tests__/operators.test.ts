import { assert, describe, expect, test } from 'vitest';
import * as operators from '../operators';
import { stringify } from '../stringify';
import { GeneralRuntimeError, RuntimeSourceError } from '../../errors/base';
import { locationDummyNode } from '../ast/astCreator';

describe('Wrapping and Calling functions', () => {
  describe('No redefine tests', () => {
    test("Doesn't redefine toReplString if it is already present", () => {
      const x = () => 0;
      x.toReplString = () => 'x';
      const wrapped = operators.wrap(x, 0, undefined, '() => 0');

      expect(stringify(wrapped)).toEqual('x');
    });

    test("Doesn't define toReplString if stringified is undefined", () => {
      const x = () => 0;
      const wrapped = operators.wrap(x);

      expect(wrapped).not.toHaveProperty('toReplString');
    });

    test("Doesn't redefine maxArgs when present", () => {
      const x = (u: number, v = 0) => u + v;
      const x1 = operators.wrap(x, 1, 'x');
      // @ts-expect-error Intentionally breaking wrap type safety
      const x2 = operators.wrap(x1, 2, 'x1');

      expect(operators.callWithoutMetadata(x1, 1)).toEqual(1);

      expect(() => operators.callWithoutMetadata(x2 as any, 1, 2, 3)).toThrow(
        'x1: Expected 2 or fewer arguments, but got 3.',
      );
    });
  });

  describe('Wrapped nullary function tests', () => {
    const x = () => 0;
    const wrapped = operators.wrap(x, undefined, undefined, '() => 0');

    test('toReplString is set correctly', () => {
      expect(stringify(wrapped)).toEqual('() => 0');
    });

    test('calling with correct number of function parameters', () => {
      expect(operators.callWithoutMetadata(wrapped)).toEqual(0);
    });

    test('calling with too many parameters', () => {
      expect(() => operators.callWithoutMetadata(wrapped as any, 1)).toThrow(
        'x: Expected 0 arguments, but got 1.',
      );
    });
  });

  describe('Wrapped varargs function test', () => {
    const f = (x: any, ...args: any[]) => [x, ...args];
    const wrapped = operators.wrap(f, true, 'f', '(x, ...args) => [x, ...args]');

    test('toReplString is set correctly', () => {
      expect(stringify(wrapped)).toEqual('(x, ...args) => [x, ...args]');
    });

    test('calling with 1 parameter', () => {
      expect(operators.callWithoutMetadata(wrapped, 1)).toEqual([1]);
    });

    test('calling with 2 parameters', () => {
      expect(operators.callWithoutMetadata(wrapped, 1, 2)).toEqual([1, 2]);
    });

    test('calling with 0 parameters', () => {
      expect(() => operators.callWithoutMetadata(wrapped as any)).toThrow(
        'f: Expected 1 or more arguments, but got 0.',
      );
    });
  });

  describe('Throwing runtime errors from inside and outside of a prelude', () => {
    test('throwing error with known location inside non prelude function', () => {
      const dummy = locationDummyNode(1, 1, null);

      function f() {
        throw new GeneralRuntimeError('', dummy);
      }

      try {
        operators.callIfFuncAndRightArgs(f, 2, 2, null, undefined);
        expect.fail('Expected function to throw!');
      } catch (error) {
        assert(error instanceof RuntimeSourceError);

        expect(error.location).toHaveProperty('start.line', 1);
        expect(error.location).toHaveProperty('start.column', 1);
        expect(error.location).toHaveProperty('source', null);
      }
    });

    test('throwing error with known location inside prelude function', () => {
      const dummy = locationDummyNode(1, 1, null);

      const f = operators.wrap(
        () => {
          throw new GeneralRuntimeError('', dummy);
        },
        undefined,
        'f',
        '() => { ... }',
        'prelude',
      );

      try {
        operators.callIfFuncAndRightArgs(f, 2, 2, null, undefined);
        expect.fail('Expected function to throw!');
      } catch (error) {
        assert(error instanceof RuntimeSourceError);

        expect(error.location).toHaveProperty('start.line', 1);
        expect(error.location).toHaveProperty('start.column', 1);
        expect(error.location).toHaveProperty('source', 'prelude');
      }
    });

    test('throwing error from non-prelude through prelude function', () => {
      const prelude = operators.wrap(
        () => {
          throw new GeneralRuntimeError('');
        },
        undefined,
        'prelude',
        '() => {...}',
        null,
      );
      const notPrelude = operators.wrap(
        () => prelude(),
        undefined,
        'notPrelude',
        '() => {...}',
        'prelude',
      );

      try {
        operators.callIfFuncAndRightArgs(notPrelude, 2, 2, null, undefined);
        expect.fail('Expected function to throw!');
      } catch (error) {
        assert(error instanceof RuntimeSourceError);

        expect(error.location).toHaveProperty('start.line', 2);
        expect(error.location).toHaveProperty('start.column', 2);
        expect(error.location).toHaveProperty('source', 'prelude');
      }
    });
  });
});
