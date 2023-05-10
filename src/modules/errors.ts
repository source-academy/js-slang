import type {
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  Node,
  SourceLocation
} from 'estree'
import { UNKNOWN_LOCATION } from '../constants'

import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { ErrorSeverity, ErrorType, SourceError } from '../types'

export class ModuleConnectionError extends RuntimeSourceError {
  private static message: string = `Unable to get modules.`
  private static elaboration: string = `You should check your Internet connection, and ensure you have used the correct module path.`
  constructor(public readonly error?: any, node?: Node) {
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
  constructor(public moduleName: string, node?: Node) {
    super(node)
  }

  public explain() {
    return `Module "${this.moduleName}" not found.`
  }

  public elaborate() {
    return `
      You should check your import declarations, and ensure that all are valid modules.
    `
  }
}

export class ModuleInternalError extends RuntimeSourceError {
  constructor(public moduleName: string, public error?: any, node?: Node) {
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

type SourcedModuleDeclarations =
  | ImportSpecifier
  | ImportDefaultSpecifier
  | ImportNamespaceSpecifier
  | ExportSpecifier
  | ExportAllDeclaration

export abstract class UndefinedImportErrorBase extends RuntimeSourceError {
  constructor(public readonly moduleName: string, node?: SourcedModuleDeclarations) {
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
    node?: ImportSpecifier | ImportDefaultSpecifier | ExportSpecifier
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
    node?: ImportSpecifier | ImportDefaultSpecifier | ExportSpecifier
  ) {
    super(moduleName, node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not contain a default export!`
  }
}
export class UndefinedNamespaceImportError extends UndefinedImportErrorBase {
  constructor(moduleName: string, node?: ImportNamespaceSpecifier | ExportAllDeclaration) {
    super(moduleName, node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not export any symbols!`
  }
}

export class ReexportSymbolError implements SourceError {
  public severity = ErrorSeverity.ERROR
  public type = ErrorType.RUNTIME
  public readonly location: SourceLocation
  private readonly sourceString: string

  constructor(
    public readonly modulePath: string,
    public readonly symbol: string,
    public readonly nodes: (
      | SourcedModuleDeclarations
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
    )[]
  ) {
    this.location = nodes[0].loc ?? UNKNOWN_LOCATION
    this.sourceString = nodes
      .map(({ loc }) => `(${loc!.start.line}:${loc!.start.column})`)
      .join(', ')
  }

  public explain(): string {
    return `Multiple export definitions for the symbol '${this.symbol}' at (${this.sourceString})`
  }

  public elaborate(): string {
    return 'Check that you are not exporting the same symbol more than once'
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