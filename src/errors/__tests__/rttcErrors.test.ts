import { describe, expect, test } from 'vitest';
import * as errors from '../rttcErrors';

describe(errors.InvalidParameterTypeError, () => {
  test('constructing without parameter name', () => {
    const error = new errors.InvalidParameterTypeError('number', 'abc', 'foo');
    expect(error.explain()).toEqual('foo: Expected number, got "abc".');
  });

  test('constructing with parameter name', () => {
    const error = new errors.InvalidParameterTypeError('number', 'abc', 'foo', 'x');
    expect(error.explain()).toEqual('foo: Expected number for x, got "abc".');
  });
});

describe(errors.InvalidCallbackError, () => {
  test('constructing with expected number of parameters being greater than 0', () => {
    const error = new errors.InvalidCallbackError(2, 'abc', 'foo');
    expect(error.explain()).toEqual('foo: Expected function with 2 parameters, got "abc".');
  });

  test('constructing with expected number of parameters being 0', () => {
    const error = new errors.InvalidCallbackError(0, 'abc', 'foo');
    expect(error.explain()).toEqual('foo: Expected function with 0 parameters, got "abc".');
  });

  test('constructing with expected callback type string', () => {
    const error = new errors.InvalidCallbackError('Curve', 'abc', 'foo', 'callback');
    expect(error.explain()).toEqual('foo: Expected Curve for callback, got "abc".');
  });
});

describe(errors.InvalidNumberParameterError, () => {
  test('integer with maximum and minimum', () => {
    const error = new errors.InvalidNumberParameterError(
      -1,
      { max: 2, min: 0, integer: true },
      'foo',
    );
    expect(error.explain()).toEqual('foo: Expected integer between 0 and 2, got -1.');
  });

  test('integer with only maximum', () => {
    const error = new errors.InvalidNumberParameterError(3, { max: 2 }, 'foo');
    expect(error.explain()).toEqual('foo: Expected integer less than 2, got 3.');
  });

  test('integer with only minimum', () => {
    const error = new errors.InvalidNumberParameterError(1, { min: 2 }, 'foo');
    expect(error.explain()).toEqual('foo: Expected integer greater than 2, got 1.');
  });

  test('integer with neither minimum nor maximum', () => {
    const error = new errors.InvalidNumberParameterError('abc', {}, 'foo');
    expect(error.explain()).toEqual('foo: Expected integer, got "abc".');
  });

  test('non-integer with maximum and minimum', () => {
    const error = new errors.InvalidNumberParameterError(
      -1,
      { max: 2, min: 0, integer: false },
      'foo',
    );
    expect(error.explain()).toEqual('foo: Expected number between 0 and 2, got -1.');
  });

  test('non-integer with only maximum', () => {
    const error = new errors.InvalidNumberParameterError(3, { max: 2, integer: false }, 'foo');
    expect(error.explain()).toEqual('foo: Expected number less than 2, got 3.');
  });

  test('non-integer with only minimum', () => {
    const error = new errors.InvalidNumberParameterError(1, { min: 2, integer: false }, 'foo');
    expect(error.explain()).toEqual('foo: Expected number greater than 2, got 1.');
  });

  test('non-integer with neither minimum nor maximum', () => {
    const error = new errors.InvalidNumberParameterError('abc', { integer: false }, 'foo');
    expect(error.explain()).toEqual('foo: Expected number, got "abc".');
  });
});
