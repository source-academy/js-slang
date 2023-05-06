import type {
  ExportAllDeclaration,
  ExportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  Node
} from 'estree'

import { RuntimeSourceError } from '../errors/runtimeSourceError'

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
