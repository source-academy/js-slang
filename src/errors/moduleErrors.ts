/* tslint:disable: max-classes-per-file */
import { RuntimeSourceError } from './runtimeSourceError'
import { Node } from '../types'

export class ModuleConnectionError extends RuntimeSourceError {
  private static message: string = `Unable to get modules.`
  private static elaboration: string = `You should check your Internet connection, and ensure you have used the correct module path.`
  constructor(node?: Node) {
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
