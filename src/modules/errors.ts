import { UNKNOWN_LOCATION } from '../constants'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { ErrorSeverity, ErrorType, SourceError } from '../types'
import type * as es from '../utils/ast/types'
import { nonAlphanumericCharEncoding } from './preprocessor/filePaths'

export class ModuleConnectionError extends RuntimeSourceError {
  private static message: string = `Unable to get modules.`
  private static elaboration: string = `You should check your Internet connection, and ensure you have used the correct module path.`
  constructor(public readonly error?: any, node?: es.Node) {
    super(node)
  }

  public explain() {
    return ModuleConnectionError.message
  }

  public elaborate() {
    return ModuleConnectionError.elaboration
  }
}

export class ModuleNotFoundError extends RuntimeSourceError {
  constructor(public moduleName: string, node?: es.Node) {
    super(node)
  }

  public explain() {
    return `Module '${this.moduleName}' not found.`
  }

  public elaborate() {
    return 'You should check your import declarations, and ensure that all are valid modules.'
  }
}

export class ModuleInternalError extends RuntimeSourceError {
  constructor(public moduleName: string, public error?: any, node?: es.Node) {
    super(node)
  }

  public explain() {
    return `Error(s) occured when executing the module "${this.moduleName}".`
  }

  public elaborate() {
    return `
      You may need to contact with the author for this module to fix this error.
    `
  }
}

export abstract class UndefinedImportErrorBase extends RuntimeSourceError {
  constructor(
    public readonly moduleName: string,
    node?: es.ModuleDeclarationWithSource | es.ExportSpecifier | es.ImportSpecifiers
  ) {
    super(node)
  }

  public elaborate(): string {
    return "Check your imports and make sure what you're trying to import exists!"
  }
}

export class UndefinedImportError extends UndefinedImportErrorBase {
  constructor(
    public readonly symbol: string,
    moduleName: string,
    node?: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ExportSpecifier
  ) {
    super(moduleName, node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not contain a definition for '${this.symbol}'`
  }
}

export class UndefinedDefaultImportError extends UndefinedImportErrorBase {
  constructor(
    moduleName: string,
    node?: es.ImportSpecifier | es.ImportDefaultSpecifier | es.ExportSpecifier
  ) {
    super(moduleName, node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not contain a default export!`
  }
}

export class UndefinedNamespaceImportError extends UndefinedImportErrorBase {
  constructor(moduleName: string, node?: es.ImportNamespaceSpecifier | es.ExportAllDeclaration) {
    super(moduleName, node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not export any symbols!`
  }
}

export abstract class ReexportErrorBase implements SourceError {
  public severity = ErrorSeverity.ERROR
  public type = ErrorType.RUNTIME
  public readonly location: es.SourceLocation
  public readonly sourceString: string

  constructor(
    public readonly modulePath: string,
    public readonly nodes: (es.ModuleDeclaration | es.ExportSpecifier)[]
  ) {
    this.location = nodes[0].loc ?? UNKNOWN_LOCATION
    this.sourceString = nodes
      .map(({ loc }) => `(${loc!.start.line}:${loc!.start.column})`)
      .join(', ')
  }

  public abstract explain(): string
  public abstract elaborate(): string
}

export class ReexportSymbolError extends ReexportErrorBase {
  constructor(
    modulePath: string,
    public readonly symbol: string,
    nodes: (es.ModuleDeclaration | es.ExportSpecifier)[]
  ) {
    super(modulePath, nodes)
  }

  public explain(): string {
    return `Multiple export definitions for the symbol '${this.symbol}' at (${this.sourceString})`
  }

  public elaborate(): string {
    return 'Check that you are not exporting the same symbol more than once'
  }
}

export class ReexportDefaultError extends ReexportErrorBase {
  constructor(modulePath: string, nodes: (es.ModuleDeclaration | es.ExportSpecifier)[]) {
    super(modulePath, nodes)
  }

  public explain(): string {
    return `Multiple default export definitions for the symbol at (${this.sourceString})`
  }

  public elaborate(): string {
    return 'Check that there is only a single default export'
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

export abstract class InvalidFilePathError implements SourceError {
  public type = ErrorType.TYPE
  public severity = ErrorSeverity.ERROR
  public location = UNKNOWN_LOCATION

  constructor(public filePath: string) {}

  abstract explain(): string

  abstract elaborate(): string
}

export class IllegalCharInFilePathError extends InvalidFilePathError {
  public explain() {
    const validNonAlphanumericChars = Object.keys(nonAlphanumericCharEncoding)
      .map(char => `'${char}'`)
      .join(', ')
    return `File path '${this.filePath}' must only contain alphanumeric chars and/or ${validNonAlphanumericChars}.`
  }

  public elaborate() {
    return 'Rename the offending file path to only use valid chars.'
  }
}

export class ConsecutiveSlashesInFilePathError extends InvalidFilePathError {
  public explain() {
    return `File path '${this.filePath}' cannot contain consecutive slashes '//'.`
  }

  public elaborate() {
    return 'Remove consecutive slashes from the offending file path.'
  }
}
