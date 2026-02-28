import type es from 'estree'

import { UNKNOWN_LOCATION } from '../constants'
import { ErrorSeverity, ErrorType, RuntimeSourceError, SourceErrorWithNode } from '../errors/base'
import type { Node } from '../types'
import type { Chapter } from '../langs'
import { getChapterName } from '../utils/misc'
import { nonAlphanumericCharEncoding } from './preprocessor/filePaths'
import type { ModuleDeclarationWithSource } from './moduleTypes'

export class ModuleInternalError extends RuntimeSourceError<ModuleDeclarationWithSource> {
  constructor(
    public readonly moduleName: string,
    node: ModuleDeclarationWithSource,
    public readonly error?: any
  ) {
    super(node)
  }

  public override explain() {
    return `Error(s) occured when executing the module '${this.moduleName}'.`
  }

  public override elaborate() {
    return 'You may need to contact with the author for this module to fix this error.'
  }
}

abstract class ImportError<T extends Node | undefined> extends SourceErrorWithNode<T> {
  type: ErrorType.IMPORT
  severity = ErrorSeverity.ERROR
}

export class ModuleConnectionError extends ImportError<ModuleDeclarationWithSource | undefined> {
  private static message: string = `Unable to get modules.`
  private static elaboration: string = `You should check your Internet connection, and ensure you have used the correct module path.`

  public override explain() {
    return ModuleConnectionError.message
  }

  public override elaborate() {
    return ModuleConnectionError.elaboration
  }
}

export class ModuleNotFoundError extends ImportError<ModuleDeclarationWithSource | undefined> {
  constructor(
    public readonly moduleName: string,
    node?: ModuleDeclarationWithSource
  ) {
    super(node)
  }

  public explain() {
    return `Module '${this.moduleName}' not found.`
  }

  public elaborate() {
    return 'You should check your import declarations, and ensure that all are valid modules.'
  }
}

/**
 * Error thrown when the given module has a chapter restriction and the current
 * evaluation context is not of a high enough chapter
 */
export class WrongChapterForModuleError extends ImportError<
  ModuleDeclarationWithSource | undefined
> {
  constructor(
    public readonly moduleName: string,
    public readonly required: Chapter,
    public readonly actual: Chapter,
    node?: ModuleDeclarationWithSource
  ) {
    super(node)
  }

  public override explain(): string {
    const reqName = getChapterName(this.required)
    const actName = getChapterName(this.actual)
    return `${this.moduleName} needs at least Source chapter ${reqName}, but you are using ${actName}`
  }

  public override elaborate() {
    return this.explain()
  }
}

/**
 * Nodes that directly import and declare an export from another module
 */
type ImportingNodes =
  | Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>
  | es.ImportDeclaration['specifiers'][number]
  | es.ExportSpecifier

/**
 * Error thrown when the module being imported doesn't actually export any symbols
 */
export class UndefinedNamespaceImportError<T extends ImportingNodes> extends ImportError<
  T | undefined
> {
  constructor(
    public readonly moduleName: string,
    node?: T
  ) {
    super(node)
  }

  public override explain() {
    return `'${this.moduleName}' does not export any symbols!`
  }

  public override elaborate() {
    return "Check your imports and make sure what you're trying to import exists!"
  }
}

/**
 * Error thrown when the module being imported doesn't export a symbol with the given name
 */
export class UndefinedImportError extends UndefinedNamespaceImportError<
  es.ImportDeclaration['specifiers'][number] | es.ExportSpecifier
> {
  constructor(
    /**
     * Symbol that is being imported
     */
    public readonly symbol: string,
    moduleName: string,
    node?: es.ImportDeclaration['specifiers'][number] | es.ExportSpecifier
  ) {
    super(moduleName, node)
  }

  public override explain() {
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

  public override explain(): string {
    return `'${this.moduleName}' does not have a default export!`
  }
}

export class CircularImportError extends ImportError<undefined> {
  constructor(public readonly filePathsInCycle: string[]) {
    super(undefined)
  }

  public override explain() {
    // We need to reverse the file paths in the cycle so that the
    // semantics of "'/a.js' -> '/b.js'" is "'/a.js' imports '/b.js'".
    const formattedCycle = this.filePathsInCycle
      .map(filePath => `'${filePath}'`)
      .reverse()
      .join(' -> ')
    return `Circular import detected: ${formattedCycle}.`
  }

  public override elaborate() {
    return 'Break the circular import cycle by removing imports from any of the offending files.'
  }
}

export abstract class InvalidFilePathError extends ImportError<undefined> {
  constructor(public readonly filePath: string) {
    super(undefined)
  }
}

export class IllegalCharInFilePathError extends InvalidFilePathError {
  public override explain() {
    const validNonAlphanumericChars = Object.keys(nonAlphanumericCharEncoding)
      .map(char => `'${char}'`)
      .join(', ')
    return `File path '${this.filePath}' must only contain alphanumeric chars and/or ${validNonAlphanumericChars}.`
  }

  public override elaborate() {
    return 'Rename the offending file path to only use valid chars.'
  }
}

export class ConsecutiveSlashesInFilePathError extends InvalidFilePathError {
  public override explain() {
    return `File path '${this.filePath}' cannot contain consecutive slashes '//'.`
  }

  public override elaborate() {
    return 'Remove consecutive slashes from the offending file path.'
  }
}

export class DuplicateImportNameError extends ImportError<undefined> {
  public readonly locString: string

  public override get location() {
    return this.nodes[0].loc ?? UNKNOWN_LOCATION
  }

  constructor(public readonly nodes: Node[]) {
    super(undefined)

    this.locString = nodes
      .map(({ loc }) => {
        const { source, start } = loc ?? UNKNOWN_LOCATION
        return `(${source ?? 'Unknown File'}:${start.line}:${start.column})`
      })
      .join(', ')
  }

  public override explain() {
    return `Source does not support different imports from Source modules being given the same name. The following are the offending imports: ${this.locString}`
  }

  public override elaborate() {
    return `You cannot have different symbols across different files being given the same declared name, for example: \`import { foo as a } from 'one_module';\` and \`import { bar as a } from 'another_module';
    You also cannot have different symbols from the same module with the same declared name, for example: \`import { foo as a } from 'one_module';\` and \`import { bar as a } from 'one_module'; `
  }
}
