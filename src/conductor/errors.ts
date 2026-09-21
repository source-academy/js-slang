import {
  ConductorError,
  EvaluatorError,
  EvaluatorRuntimeError,
  EvaluatorSyntaxError,
} from '@sourceacademy/conductor/common';

import { ErrorSeverity, ErrorType, type SourceError } from '../errors/base';

/**
 * Translates one js-slang {@link SourceError} into the conductor error the host understands.
 *
 * One conductor error is produced per `SourceError`, rather than collapsing the whole array into
 * a single `parseError()` string, so that each error keeps its own position: `EvaluatorError`'s
 * constructor takes `(message, line?, column?, fileName?)` and renders the location itself, which
 * matches what `SourceError.location.start` already carries.
 *
 * Only `explain()` is sent, not `elaborate()`. js-slang appends elaborations only in verbose mode
 * (see `parseError`), and the host REPL has nowhere to put a multi-paragraph second message.
 *
 * `ErrorType.TYPE` maps to the generic {@link EvaluatorError} rather than conductor's
 * `EvaluatorTypeError`, which requires structured `expected`/`actual` strings that a `SourceError`
 * does not expose — they are already baked into `explain()`. Inventing them would put a
 * "(expected X, got Y)" suffix on a message that reads fine without one. In practice this is moot
 * for now: `ErrorType.TYPE` belongs to the static type checker (`src/errors/typeErrors.ts`), which
 * only runs under `Variant.TYPED`. When the typed evaluators land, those errors carry enough
 * structure to be upgraded to `EvaluatorTypeError` properly.
 */
export function toConductorError(error: SourceError): ConductorError {
  const line = error.location?.start?.line;
  const column = error.location?.start?.column;
  const fileName = error.location?.source ?? undefined;
  const message = error.explain();

  switch (error.type) {
    case ErrorType.SYNTAX:
      return new EvaluatorSyntaxError(message, line, column, fileName);
    case ErrorType.RUNTIME:
      return new EvaluatorRuntimeError(message, line, column, fileName);
    default:
      // ErrorType.IMPORT and ErrorType.TYPE.
      return new EvaluatorError(message, line, column, fileName);
  }
}

/**
 * Wraps a value thrown from outside js-slang's own error hierarchy — a bug in the evaluator, or a
 * host-side failure — as a conductor error. A `SourceError` should go through
 * {@link toConductorError} instead, which preserves its position.
 */
export function unknownToConductorError(e: unknown): ConductorError {
  if (e instanceof ConductorError) return e;
  return new EvaluatorError(e instanceof Error ? e.message : String(e));
}

/** True for a diagnostic js-slang considers a warning, which belongs on stdout rather than the
 * error channel — the host renders everything on `__error` in red. */
export function isWarning(error: SourceError): boolean {
  return error.severity === ErrorSeverity.WARNING;
}
