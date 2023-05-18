import type { ImportDeclaration } from 'estree'

import { RuntimeSourceError } from '../errors/runtimeSourceError'

export class UndefinedImportError extends RuntimeSourceError {
  constructor(
    public readonly symbol: string,
    public readonly moduleName: string,
    node?: ImportDeclaration
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
