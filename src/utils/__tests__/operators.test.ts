import { assert, describe, expect, test } from 'vitest';
import * as operators from '../operators';
import { stringify } from '../stringify';
import { GeneralRuntimeError, RuntimeSourceError } from '../../errors/base';
import { locationDummyNode } from '../ast/astCreator';

describe('Wrapping and Calling functions', () => {
  describe('wrapped nullary function tests', () => {
    const x = () => 0;
    const wrapped = operators.wrap(x, '() => 0', undefined, null);

    test('toReplString is set correctly', () => {
      expect(stringify(wrapped)).toEqual('() => 0');
    });

    test('calling with correct number of function parameters', () => {
      expect(operators.callIfFuncAndRightArgs(wrapped, 0, 0, null, undefined)).toEqual(0);
    });

    test('calling with too many parameters', () => {
      expect(() => operators.callIfFuncAndRightArgs(wrapped, 0, 0, null, undefined, 1)).toThrow(
        'x: Expected 0 arguments, but got 1.',
      );
    });
  });

  describe('wrapped varargs function test', () => {
    const f = (x: any, ...args: any[]) => [x, ...args];
    const wrapped = operators.wrap(f, '(x, ...args) => [x, ...args]', 1, null);

    test('toReplString is set correctly', () => {
      expect(stringify(wrapped)).toEqual('(x, ...args) => [x, ...args]');
    });

    test('calling with 1 parameter', () => {
      expect(operators.callIfFuncAndRightArgs(wrapped, 0, 0, null, undefined, 1)).toEqual([1]);
    });

    test('calling with 2 parameters', () => {
      expect(operators.callIfFuncAndRightArgs(wrapped, 0, 0, null, undefined, 1, 2)).toEqual([
        1, 2,
      ]);
    });

    test('calling with 0 parameters', () => {
      expect(() => operators.callIfFuncAndRightArgs(wrapped, 0, 0, null, undefined)).toThrow(
        'f: Expected 1 or more arguments, but got 0.',
      );
    });
  });

  describe('throwing runtime errors from inside and outside of a prelude', () => {
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
        '() => { ... }',
        undefined,
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
        '() => {...}',
        undefined,
        null,
      );
      const notPrelude = operators.wrap(() => prelude(), '() => {...}', undefined, 'prelude');

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
