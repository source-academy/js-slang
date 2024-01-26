import type * as es from 'estree'

import { UNKNOWN_LOCATION } from '../constants'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { ErrorSeverity, ErrorType, SourceError } from '../types'
import { nonAlphanumericCharEncoding } from './preprocessor/filePaths'

export class ModuleInternalError extends RuntimeSourceError {
  constructor(public moduleName: string, public error?: any, node?: es.Node) {
    super(node)
  }

  public explain() {
    return `Error(s) occured when executing the module '${this.moduleName}'.`
  }

  public elaborate() {
    return 'You may need to contact with the author for this module to fix this error.'
  }
}

abstract class ImportError implements SourceError {
  public type: ErrorType.IMPORT
  public severity = ErrorSeverity.ERROR
  public get location() {
    return this.node?.loc ?? UNKNOWN_LOCATION
  }

  constructor(public node?: es.Node) {}

  public abstract explain(): string
  public abstract elaborate(): string
}

export class ModuleConnectionError extends ImportError {
  private static message: string = `Unable to get modules.`
  private static elaboration: string = `You should check your Internet connection, and ensure you have used the correct module path.`
  constructor(node?: es.Node) {
    super(node)
  }

  public explain() {
    return ModuleConnectionError.message
  }

  public elaborate() {
    return ModuleConnectionError.elaboration
  }
}

export class ModuleNotFoundError extends ImportError {
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

export class UndefinedNamespaceImportError extends ImportError {
  constructor(
    public readonly moduleName: string,
    node?:
      | Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>
      | es.ImportDeclaration['specifiers'][number]
      | es.ExportSpecifier
  ) {
    super(node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not export any symbols!`
  }

  public elaborate(): string {
    return `
      Check your imports and make sure what you're trying to import exists!
      Hint: Exports of the form \`export * from "./a.js"\` do not reexport default exports!
    `
  }
}

export class UndefinedImportError extends UndefinedNamespaceImportError {
  constructor(
    public readonly symbol: string,
    moduleName: string,
    node?: es.ImportDeclaration['specifiers'][number] | es.ExportSpecifier
  ) {
    super(moduleName, node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not contain a definition for '${this.symbol}'`
  }
}

export class UndefinedDefaultImportError extends UndefinedImportError {
  constructor(
    moduleName: string,
    node?: es.ImportDeclaration['specifiers'][number] | es.ExportSpecifier
  ) {
    super('default', moduleName, node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not have a default export!`
  }
}

export class CircularImportError extends ImportError {
  constructor(public filePathsInCycle: string[]) {
    super()
  }

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

export abstract class InvalidFilePathError extends ImportError {
  constructor(public filePath: string) {
    super()
  }

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

export class DuplicateImportNameError extends ImportError {
  public readonly locString: string

  public get location() {
    return this.nodes[0].loc ?? UNKNOWN_LOCATION
  }

  constructor(public readonly name: string, public readonly nodes: es.Node[]) {
    super()

    this.locString = nodes
      .map(({ loc }) => {
        const { source, start } = loc ?? UNKNOWN_LOCATION
        return `(${source ?? 'Unknown File'}:${start.line}:${start.column})`
      })
      .join(', ')
  }

  public explain() {
    return `Source does not support different imports from Source modules being given the same name. The following are the offending imports: ${this.locString}`
  }

  public elaborate() {
    return `You cannot have different symbols across different files being given the same declared name, for example: \`import { foo as a } from 'one_module';\` and \`import { bar as a } from 'another_module';
    You also cannot have different symbols from the same module with the same declared name, for example: \`import { foo as a } from 'one_module';\` and \`import { bar as a } from 'one_module'; `
  }
}
