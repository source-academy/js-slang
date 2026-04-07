import type { BinaryOperator, UnaryOperator } from 'estree';
import { assert, describe, expect, expectTypeOf, test as baseTest } from 'vitest';

import { Chapter } from '../../langs';
import type { Context, Node, Value } from '../../types';
import * as rttc from '../rttc';
import { mockClosure, mockRuntimeContext } from '../testing/mocks';

const num = 0;
const bool = true;
const str = ' ';
const func = mockClosure();
const builtin = (x: Value) => x;
const obj = { a: 1 };
const arr = [2];

const mockValues: Value[] = [num, bool, str, func, builtin, obj, arr, undefined, null];

interface Fixtures {
  context: Context;
  node: Node;
}

const test = baseTest.extend<Fixtures>({
  context: ({}, use) => use(mockRuntimeContext()),
  node: ({ context }, use) => use(context.runtime.nodes[0]),
});

describe(rttc.checkUnaryExpression, () => {
  const valid: [UnaryOperator, Value][] = [
    ['!', bool],
    ['+', num],
    ['-', num],
  ];

  const operators: UnaryOperator[] = ['!', '+', '-'];
  const invalid: [UnaryOperator, Value][] = [];

  operators.forEach(op => {
    mockValues.forEach(value => {
      if (!valid.some(combination => combination[0] === op && combination[1] === value)) {
        invalid.push([op, value]);
      }
    });
  });

  describe('Valid type combinations are okay', () => {
    test.for(valid)('%#', ([op, value], { node }) => {
      expect(() => rttc.checkUnaryExpression(node, op, value)).not.toThrow();
    });
  });

  describe('Invalid type combinations throw TypeError', () => {
    test.for(invalid)('%#', ([op, value], { node }) => {
      try {
        rttc.checkUnaryExpression(node, op, value);
      } catch (error) {
        assert(error instanceof rttc.RuntimeTypeError);
        expect({
          operator: op,
          value,
          explain: error.explain(),
          elaborate: error.elaborate(),
        }).toMatchSnapshot();
        return;
      }
      throw new Error('Expected checkUnaryExpression to throw, did not throw');
    });
  });
});

