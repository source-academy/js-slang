import { describe, expect, test } from 'vitest';

import { ErrorSeverity, ErrorType, type SourceError } from '../../errors/base';
import { isWarning, toConductorError } from '../errors';

/** The minimum a real `SourceError` provides. */
function sourceError(overrides: Partial<SourceError> = {}): SourceError {
  return {
    type: ErrorType.RUNTIME,
    severity: ErrorSeverity.ERROR,
    location: { start: { line: 3, column: 4 }, end: { line: 3, column: 9 }, source: null },
    explain: () => 'Name xs not declared.',
    elaborate: () => '',
    ...overrides,
  };
}

describe('toConductorError', () => {
  test('keeps a SourceError position and message', () => {
    const e = toConductorError(sourceError());
    expect(e.name).toBe('EvaluatorRuntimeError');
    expect(e.message).toContain('Name xs not declared.');
  });

  // `context.errors` is typed `SourceError[]`, but the CSE machine's `evaluateImports` pushes
  // whatever `evaluate` threw — a raw TypeError for an unresolved import. `explain()` then threw
  // from inside the reporter, and the student saw `error.explain is not a function` instead of
  // their own failure.
  test('a raw Error in context.errors does not crash the reporter', () => {
    const raw = new TypeError("Cannot read properties of undefined (reading 'black')");
    const e = toConductorError(raw as unknown as SourceError);
    expect(e.message).toContain("Cannot read properties of undefined (reading 'black')");
  });

  test('a non-Error value is reported rather than thrown on', () => {
    const e = toConductorError('something went wrong' as unknown as SourceError);
    expect(e.message).toContain('something went wrong');
  });
});

describe('isWarning', () => {
  test('true only for WARNING severity', () => {
    expect(isWarning(sourceError({ severity: ErrorSeverity.WARNING }))).toBe(true);
    expect(isWarning(sourceError())).toBe(false);
  });

  test('a raw Error is not a warning, and does not throw', () => {
    expect(isWarning(new TypeError('boom') as unknown as SourceError)).toBe(false);
  });
});
