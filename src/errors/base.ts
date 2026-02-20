import type es from 'estree'
import { UNKNOWN_LOCATION } from '../constants'
import type { Node } from '../types'

export enum ErrorType {
  IMPORT = 'Import',
  RUNTIME = 'Runtime',
  SYNTAX = 'Syntax',
  TYPE = 'Type'
}

export enum ErrorSeverity {
  WARNING = 'Warning',
  ERROR = 'Error'
}

// any and all errors ultimately implement this interface. as such, changes to this will affect every type of error.
export interface SourceError {
  type: ErrorType
  severity: ErrorSeverity
  location: es.SourceLocation
  explain(): string
  elaborate(): string
}

/**
 * Abstract Source Error class that automatically handles its location property
 */
export abstract class SourceErrorWithNode<T extends Node | undefined>
  extends Error
  implements SourceError
{
  constructor(public readonly node: T) {
    super()
  }

  public get location() {
    return this.node?.loc ?? UNKNOWN_LOCATION
  }

  public abstract readonly type: ErrorType
  public abstract readonly severity: ErrorSeverity

  public abstract explain(): string
  public abstract elaborate(): string
}

/**
 * Abstract Source Error class for Runtime errors
 */
export abstract class RuntimeSourceError<
  T extends Node | undefined
> extends SourceErrorWithNode<T> {
  type = ErrorType.RUNTIME
  severity: ErrorSeverity.ERROR
}

export class GeneralRuntimeError extends RuntimeSourceError<Node | undefined> {
  constructor(
    public readonly explanation: string,
    node?: Node,
    public readonly elaboration?: string
  ) {
    super(node)
  }

  public override explain() {
    return this.explanation
  }

  public override elaborate(): string {
    return this.elaboration ?? this.explanation
  }
}
