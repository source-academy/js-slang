import { DataType } from '@sourceacademy/conductor/types';

import { RuntimeSourceError } from '../../errors/base';

/**
 * Errors raised at the Source/module boundary by {@link SourceDataHandler}.
 *
 * These are `RuntimeSourceError`s rather than plain `Error`s so that they reach the host through
 * `toConductorError` with the rest of js-slang's diagnostics, instead of being flattened into a
 * generic `EvaluatorError` by `unknownToConductorError`.
 *
 * They report in **Source's** vocabulary, not Conductor's: a student who misuses a module function
 * should read about pairs, lists and functions, not about `DataType.CLOSURE` and identifier tables.
 * (py-slang's equivalents report in Python's vocabulary — `'str'`, `'NoneType'` — for the same
 * reason. The wording is the one part of a data handler that cannot be shared between languages.)
 *
 * None of them carry a node: the transpiled program has no AST at runtime, so there is no call site
 * to point at. `location` therefore falls back to `UNKNOWN_LOCATION`, and the host renders the
 * message without a position rather than with a wrong one.
 */
export abstract class ModuleInterfaceError extends RuntimeSourceError<undefined> {
  constructor() {
    super(undefined);
  }
}

/** Renders a Conductor `DataType` the way Source talks about it. */
export function typeName(type: DataType): string {
  switch (type) {
    case DataType.NUMBER:
    case DataType.INTEGER:
      return 'a number';
    case DataType.CONST_STRING:
      return 'a string';
    case DataType.BOOLEAN:
      return 'a boolean';
    case DataType.EMPTY_LIST:
      return 'null';
    case DataType.PAIR:
      return 'a pair';
    case DataType.LIST:
      return 'a list';
    case DataType.ARRAY:
      return 'an array';
    case DataType.CLOSURE:
      return 'a function';
    case DataType.OPAQUE:
      return 'an opaque value';
    case DataType.VOID:
      return 'undefined';
    case DataType.ANY:
      return 'a value of any type';
    default:
      return 'a value';
  }
}

/**
 * A handle that does not name anything this handler issued — a module held on to a pair or closure
 * past the run that created it, or fabricated one. Not a student error: it means the module is
 * misbehaving, so the message says so rather than blaming the program.
 */
export class InvalidIdentifierError extends ModuleInterfaceError {
  constructor(
    private readonly kind: string,
    private readonly id: unknown,
  ) {
    super();
  }

  public override explain(): string {
    return `A module used ${this.kind} value that no longer exists (id ${String(this.id)}).`;
  }
}

/** A module was handed a value of the wrong type — the common case being a student passing, say, a
 * string where a rune was expected. */
export class InvalidTypeError extends ModuleInterfaceError {
  constructor(
    private readonly what: string,
    private readonly expected: string,
    private readonly actual: string,
  ) {
    super();
  }

  public override explain(): string {
    return `Expected ${this.what} to be ${this.expected}, got ${this.actual}.`;
  }
}

export class InvalidIndexError extends ModuleInterfaceError {
  constructor(
    private readonly index: number,
    private readonly length: number,
  ) {
    super();
  }

  public override explain(): string {
    return `Index ${this.index} out of bounds for an array of length ${this.length}.`;
  }
}

export class InvalidArityError extends ModuleInterfaceError {
  constructor(
    private readonly expected: number,
    private readonly received: number,
  ) {
    super();
  }

  public override explain(): string {
    const plural = this.expected === 1 ? 'argument' : 'arguments';
    return `Expected ${this.expected} ${plural}, got ${this.received}.`;
  }
}

/** `array_make` with no initial value, for a type that has no sensible zero (a pair, a closure). */
export class InvalidArrayCreationError extends ModuleInterfaceError {
  // Named `dataTypeName`, not `type`: `RuntimeSourceError` -> `SourceError` already declares a
  // public `readonly type: ErrorType` for error classification (`src/errors/base.ts`) — a
  // same-named constructor parameter property here shadowed it with an unrelated string.
  constructor(private readonly dataTypeName: string) {
    super();
  }

  public override explain(): string {
    return `A module tried to create an array of ${this.dataTypeName} without an initial value.`;
  }
}

export class InvalidOpaqueUpdateError extends ModuleInterfaceError {
  public override explain(): string {
    return 'A module tried to modify an opaque value that was marked immutable.';
  }
}
