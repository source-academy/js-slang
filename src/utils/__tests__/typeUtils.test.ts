import { describe, expectTypeOf, test } from 'vitest';
import type * as types from '../typeUtils';

describe('HasCorrectParamters', () => {
  type NullaryFunc = () => void;
  type BinaryFunc = (arg0: number, arg1: string) => number;
  type OneDefFunc = (arg0: number, arg1?: string) => number;
  type TwoDefFunc = (arg0: number, arg1?: string, arg2?: string) => number;
  type OnlyRestArgs = (...arg1: string[]) => number;
  type RestArgs = (arg0: number, ...arg1: string[]) => number;
  type RestAndDefArgs = (arg0: number, arg1?: boolean, ...arg2: string[]) => number;

  describe('OptArgs = 0', () => {
    test('Nullary func', () => {
      type TestType1 = types.HasCorrectParameters<NullaryFunc, 0, 0>;
      expectTypeOf<TestType1>().toEqualTypeOf<NullaryFunc>();

      type TestType2 = types.HasCorrectParameters<NullaryFunc, 1, 1>;
      expectTypeOf<TestType2>().toEqualTypeOf<never>();
    });

    test('Binary func', () => {
      type TestType1 = types.HasCorrectParameters<BinaryFunc, 0, 0>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();

      type TestType2 = types.HasCorrectParameters<BinaryFunc, 2, 0>;
      expectTypeOf<TestType2>().toEqualTypeOf<BinaryFunc>();
    });

    test('Function with one default', () => {
      type TestType1 = types.HasCorrectParameters<OneDefFunc, 1, 0>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });

    test('Function with two defaults', () => {
      type TestType1 = types.HasCorrectParameters<TwoDefFunc, 2, 0>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });

    test('Function with only rest parameter', () => {
      type TestType1 = types.HasCorrectParameters<OnlyRestArgs, 1, 0>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });

    test('Function with rest parameter and 1 arg', () => {
      type TestType1 = types.HasCorrectParameters<RestArgs, 1, 0>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });

    test('Function with rest parameter, 1 default arg and 1 arg', () => {
      type TestType1 = types.HasCorrectParameters<RestAndDefArgs, 1, 0>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });
  })

  describe('Check that OptArgs works', () => {
    test('Nullary func', () => {
      type TestType2 = types.HasCorrectParameters<NullaryFunc, 0, 1>;
      expectTypeOf<TestType2>().toEqualTypeOf<never>();
    });

    test('Binary func', () => {
      type TestType1 = types.HasCorrectParameters<BinaryFunc, 0, 2>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();

      type TestType2 = types.HasCorrectParameters<BinaryFunc, 2, 2>;
      expectTypeOf<TestType2>().toEqualTypeOf<never>();
    });

    test('Function with one default', () => {
      type TestType1 = types.HasCorrectParameters<OneDefFunc, 1, 1>;
      expectTypeOf<TestType1>().toEqualTypeOf<OneDefFunc>();

      type TestType2 = types.HasCorrectParameters<OneDefFunc, 0, 2>;
      expectTypeOf<TestType2>().toEqualTypeOf<never>();
    });

    test('Function with two defaults', () => {
      type TestType1 = types.HasCorrectParameters<TwoDefFunc, 1, 2>;
      expectTypeOf<TestType1>().toEqualTypeOf<TwoDefFunc>();
    });

    test('Function with only rest parameter', () => {
      type TestType1 = types.HasCorrectParameters<OnlyRestArgs, 0, 1>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });

    test('Function with rest parameter and 1 arg', () => {
      type TestType1 = types.HasCorrectParameters<RestArgs, 1, 1>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });

    test('Function with rest parameter, 1 default arg and 1 arg', () => {
      type TestType1 = types.HasCorrectParameters<RestAndDefArgs, 1, 1>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });
  });

  describe('With RestArgs', () => {
    test('Nullary func', () => {
      type TestType1 = types.HasCorrectParameters<NullaryFunc, 0, true>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });

    test('Binary func', () => {
      type TestType2 = types.HasCorrectParameters<BinaryFunc, 2, true>;
      expectTypeOf<TestType2>().toEqualTypeOf<never>();
    });

    test('Function with one default', () => {
      type TestType1 = types.HasCorrectParameters<OneDefFunc, 1, true>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });

    test('Function with two defaults', () => {
      type TestType1 = types.HasCorrectParameters<TwoDefFunc, 1, true>;
      expectTypeOf<TestType1>().toEqualTypeOf<never>();
    });

    test('Function with only rest parameter', () => {
      type TestType1 = types.HasCorrectParameters<OnlyRestArgs, 0, true>;
      expectTypeOf<TestType1>().toEqualTypeOf<OnlyRestArgs>();

      type TestType2 = types.HasCorrectParameters<OnlyRestArgs, 1, true>;
      expectTypeOf<TestType2>().toEqualTypeOf<never>();
    });

    test('Function with rest parameter and 1 arg', () => {
      type TestType1 = types.HasCorrectParameters<RestArgs, 1, true>;
      expectTypeOf<TestType1>().toEqualTypeOf<RestArgs>();

      type TestType2 = types.HasCorrectParameters<RestArgs, 2, true>;
      expectTypeOf<TestType2>().toEqualTypeOf<never>();
    });

    test('Function with rest parameter, 1 default arg and 1 arg', () => {
      type TestType1 = types.HasCorrectParameters<RestAndDefArgs, 1, true>;
      expectTypeOf<TestType1>().toEqualTypeOf<RestAndDefArgs>();

      type TestType2 = types.HasCorrectParameters<RestAndDefArgs, 2, true>;
      expectTypeOf<TestType2>().toEqualTypeOf<never>();
    });
  })
});