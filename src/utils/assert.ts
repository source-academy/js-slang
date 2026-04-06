/*
 * Why not use the nodejs builtin assert? It needs polyfills to work in the browser.
 * With this we have a lightweight assert that doesn't need any further packages.
 * Plus, we can customize our own assert messages and handling
 */

import { InternalRuntimeError } from '../errors/base';
import type { Node } from '../types';

/**
 * Subclass of {@link InternalRuntimeError} thrown by the {@link assert} function.
 */
export class AssertionError extends InternalRuntimeError {
  constructor(explanation: string, node?: Node) {
    super(
      explanation,
      node,
      'Please contact the administrators to let them know that this error has occurred',
    );
  }
}

/**
 * Throws an {@link AssertionError} if the provided condition is false. This error should only be thrown
 * when internal `js-slang` code enters an unexpected state. This should never be thrown by user code.
 */
export default function assert(
  condition: boolean,
  message: string,
  node?: Node,
): asserts condition {
  if (!condition) {
    throw new AssertionError(message, node);
  }
}
