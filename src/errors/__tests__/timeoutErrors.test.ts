import { describe, expect, test } from 'vitest';

// Loaded first: the error modules import each other in a cycle that only resolves in this order.
import '../../utils/operators';
import { locationDummyNode } from '../../utils/ast/astCreator';
import { PotentialInfiniteRecursionError } from '../timeoutErrors';

describe(PotentialInfiniteRecursionError, () => {
  const node = locationDummyNode(1, 0, null);

  test('lists the last three calls and promises no time limit', () => {
    const calls: [string, any[]][] = [
      ['f', [1]],
      ['f', [2]],
      ['f', [3]],
      ['f', [4]],
    ];
    const message = new PotentialInfiniteRecursionError(node, calls).explain();
    expect(message).toBe('Potential infinite recursion detected: f(2) ... f(3) ... f(4).');
  });
});
