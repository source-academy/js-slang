/**
 * Serialises js-slang's stepper output into the language-agnostic protocol in
 * `@sourceacademy/common-stepper`.
 *
 * Two things do not survive a `MessageChannel` and have to be dealt with here:
 *
 *  - **Methods.** js-slang's stepper AST is made of class instances (`StepperBinaryExpression` and
 *    friends). Their data lives in own enumerable fields and their behaviour on the prototype, so
 *    copying own properties keeps exactly the data and drops exactly the methods.
 *  - **Object identity.** A `Marker` points at its redex *by reference*. The protocol replaces that
 *    with `redexId`, referring to a `nodeId` assigned during this walk.
 */

import type { SerializedMarker, SerializedStepperStep } from '@sourceacademy/common-stepper';

import type { IStepperPropContents, Marker } from '../../stepper';
import { StepperBaseNode } from '../../stepper/interface';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;

/**
 * Serialises one step's tree, recording the id given to each original node object so the step's
 * markers can be resolved afterwards.
 *
 * Ids are assigned per step, in traversal order, and are only meaningful within that step — which
 * is all `SerializedMarker.redexId` promises.
 */
function serializeTree(root: StepperBaseNode): {
  ast: SerializedStepperStep['ast'];
  ids: Map<unknown, string[]>;
} {
  // One node object can sit at several positions in the same tree: substituting a parameter that
  // occurs more than once — `(x => x + x)(1)` — inserts the *same* `StepperLiteral` at every
  // occurrence. So each object maps to *all* the ids it was given, not just the last, otherwise
  // every marker pointing at it would collapse onto whichever occurrence happened to be walked
  // last and the host would highlight that one instead of the intended occurrences.
  const ids = new Map<unknown, string[]>();
  let counter = 0;

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value instanceof StepperBaseNode) {
      const nodeId = `n${counter++}`;
      const existing = ids.get(value);
      if (existing) existing.push(nodeId);
      else ids.set(value, [nodeId]);
      const out: Record<string, unknown> = { nodeId };
      for (const [key, child] of Object.entries(value)) {
        out[key] = walk(child);
      }
      return out;
    }
    if (value && typeof value === 'object') {
      // Plain data hanging off a node: `loc`, `range`, comments. Structured-clone-able already.
      return JSON.parse(JSON.stringify(value)) as unknown;
    }
    // Functions cannot cross the channel; nothing else here should be one, but a stray method
    // would otherwise be silently dropped by JSON and reappear as a missing field.
    return typeof value === 'function' ? undefined : value;
  };

  return { ast: walk(root) as SerializedStepperStep['ast'], ids };
}

/**
 * Resolves a marker's redex reference to ids within the step it belongs to.
 *
 * Returns *one marker per occurrence*. In the original stepper a marker holds a node reference,
 * so a redex substituted into several positions highlights all of them; `SerializedMarker` can
 * only name one id, so the faithful translation is several markers rather than an arbitrary pick.
 *
 * A redex that is not part of this step's own tree yields a single marker with `redexId: null`
 * rather than a dangling id — the protocol allows exactly that, and it beats pointing the host at
 * a node it cannot find. `redexNodeType` is sent regardless, since the host uses it for breakpoint
 * navigation and can no longer dereference the node to read its type.
 */
function serializeMarkers(marker: Marker, ids: Map<unknown, string[]>): SerializedMarker[] {
  const base: SerializedMarker = {};
  if (marker.redexType !== undefined) base.redexType = marker.redexType;
  if (marker.explanation !== undefined) base.explanation = marker.explanation;

  if (!marker.redex) return [{ ...base, redexId: null }];

  const redexNodeType = (marker.redex as AnyNode).type as string;
  const occurrences = ids.get(marker.redex);
  if (!occurrences || occurrences.length === 0) {
    return [{ ...base, redexId: null, redexNodeType }];
  }
  return occurrences.map(redexId => ({ ...base, redexId, redexNodeType }));
}

/** Serialises the whole run. */
export function serializeSteps(steps: IStepperPropContents[]): SerializedStepperStep[] {
  return steps.map(step => {
    const { ast, ids } = serializeTree(step.ast);
    const markers = step.markers?.flatMap(marker => serializeMarkers(marker, ids));
    return markers && markers.length > 0 ? { ast, markers } : { ast };
  });
}
