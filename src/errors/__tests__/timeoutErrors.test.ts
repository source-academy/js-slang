import { describe, expect, test } from 'vitest';

// Loaded first: the error modules import each other in a cycle that only resolves in this order.
import '../../utils/operators';
import { locationDummyNode } from '../../utils/ast/astCreator';
import { PotentialInfiniteLoopError, PotentialInfiniteRecursionError } from '../timeoutErrors';

const node = locationDummyNode(1, 0, null);

describe('with a finite time limit', () => {
  test('a loop error says the limit will be raised on a rerun', () => {
    const message = new PotentialInfiniteLoopError(node, 1000).explain();
    expect(message).toContain('The time limit will be increased from 1 to');
  });
});

describe('with no time limit (Infinity)', () => {
  test('a recursion error does not promise a raised limit', () => {
    const message = new PotentialInfiniteRecursionError(node, [['f', [1]]], Infinity).explain();
    expect(message).toContain('Potential infinite recursion detected: f(1)');
    expect(message).toContain('recursion depth limit');
    expect(message).not.toContain('Infinity');
    expect(message).not.toContain('increased');
  });
});