describe(rttc.checkBinaryExpression, () => {
  describe('Binary + type combinations:', () => {
    const valid: [BinaryOperator, Value, Value][] = [
      ['+', num, num],
      ['+', str, str],
    ];
    const operators: BinaryOperator[] = ['+'];
    const invalid: [BinaryOperator, Value, Value][] = [];

    operators.forEach(op => {
      mockValues.forEach(left => {
        mockValues.forEach(right => {
          if (
            !valid.some(
              combination =>
                combination[0] === op && combination[1] === left && combination[2] === right,
            )
          ) {
            invalid.push([op, left, right]);
          }
        });
      });
    });

    describe('Valid type combinations are OK', () => {
      test.for(valid)('%#', ([operator, left, right], { node }) => {
        expect(() =>
          rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right]),
        ).not.toThrow();
      });
    });

    describe('Invalid type combinations throw TypeError', () => {
      test.for(invalid)('%#', ([operator, left, right], { node }) => {
        try {
          rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right]);
        } catch (error) {
          assert(error instanceof rttc.RuntimeTypeError);
          expect({
            operator,
            left,
            right,
            explain: error.explain(),
            elaborate: error.elaborate(),
          }).toMatchSnapshot();
          return;
        }
        throw new Error('Expected checkBinaryExpression to throw, did not throw');
      });
    });
  });

  describe('Binary (-|*|/|%) type combinations:', () => {
    const valid: [BinaryOperator, Value, Value][] = [
      ['-', num, num],
      ['*', num, num],
      ['/', num, num],
      ['%', num, num],
    ];
    const operators: BinaryOperator[] = ['-', '*', '/', '%'];
    const invalid: [BinaryOperator, Value, Value][] = [];

    operators.forEach(op => {
      mockValues.forEach(left => {
        mockValues.forEach(right => {
          if (
            !valid.some(
              combination =>
                combination[0] === op && combination[1] === left && combination[2] === right,
            )
          ) {
            invalid.push([op, left, right]);
          }
        });
      });
    });

    describe('Valid type combinations are OK', () => {
      test.for(valid)('%#', ([operator, left, right], { node }) => {
        expect(() =>
          rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right]),
        ).not.toThrow();
      });
    });

    describe('Invalid type combinations throw TypeError', () => {
      test.for(invalid)('%#', ([operator, left, right], { node }) => {
        try {
          rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right]);
        } catch (error) {
          assert(error instanceof rttc.RuntimeTypeError);
          expect({
            operator,
            left,
            right,
            explain: error.explain(),
            elaborate: error.elaborate(),
          }).toMatchSnapshot();
          return;
        }
        throw new Error('Expected checkBinaryExpression to throw, did not throw');
      });
    });
  });

  describe('Binary (===|!==) type combinations:', () => {
    const valid: [BinaryOperator, Value, Value][] = [];
    const operators: BinaryOperator[] = ['===', '!=='];
    const invalid: [BinaryOperator, Value, Value][] = [];

    // Every combination is valid
    operators.forEach(op => {
      mockValues.forEach(left => {
        mockValues.forEach(right => {
          valid.push([op, left, right]);
        });
      });
    });

    describe('Valid type combinations are OK', () => {
      test.for(valid)('%#', ([operator, left, right], { node }) => {
        expect(() =>
          rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right]),
        ).not.toThrow();
      });
    });

    describe('Invalid type combinations throw TypeError', () => {
      test.for(invalid)('%#', ([operator, left, right], { node }) => {
        try {
          rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right]);
        } catch (error) {
          assert(error instanceof rttc.RuntimeTypeError);
          expect({
            operator,
            left,
            right,
            explain: error.explain(),
            elaborate: error.elaborate(),
          }).toMatchSnapshot();
          return;
        }
        throw new Error('Expected checkBinaryExpression to throw, did not throw');
      });
    });
  });

  describe('Binary (<|>|<=|>=) type combinations:', () => {
    const valid: [BinaryOperator, Value, Value][] = [
      ['<', num, num],
      ['<', str, str],
      ['>', num, num],
      ['>', str, str],
      ['<=', num, num],
      ['<=', str, str],
      ['>=', num, num],
      ['>=', str, str],
    ];
    const operators: BinaryOperator[] = ['<', '>', '<=', '>='];
    const invalid: [BinaryOperator, Value, Value][] = [];

    operators.forEach(op => {
      mockValues.forEach(left => {
        mockValues.forEach(right => {
          if (
            !valid.some(
              combination =>
                combination[0] === op && combination[1] === left && combination[2] === right,
            )
          ) {
            invalid.push([op, left, right]);
          }
        });
      });
    });

    describe('Valid type combinations are OK', () => {
      test.for(valid)('%#', ([operator, left, right], { node }) => {
        expect(() =>
          rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right]),
        ).not.toThrow();
      });
    });

    describe('Invalid type combinations throw TypeError', () => {
      test.for(invalid)('%#', ([operator, left, right], { node }) => {
        try {
          rttc.checkBinaryExpression(node, operator, Chapter.SOURCE_4, [left, right]);
        } catch (error) {
          assert(error instanceof rttc.RuntimeTypeError);
          expect({
            operator,
            left,
            right,
            explain: error.explain(),
            elaborate: error.elaborate(),
          }).toMatchSnapshot();
          return;
        }
        throw new Error('Expected checkBinaryExpression to throw error, did not throw error');
      });
    });
  });
});

