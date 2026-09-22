import type { SerializedDataVisualizerNode } from '@sourceacademy/common-data-visualizer';
import type { RefIdAllocator } from '@sourceacademy/runner-data-visualizer';

import type { Value } from '../../types';
import { typeOf } from '../../utils/rttc';
import { stringify } from '../../utils/stringify';

/**
 * Converts one js-slang runtime {@link Value} into a {@link SerializedDataVisualizerNode}. Purely
 * mechanical — dispatches on the value's own JS shape and recurses into array elements. No
 * cycle-detection or pair/list/tree classification happens here; that is entirely the host's job
 * (see `BaseDataVisualizerRunnerPlugin`'s own doc comment in `@sourceacademy/runner-data-visualizer`).
 *
 * Considerably more direct than py-slang's equivalent, which dispatches on a tagged `Value` union:
 * js-slang's runtime values are plain JavaScript, so a pair, a §3 array, `null` and a function are
 * already exactly the shapes below, with nothing to unwrap first.
 *
 * A pair *is* a two-element array — there is no separate pair type — so every array, regardless of
 * length, becomes the wire format's N-ary `"array"` node; the host distinguishes "pair" from "list"
 * by `children.length`, not by tag. A §3 array of length 2 is therefore drawn as a pair too — the
 * pre-Conductor frontend did exactly the same thing, so this is fidelity, not a regression.
 *
 * `Closure` (the CSE machine's function value) is itself `typeof value === 'function'` — its
 * constructor returns a real `Function` object with `Closure.prototype` swapped in (see
 * `cse-machine/closure.ts`'s `Callable`) — so a plain `typeof` check alone already covers both the
 * transpiler's bare JS functions and the CSE machine's `Closure`s, with no `instanceof` needed.
 */
export function toDataVisualizerNode(
  value: Value,
  refs: RefIdAllocator,
): SerializedDataVisualizerNode {
  if (value === null) {
    return { type: 'empty' };
  }

  if (Array.isArray(value)) {
    const { refId, alreadySeen } = refs.get(value);
    if (alreadySeen) {
      return { type: 'ref', refId };
    }
    return {
      type: 'array',
      refId,
      children: value.map(element => toDataVisualizerNode(element, refs)),
    };
  }

  if (typeof value === 'function') {
    const { refId, alreadySeen } = refs.get(value);
    if (alreadySeen) {
      return { type: 'ref', refId };
    }
    // Matches src/conductor/cse/serialize.ts's own use of stringify for a closure in the CSE
    // snapshot, so the same value reads the same way in both tabs.
    return { type: 'function', refId, displayValue: stringify(value) };
  }

  return { type: 'leaf', displayValue: stringify(value), label: typeOf(value) };
}
