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

export class UndefinedImportError extends RuntimeSourceError {
  constructor(
    public readonly symbol: string,
    public readonly moduleName: string,
    node?: ImportSpecifier | ExportSpecifier
  ) {
    super(node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not contain a definition for '${this.symbol}'`
  }

  public elaborate(): string {
    return "Check your imports and make sure what you're trying to import exists!"
  }
}

export class UndefinedDefaultImportError extends RuntimeSourceError {
  constructor(
    public readonly moduleName: string,
    node?: ImportSpecifier | ImportDefaultSpecifier | ExportSpecifier
  ) {
    super(node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not contain a default export!`
  }

  public elaborate(): string {
    return "Check your imports and make sure what you're trying to import exists!"
  }
}
export class UndefinedNamespaceImportError extends RuntimeSourceError {
  constructor(
    public readonly moduleName: string,
    node?: ImportNamespaceSpecifier | ExportAllDeclaration
  ) {
    super(node)
  }

  public explain(): string {
    return `'${this.moduleName}' does not export any symbols!`
  }

  public elaborate(): string {
    return "Check your imports and make sure what you're trying to import exists!"
  }
}
