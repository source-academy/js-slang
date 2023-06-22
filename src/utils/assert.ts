/*
 * Why not use the nodejs builtin assert? It needs polyfills to work in the browser.
 * With this we have a lightweight assert that doesn't need any further packages.
 * Plus, we can customize our own assert messages and handling
 */

import { RuntimeSourceError } from '../errors/runtimeSourceError'

export class AssertionError extends RuntimeSourceError {
  constructor(public readonly message: string) {
    super()
  }

  public explain(): string {
    return this.message
  }

  public elaborate(): string {
    return 'Please contact the administrators to let them know that this error has occurred'
  }
}

export default function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message)
  }
}
