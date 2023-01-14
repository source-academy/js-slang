import { UNKNOWN_LOCATION } from '../constants'
import { charEncoding } from '../localImports/filePaths'
import { ErrorSeverity, ErrorType, SourceError } from '../types'

export class InvalidFilePathError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  public location = UNKNOWN_LOCATION

  constructor(public filePath: string) {}

  public explain() {
    const validNonAlphanumericChars = Object.keys(charEncoding)
      .map(char => `'${char}'`)
      .join(', ')
    return `'${this.filePath}' must only contain alphanumeric chars or one of ${validNonAlphanumericChars}.`
  }

  public elaborate() {
    return 'Rename the offending file path to only use valid chars.'
  }
}

export class CannotFindModuleError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  public location = UNKNOWN_LOCATION

  constructor(public moduleFilePath: string) {}

  public explain() {
    return `Cannot find module '${this.moduleFilePath}'.`
  }

  public elaborate() {
    return 'Check that the module file path resolves to an existing file.'
  }
}

export class CircularImportError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  public location = UNKNOWN_LOCATION

  constructor(public filePathsInCycle: string[]) {}

  public explain() {
    // We need to reverse the file paths in the cycle so that the
    // semantics of "'/a.js' -> '/b.js'" is "'/a.js' imports '/b.js'".
    const formattedCycle = this.filePathsInCycle
      .map(filePath => `'${filePath}'`)
      .reverse()
      .join(' -> ')
    return `Circular import detected: ${formattedCycle}.`
  }

  public elaborate() {
    return 'Break the circular import cycle by removing imports from any of the offending files.'
  }
}