describe(rttc.checkIfStatement, () => {
  const valid: Value[] = [bool];
  const invalid: Value[] = [];

  mockValues.forEach(value => {
    if (!valid.some(combination => combination === value)) {
      invalid.push(value);
    }
  });

  describe('Valid type combinations are OK', () => {
    test.for(valid)('%#', ([value], { node }) => {
      expect(() => rttc.checkIfStatement(node, value)).not.toThrow();
    });
  });

  describe('Invalid type combinations return TypeError', () => {
    test.for(invalid)('%#', ([value], { node }) => {
      try {
        rttc.checkIfStatement(node, value);
      } catch (error) {
        assert(error instanceof rttc.RuntimeTypeError);
        expect({
          value,
          explain: error.explain(),
          elaborate: error.elaborate(),
        }).toMatchSnapshot();
        return;
      }

      throw new Error('Expected checkIfStatement to throw, did not get error');
    });
  });
});

describe(rttc.checkMemberAccess, () => {
  const valid: [Value, Value][] = [
    [obj, str],
    [arr, num],
  ];
  const invalid: [Value, Value][] = [];

  mockValues.forEach(left => {
    mockValues.forEach(right => {
      if (!valid.some(combination => combination[0] === left && combination[1] === right)) {
        invalid.push([left, right]);
      }
    });
  });

  // Extra tests for array indices integral check.
  valid.push([arr, 0]);
  valid.push([arr, 10]);
  valid.push([arr, 2 ** 32 - 2]);
  invalid.push([arr, -1]);
  invalid.push([arr, 0.5]);
  invalid.push([arr, 2 ** 32 - 1]);

  describe('Valid type combinations are OK', () => {
    test.for(valid)('%#', ([left, right], { node }) => {
      expect(() => rttc.checkMemberAccess(node, [left, right])).not.toThrow();
    });
  });

  describe('Invalid type combinations throw TypeError', () => {
    test.for(invalid)('%#', ([left, right], { node }) => {
      try {
        rttc.checkMemberAccess(node, [left, right]);
      } catch (error) {
        assert(error instanceof rttc.RuntimeTypeError);
        expect({
          left,
          right,
          explain: error.explain(),
          elaborate: error.elaborate(),
        }).toMatchSnapshot();
      }
      throw new Error('Expected checkMemberAccess to throw error, no error thrown');
    });
  });
});

describe(rttc.isFunctionOfLength, () => {
  test('correctly identifies functions with the specified number of parameters', () => {
    const func0 = () => {};
    assert(rttc.isFunctionOfLength(func0, 0));
    expectTypeOf(func0).toEqualTypeOf<() => void>();

    const func1 = (a: number) => a;
    assert(rttc.isFunctionOfLength(func1, 1));
    expectTypeOf(func1).toEqualTypeOf<(a: number) => number>();

    const func2 = (_a: number, _b: string) => {};
    assert(rttc.isFunctionOfLength(func2, 2));
    expectTypeOf(func2).toEqualTypeOf<(a: number, b: string) => void>();

    const func3: unknown = (_a: any) => {};
    if (rttc.isFunctionOfLength(func3, 1)) {
      expectTypeOf(func3).toEqualTypeOf<(a: unknown) => unknown>();
    } else {
      expectTypeOf(func3).toEqualTypeOf<unknown>();
      throw new Error('Type guard failed unexpectedly');
    }
  });
});

describe(rttc.assertFunctionOfLength, () => {
  test('throws InvalidCallbackError', () => {
    expect(() => rttc.assertFunctionOfLength(() => 0, 1, 'foo')).toThrow(
      'foo: Expected function with 0 parameters, got () => 0.',
    );
  });
});

