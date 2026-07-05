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

  test('Nullary func', () => {
    type TestType1 = types.HasCorrectParameters<NullaryFunc, 0>;
    expectTypeOf<TestType1>().toEqualTypeOf<NullaryFunc>();

    type TestType2 = types.HasCorrectParameters<NullaryFunc, 1>;
    expectTypeOf<TestType2>().toEqualTypeOf<never>();

    type TestType3 = types.HasCorrectParameters<NullaryFunc, true>;
    expectTypeOf<TestType3>().toEqualTypeOf<never>();
  });

  test('Binary func', () => {
    type TestType1 = types.HasCorrectParameters<BinaryFunc, 0>;
    expectTypeOf<TestType1>().toEqualTypeOf<BinaryFunc>();

    type TestType2 = types.HasCorrectParameters<BinaryFunc, 2>;
    expectTypeOf<TestType2>().toEqualTypeOf<never>();

    type TestType3 = types.HasCorrectParameters<BinaryFunc, true>;
    expectTypeOf<TestType3>().toEqualTypeOf<never>();
  });

  test('Function with one default', () => {
    type TestType1 = types.HasCorrectParameters<OneDefFunc, 0>;
    expectTypeOf<TestType1>().toEqualTypeOf<never>();

    type TestType2 = types.HasCorrectParameters<OneDefFunc, 1>;
    expectTypeOf<TestType2>().toEqualTypeOf<OneDefFunc>();

    type TestType3 = types.HasCorrectParameters<OneDefFunc, 2>;
    expectTypeOf<TestType3>().toEqualTypeOf<never>();

    type TestType4 = types.HasCorrectParameters<OneDefFunc, true>;
    expectTypeOf<TestType4>().toEqualTypeOf<never>();
  });

  test('Function with two defaults', () => {
    type TestType1 = types.HasCorrectParameters<TwoDefFunc, 0>;
    expectTypeOf<TestType1>().toEqualTypeOf<never>();

    type TestType2 = types.HasCorrectParameters<TwoDefFunc, 1>;
    expectTypeOf<TestType2>().toEqualTypeOf<never>();

    type TestType3 = types.HasCorrectParameters<TwoDefFunc, 2>;
    expectTypeOf<TestType3>().toEqualTypeOf<TwoDefFunc>();

    type TestType4 = types.HasCorrectParameters<TwoDefFunc, true>;
    expectTypeOf<TestType4>().toEqualTypeOf<never>();
  });

  test('Function with only rest parameter', () => {
    type TestType1 = types.HasCorrectParameters<OnlyRestArgs, 0>;
    expectTypeOf<TestType1>().toEqualTypeOf<never>();

    type TestType2 = types.HasCorrectParameters<OnlyRestArgs, true>;
    expectTypeOf<TestType2>().toEqualTypeOf<OnlyRestArgs>();
  });

  test('Function with rest parameter and 1 arg', () => {
    type TestType1 = types.HasCorrectParameters<RestArgs, 0>;
    expectTypeOf<TestType1>().toEqualTypeOf<never>();

    type TestType2 = types.HasCorrectParameters<RestArgs, true>;
    expectTypeOf<TestType2>().toEqualTypeOf<RestArgs>();
  });

  test('Function with rest parameter, 1 default arg and 1 arg', () => {
    type TestType1 = types.HasCorrectParameters<RestAndDefArgs, 0>;
    expectTypeOf<TestType1>().toEqualTypeOf<never>();

    type TestType2 = types.HasCorrectParameters<RestAndDefArgs, true>;
    expectTypeOf<TestType2>().toEqualTypeOf<RestAndDefArgs>();

    type TestType3 = types.HasCorrectParameters<RestAndDefArgs, 1>;
    expectTypeOf<TestType3>().toEqualTypeOf<never>();
  });
});
