import { UNKNOWN_LOCATION } from '../constants'
import { charEncoding } from '../localImports/filePaths'
import { ErrorSeverity, ErrorType, SourceError } from '../types'

export class InvalidFilePathError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  public location = UNKNOWN_LOCATION

  constructor(public filePath: string) {}

  public explain() {
    return `'${this.filePath}' must only contain alphanumeric chars or one of ${Object.keys(
      charEncoding
    )}.`
  }

  public elaborate() {
    return 'You should rename the offending file path to only use valid chars.'
  }
}
