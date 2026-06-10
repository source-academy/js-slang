import type { SerializedStepperNode, SerializedStepperStep } from '@sourceacademy/common-stepper';
import { expect, test } from 'vitest';

import createContext from '../../../createContext';
import { Chapter } from '../../../langs';
import { parse } from '../../../parser/parser';
import { getSteps } from '../../../stepper/steppers';
import { serializeSteps } from '../serializeSteps';

function computeSerialized(code: string): SerializedStepperStep[] {
  const context = createContext(Chapter.SOURCE_2);
  const program = parse(code, context);
  if (program === null) throw new Error('parse failed: ' + JSON.stringify(context.errors));
  const steps = getSteps(program, context, { stepLimit: 1000 });
  return serializeSteps(steps);
}

/** Collects every nodeId found anywhere within a serialized step tree. */
function collectNodeIds(value: unknown, ids: Set<string>): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(v => collectNodeIds(v, ids));
    return;
  }
  const node = value as Partial<SerializedStepperNode> & Record<string, unknown>;
  if (typeof node.nodeId === 'string') ids.add(node.nodeId);
  for (const key of Object.keys(node)) collectNodeIds(node[key], ids);
}

test('produces steps with a typed, id-bearing AST for each step', () => {
  const serialized = computeSerialized('1 + 2 * 3;');
  expect(serialized.length).toBeGreaterThan(0);
  for (const step of serialized) {
    expect(typeof step.ast.type).toBe('string');
    expect(typeof step.ast.nodeId).toBe('string');
  }
});

test('every marker redexId resolves to a node within its own step', () => {
  const serialized = computeSerialized('1 + 2 * 3;');
  for (const step of serialized) {
    const ids = new Set<string>();
    collectNodeIds(step.ast, ids);
    for (const marker of step.markers ?? []) {
      if (marker.redexId !== undefined && marker.redexId !== null) {
        expect(ids.has(marker.redexId)).toBe(true);
      }
    }
  }
});

test('output is plain JSON and structured-clone-safe (no cycles, no functions)', () => {
  const serialized = computeSerialized('const f = x => x + 1; f(2) * 3;');
  expect(() => JSON.stringify(serialized)).not.toThrow();
  expect(() => structuredClone(serialized)).not.toThrow();
});

test('reduces 1 + 2 * 3 to 7', () => {
  const serialized = computeSerialized('1 + 2 * 3;');
  // The final value 7 should appear as a Literal somewhere in the (last) steps.
  expect(JSON.stringify(serialized)).toContain('"value":7');
  // First step is the start-of-evaluation marker.
  expect(serialized[0].markers?.[0]?.explanation).toBe('Start of evaluation');
});