describe(rttc.isTupleOfLength, () => {
  test('correctly identifies unknown as a tuple of length 0', () => {
    const tup0: unknown = []
    assert(rttc.isTupleOfLength(tup0, 0))
    expectTypeOf(tup0).toEqualTypeOf<[]>();
  })

  test('correctly identifies unknown as a tuple of length 2', () => {
    const tup: unknown = [0, 0]
    assert(rttc.isTupleOfLength(tup, 2))
    expectTypeOf(tup).toEqualTypeOf<[unknown, unknown]>()
  })

  test('uses available type information', () => {
    const tup: [number, string] = [0, 'a'];
    assert(rttc.isTupleOfLength(tup, 2));
    expectTypeOf(tup).toEqualTypeOf<[number, string]>();
  })

  test('correctly returns false', () => {
    const tup: unknown = [0, 0];
    expect(rttc.isTupleOfLength(tup, 1)).toEqual(false);
  })
})

describe(rttc.isNumberWithinRange, () => {
  describe('non-options overload', () => {
    describe('integer with maximum and minimum', () => {
      const cases: [string, number, boolean][] = [
        ['includes min', 0, true],
        ['includes max', 2, true],
        ["doesn't include fractions", 1.5, false],
        ["doesn't include NaN", NaN, false],
      ];

      test.each(cases)('%s', (_, val, expected) => {
        expect(rttc.isNumberWithinRange(val, 0, 2)).toEqual(expected);
      });
    });

    describe('integer with minimum only', () => {
      const cases: [string, number, boolean][] = [
        ['includes min', 0, true],
        ["doesn't include fractions", 1.5, false],
        ["doesn't include NaN", NaN, false],
      ];

      test.each(cases)('%s', (_, val, expected) => {
        expect(rttc.isNumberWithinRange(val, 0)).toEqual(expected);
      });
    });

    describe('number with maximum and minimum', () => {
      const cases: [string, number, boolean][] = [
        ['includes min', 0, true],
        ['includes max', 2, true],
        ['includes fractions', 1.5, true],
        ["doesn't include NaN", NaN, false],
      ];

      test.each(cases)('%s', (_, val, expected) => {
        expect(rttc.isNumberWithinRange(val, 0, 2, false)).toEqual(expected);
      });
    });
  });

  describe('options overload', () => {
    describe('integer with maximum and minimum', () => {
      const cases: [string, number, boolean][] = [
        ['includes min', 0, true],
        ['includes max', 2, true],
        ["doesn't include fractions", 1.5, false],
        ["doesn't include NaN", NaN, false],
      ];

      test.each(cases)('%s', (_, val, expected) => {
        expect(rttc.isNumberWithinRange(val, { min: 0, max: 2 })).toEqual(expected);
      });
    });

    describe('integer with minimum only', () => {
      const cases: [string, number, boolean][] = [
        ['includes min', 0, true],
        ["doesn't include fractions", 1.5, false],
        ["doesn't include NaN", NaN, false],
      ];

      test.each(cases)('%s', (_, val, expected) => {
        expect(rttc.isNumberWithinRange(val, { min: 0 })).toEqual(expected);
      });
    });

    describe('integer with maximum only', () => {
      const cases: [string, number, boolean][] = [
        ['includes max', 2, true],
        ["doesn't include fractions", 1.5, false],
        ["doesn't include NaN", NaN, false],
      ];

      test.each(cases)('%s', (_, val, expected) => {
        expect(rttc.isNumberWithinRange(val, { max: 2 })).toEqual(expected);
      });
    });

    describe('number with maximum and minimum', () => {
      const cases: [string, number, boolean][] = [
        ['includes min', 0, true],
        ['includes max', 2, true],
        ['includes fractions', 1.5, true],
        ["doesn't include NaN", NaN, false],
      ];

      test.each(cases)('%s', (_, val, expected) => {
        expect(rttc.isNumberWithinRange(val, { min: 0, max: 2, integer: false })).toEqual(expected);
      });
    });
  });
});

describe(rttc.assertNumberWithinRange, () => {
  test('throws InvalidNumberParameterError', () => {
    expect(() => rttc.assertNumberWithinRange(0, 'foo', 1)).toThrow(
      'foo: Expected integer greater than 1, got 0.',
    );
  });
});
