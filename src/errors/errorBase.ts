import type es from 'estree'
import { UNKNOWN_LOCATION } from '../constants'
import type { Node } from '../utils/ast/node'

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

export class RuntimeSourceError implements SourceError {
  public type = ErrorType.RUNTIME
  public severity = ErrorSeverity.ERROR
  public location: es.SourceLocation

  constructor(node?: Node) {
    this.location = node?.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return ''
  }

  public elaborate() {
    return this.explain()
  }
}
