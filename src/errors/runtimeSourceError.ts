import type es from 'estree'
import type { Node } from '../types'

import { UNKNOWN_LOCATION } from '../constants'
import { ErrorType, ErrorSeverity, type SourceError } from './base'

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
