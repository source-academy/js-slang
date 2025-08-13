import * as es from 'estree'
import { UNKNOWN_LOCATION } from '../constants'
import { ErrorSeverity, ErrorType, type Node, type SourceError } from '../types'

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
