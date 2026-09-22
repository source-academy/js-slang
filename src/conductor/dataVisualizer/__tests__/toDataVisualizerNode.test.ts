import { createRefIdAllocator } from '@sourceacademy/runner-data-visualizer';
import { describe, expect, test } from 'vitest';

import { stringify } from '../../../utils/stringify';
import { toDataVisualizerNode } from '../toDataVisualizerNode';

describe('toDataVisualizerNode', () => {
  test('converts leaf values', () => {
    const refs = createRefIdAllocator();
    expect(toDataVisualizerNode(42, refs)).toEqual({
      type: 'leaf',
      displayValue: stringify(42),
      label: 'number',
    });
    expect(toDataVisualizerNode('hi', refs)).toEqual({
      type: 'leaf',
      displayValue: stringify('hi'),
      label: 'string',
    });
    expect(toDataVisualizerNode(true, refs)).toEqual({
      type: 'leaf',
      displayValue: stringify(true),
      label: 'boolean',
    });
    expect(toDataVisualizerNode(undefined, refs)).toEqual({
      type: 'leaf',
      displayValue: stringify(undefined),
      label: 'undefined',
    });
  });

  test('converts null to the empty-list terminator', () => {
    const refs = createRefIdAllocator();
    expect(toDataVisualizerNode(null, refs)).toEqual({ type: 'empty' });
  });

  test('converts a pair (a length-2 array) to an array node', () => {
    const refs = createRefIdAllocator();
    const pair = [1, 2];
    const node = toDataVisualizerNode(pair, refs);
    expect(node).toEqual({
      type: 'array',
      refId: expect.any(Number),
      children: [
        { type: 'leaf', displayValue: stringify(1), label: 'number' },
        { type: 'leaf', displayValue: stringify(2), label: 'number' },
      ],
    });
  });

  // A §3 array of any other length round-trips the same way — js-slang has no separate pair type,
  // so the host alone (by children.length) decides whether to draw a pair or an n-ary array.
  test('converts a longer array (not fixed at length 2)', () => {
    const refs = createRefIdAllocator();
    const array = [1, 2, 3, 4];
    const node = toDataVisualizerNode(array, refs);
    if (node.type !== 'array') throw new Error('expected an array node');
    expect(node.children).toHaveLength(4);
  });

  test('a self-referential array terminates via a ref node instead of recursing forever', () => {
    const refs = createRefIdAllocator();
    const xs: unknown[] = [1];
    xs.push(xs);

    const node = toDataVisualizerNode(xs, refs);
    if (node.type !== 'array') throw new Error('expected an array node');
    expect(node.children[0]).toEqual({ type: 'leaf', displayValue: stringify(1), label: 'number' });
    expect(node.children[1]).toEqual({ type: 'ref', refId: node.refId });
  });

  test('a shared-but-acyclic array is referenced the second time, not re-walked', () => {
    const refs = createRefIdAllocator();
    const shared = [9];
    const outer = [shared, shared];

    const node = toDataVisualizerNode(outer, refs);
    if (node.type !== 'array') throw new Error('expected an array node');
    const [first, second] = node.children;
    if (first.type !== 'array') {
      throw new Error('expected the first occurrence to be an array node');
    }
    expect(second).toEqual({ type: 'ref', refId: first.refId });
  });

  // A CSE machine `Closure` is also `typeof value === 'function'` (its constructor returns a real
  // Function object with its own prototype swapped in — see toDataVisualizerNode.ts's own doc
  // comment), so this same branch, exercised here with a plain function, covers both the
  // transpiler's and the CSE machine's function values identically.
  test('functions become function nodes, referenced by identity on repeat occurrence', () => {
    const refs = createRefIdAllocator();
    const fn = (x: number) => x + 1;

    const first = toDataVisualizerNode(fn, refs);
    const second = toDataVisualizerNode(fn, refs);
    if (first.type !== 'function') throw new Error('expected a function node');
    expect(first.displayValue).toBe(stringify(fn));
    expect(second).toEqual({ type: 'ref', refId: first.refId });
  });

  test('a plain object (unrecognized in this context) falls back to a leaf rather than throwing', () => {
    const refs = createRefIdAllocator();
    const opaque = { pixels: [1, 2, 3] };
    expect(toDataVisualizerNode(opaque, refs)).toEqual({
      type: 'leaf',
      displayValue: stringify(opaque),
      label: 'object',
    });
  });
});
