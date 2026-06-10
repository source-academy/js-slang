import type {
  SerializedMarker,
  SerializedStepperNode,
  SerializedStepperStep,
} from '@sourceacademy/common-stepper';

import type { IStepperPropContents, Marker } from '../../stepper';
import type { StepperBaseNode } from '../../stepper/interface';

/**
 * Node properties that carry source-position / comment metadata. They are not needed by the host
 * renderer and may contain large or self-referential data, so they are dropped during serialization.
 */
const SKIP_KEYS = new Set(['loc', 'range', 'leadingComments', 'trailingComments']);

/**
 * Identifies a js-slang stepper node. Stepper nodes always have a string `type` and the
 * `isContractible` method on their prototype; plain data sub-objects (which we serialize shallowly)
 * do not.
 */
function isStepperNode(value: unknown): value is StepperBaseNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    typeof (value as { isContractible?: unknown }).isContractible === 'function'
  );
}

/**
 * Serializes a single js-slang stepper step into the plain-JSON protocol shared with the host.
 *
 * The host can no longer match markers to nodes by object identity (it is lost when the step
 * crosses the runner/host channel), so every node is given a stable `nodeId` (unique within the
 * step) and each marker's `redex` is mapped to the corresponding node's `redexId`.
 *
 * Serialization is cycle-safe: if a node is encountered while it is still an ancestor on the current
 * traversal path, a child-less `{ type, nodeId }` stub is emitted to break the cycle, guaranteeing
 * the result is a finite tree (JSON- and structured-clone-safe).
 */
function serializeStep(step: IStepperPropContents): SerializedStepperStep {
  let counter = 0;
  const ids = new Map<StepperBaseNode, string>();
  const onPath = new Set<StepperBaseNode>();

  function idOf(node: StepperBaseNode): string {
    let id = ids.get(node);
    if (id === undefined) {
      id = `n${counter++}`;
      ids.set(node, id);
    }
    return id;
  }

  function serializeNode(node: StepperBaseNode): SerializedStepperNode {
    const nodeId = idOf(node);
    if (onPath.has(node)) {
      // Cyclic reference back to an ancestor — emit a stub to keep the output acyclic.
      return { type: node.type, nodeId };
    }
    onPath.add(node);
    const out: SerializedStepperNode = { type: node.type, nodeId };
    for (const key of Object.keys(node)) {
      if (key === 'type' || SKIP_KEYS.has(key)) continue;
      out[key] = serializeValue((node as unknown as Record<string, unknown>)[key]);
    }
    onPath.delete(node);
    return out;
  }

  function serializeValue(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (typeof value === 'function') return undefined;
    if (Array.isArray(value)) return value.map(serializeValue);
    if (isStepperNode(value)) return serializeNode(value);
    // A plain data sub-object: copy its own data properties shallowly.
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (SKIP_KEYS.has(key)) continue;
      out[key] = serializeValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }

  // Serialize the AST first so that every node has an id before markers are resolved.
  const ast = serializeNode(step.ast);

  const serializeMarker = (marker: Marker): SerializedMarker => {
    const out: SerializedMarker = {};
    if (marker.redex) {
      const redexId = ids.get(marker.redex);
      if (redexId !== undefined) out.redexId = redexId;
      out.redexNodeType = marker.redex.type;
    }
    if (marker.redexType !== undefined) out.redexType = marker.redexType;
    if (marker.explanation !== undefined) out.explanation = marker.explanation;
    return out;
  };

  return step.markers
    ? { ast, markers: step.markers.map(serializeMarker) }
    : { ast };
}

/**
 * Serializes the output of js-slang's `getSteps` into the language-agnostic, plain-JSON step
 * protocol consumed by the stepper host plugin.
 */
export function serializeSteps(steps: IStepperPropContents[]): SerializedStepperStep[] {
  return steps.map(serializeStep);
}
