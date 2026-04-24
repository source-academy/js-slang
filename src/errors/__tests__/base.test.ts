import type { BaseNode } from 'estree';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { ErrorSeverity, ErrorType, RuntimeSourceError, SourceErrorWithNode } from '../base';
import { locationDummyNode } from '../../utils/ast/astCreator';
import { UNKNOWN_LOCATION } from '../../constants';

const testExplainMessage = 'Test explain message';
const testElaborateMessage = 'Test elaborate message';

describe(SourceErrorWithNode, () => {
  class TestSourceError extends SourceErrorWithNode<BaseNode | undefined> {
    type = ErrorType.RUNTIME;
    severity = ErrorSeverity.ERROR;

    public override explain() {
      return testExplainMessage;
    }

    public override elaborate(): string {
      return testElaborateMessage;
    }
  }

  const dummy = locationDummyNode(1, 1, null);
  const err = new TestSourceError(dummy);

  vi.spyOn(err, 'explain');

  test('properties', () => {
    expect(err).toBeInstanceOf(Error);
  });

  test('error message is explanation', () => {
    expect(err.message).toEqual(testExplainMessage);
    expect(err.explain).toHaveBeenCalledOnce();
  });

  test('error location is correct', () => {
    expect(err.location).toHaveProperty('start.line', 1);
    expect(err.location).toHaveProperty('start.column', 1);
  });

  test('error has unknown location when no node', () => {
    const err = new TestSourceError(undefined);
    expect(err.location).toEqual(UNKNOWN_LOCATION);
  });
});

describe(RuntimeSourceError, () => {
  class TestRuntimeError extends RuntimeSourceError<BaseNode | undefined> {
    public override explain(): string {
      return testExplainMessage;
    }
  }

  const dummy = locationDummyNode(1, 1, null);
  const err = new TestRuntimeError(dummy);

  const mockedExplain = vi.spyOn(err, 'explain');

  afterEach(() => {
    mockedExplain.mockClear();
  });

  test('properties', () => {
    expect(err).toBeInstanceOf(Error);
    expect(err.type).toEqual(ErrorType.RUNTIME);
    expect(err.severity).toEqual(ErrorSeverity.ERROR);
  });

  test('error message is explanation', () => {
    expect(err.message).toEqual(testExplainMessage);
    expect(err.explain).toHaveBeenCalledOnce();
  });

  test('elaboration is explanation', () => {
    expect(err.elaborate()).toEqual(testExplainMessage);
    expect(err.explain).toHaveBeenCalledOnce();
  });
});
