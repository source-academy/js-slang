import es, {type  BaseNode } from 'estree';
import { UNKNOWN_LOCATION } from '../constants';

export enum ErrorType {
  IMPORT = 'Import',
  RUNTIME = 'Runtime',
  SYNTAX = 'Syntax',
  TYPE = 'Type',
}

export enum ErrorSeverity {
  WARNING = 'Warning',
  ERROR = 'Error',
}

// any and all errors ultimately implement this interface. as such, changes to this will affect every type of error.
export interface SourceError {
  type: ErrorType;
  severity: ErrorSeverity;
  location: es.SourceLocation;
  explain(): string;
  elaborate(): string;
}

/**
 * Abstract Source Error class that automatically handles its location property
 */
export abstract class SourceErrorWithNode<T extends es.BaseNode | undefined>
  extends Error
  implements SourceError
{
  constructor(public readonly node: T) {
    super();
  }

  public get location() {
    return this.node?.loc ?? UNKNOWN_LOCATION;
  }

  public abstract readonly type: ErrorType;
  public abstract readonly severity: ErrorSeverity;

  public abstract explain(): string;
  public abstract elaborate(): string;

  public override get message() {
    return this.explain();
  }
}

/**
 * Abstract Source Error class for Runtime errors
 */
export abstract class RuntimeSourceError<
  T extends BaseNode | undefined
> extends SourceErrorWithNode<T> {
  type = ErrorType.RUNTIME;
  severity = ErrorSeverity.ERROR;
}

/**
 * A concrete instantiation of {@link RuntimeSourceError} that can
 * be used when there just aren't any other good Source error classes that can be used
 */
export class GeneralRuntimeError extends RuntimeSourceError<BaseNode | undefined> {
  constructor(
    private readonly explanation: string,
    node?: BaseNode,
    private readonly elaboration?: string
  ) {
    super(node);
  }

  public override explain() {
    return this.explanation;
  }

  public override elaborate(): string {
    return this.elaboration ?? this.explanation;
  }
}

/**
 * A subclass of {@link RuntimeSourceError} intended for use when an unexpected runtime error
 * occurs due to an internal error rather than any error caused by the code being evaluated.
 */
export class InternalRuntimeError extends RuntimeSourceError<BaseNode | undefined> {
  constructor(
    private readonly explanation: string,
    node?: BaseNode,
    private readonly elaboration?: string
  ) {
    super(node);
  }

  public override explain() {
    return this.explanation;
  }

  public override elaborate(): string {
    return this.elaboration ?? this.explanation;
  }
}

