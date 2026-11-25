import type { Node } from '../types';
import { stripIndent } from '../utils/formatters';
import { stringify } from '../utils/stringify';
import { RuntimeSourceError } from './base';

export abstract class TimeoutError extends RuntimeSourceError<Node | undefined> {}

/**
 * Raised by the recursion depth guard of the async call wrapper (`callIfFuncAndRightArgsAsync`).
 * There is no time limit to blame: a program that never finishes is stopped by its host.
 */
export class PotentialInfiniteRecursionError extends TimeoutError {
  constructor(
    node: Node,
    private readonly calls: [string, any[]][],
  ) {
    super(node);
    this.calls = this.calls.slice(-3);
  }

  public explain() {
    const formattedCalls = this.calls.map(
      ([executedName, executedArguments]) =>
        `${executedName}(${executedArguments.map(arg => stringify(arg)).join(', ')})`,
    );
    return stripIndent`${'Potential infinite recursion detected'}: ${formattedCalls.join(' ... ')}.`;
  }
}
