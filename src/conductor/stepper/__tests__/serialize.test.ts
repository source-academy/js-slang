/**
 * Parity checks for the stepper serialiser, against js-slang's own `getSteps` rather than against
 * a snapshot of the serialiser's own output.
 */

import { describe, expect, test } from 'vitest';

import createContext from '../../../createContext';
import { Chapter, Variant } from '../../../langs';
import { parse } from '../../../parser/parser';
import { getSteps } from '../../../stepper/steppers';
import type { Context } from '../../../types';
import { serializeSteps } from '../serialize';

const PROGRAMS: [string, string, Chapter][] = [
  ['arithmetic', '1 + 2 * 3;', Chapter.SOURCE_1],
  ['conditional', 'true ? 1 : 2;', Chapter.SOURCE_1],
  ['function application', 'function f(x) {\n  return x + 1;\n}\nf(2);', Chapter.SOURCE_1],
  ['arrow function', 'const g = x => x * 2;\ng(3);', Chapter.SOURCE_1],
  ['higher order', 'const twice = f => x => f(f(x));\ntwice(x => x + 1)(0);', Chapter.SOURCE_1],
  ['list', 'const xs = list(1, 2);\nhead(xs);', Chapter.SOURCE_2],
];

function run(code: string, chapter: Chapter, stepLimit = 200) {
  const context: Context = createContext(chapter, Variant.DEFAULT);
  const program = parse(code, context)!;
  expect(program).not.toBeNull();
  const raw = getSteps(program, context, { stepLimit });
  return { raw, serialized: serializeSteps(raw) };
}

/**
 * How many positions in `root` are occupied by the very same object as `target`.
 *
 * Compares by identity and deliberately does *not* memoise visited objects: the whole point is to
 * count repeats of one object, which a visited-set would collapse to one.
 */
function countOccurrences(root: unknown, target: unknown): number {
  let count = 0;
  const walk = (value: unknown): void => {
    if (value === target) count++;
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(root);
  return count;
}

function collectNodeIds(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach(child => collectNodeIds(child, out));
    return out;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record.nodeId === 'string') out.push(record.nodeId);
    Object.values(record).forEach(child => collectNodeIds(child, out));
  }
  return out;
}

describe('serialised steps agree with js-slang getSteps', () => {
  test.each(PROGRAMS)('%s', (_name, code, chapter) => {
    const { raw, serialized } = run(code, chapter);
    expect(serialized.length).toBe(raw.length);

    for (let i = 0; i < raw.length; i++) {
      expect(serialized[i].ast.type, `node type at step ${i}`).toBe(raw[i].ast.type);
      expect(serialized[i].markers?.length ?? 0, `marker count at step ${i}`).toBe(
        raw[i].markers?.length ?? 0,
      );
      expect(
        (serialized[i].markers ?? []).map(m => m.explanation),
        `explanations at step ${i}`,
      ).toEqual((raw[i].markers ?? []).map(m => m.explanation));
    }
  });
});

describe('protocol invariants', () => {
  test.each(PROGRAMS)('%s: every redexId resolves within its own step', (_name, code, chapter) => {
    const { serialized } = run(code, chapter);
    for (const [i, step] of serialized.entries()) {
      const ids = new Set(collectNodeIds(step.ast));
      for (const marker of step.markers ?? []) {
        if (marker.redexId != null) {
          expect(ids.has(marker.redexId), `step ${i}: redexId ${marker.redexId} dangling`).toBe(
            true,
          );
        }
      }
    }
  });

  test.each(PROGRAMS)('%s: steps survive structured clone', (_name, code, chapter) => {
    // Everything crossing the channel must be plain JSON — class instances with methods do not
    // survive a MessageChannel, and a stray function would be silently dropped.
    const { serialized } = run(code, chapter);
    expect(() => structuredClone(serialized)).not.toThrow();
    expect(structuredClone(serialized)).toEqual(serialized);
  });

  test.each(PROGRAMS)('%s: every node carries a unique nodeId', (_name, code, chapter) => {
    const { serialized } = run(code, chapter);
    for (const step of serialized) {
      const ids = collectNodeIds(step.ast);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('step limit', () => {
  test('a lower limit yields fewer steps', () => {
    const code = 'const twice = f => x => f(f(x));\ntwice(x => x + 1)(0);';
    expect(run(code, Chapter.SOURCE_1, 6).serialized.length).toBeLessThan(
      run(code, Chapter.SOURCE_1, 200).serialized.length,
    );
  });
});

describe('a value substituted at several occurrences', () => {
  // `StepperIdentifier.substitute` inserts the *same* node object at every occurrence of the
  // parameter, so one object genuinely sits at several positions in the tree — confirmed for all
  // three programs below (a `Literal` appearing 2-3 times).
  //
  // Honest scope: measured across these programs, no marker's redex is ever one of those shared
  // objects — every marker redex occupies exactly one position. So the per-occurrence id map is
  // *defensive*: it makes a marker pointing at a shared node highlight every occurrence, which is
  // what the reference stepper does with a node reference, instead of silently collapsing onto
  // whichever occurrence was walked last. These tests pin the invariants (ids unique per position,
  // marker count matching occurrence count, every redexId resolving) rather than demonstrating a
  // failure of the previous behaviour.
  const REPEATED: [string, string][] = [
    ['twice', '(x => x + x)(1);'],
    ['three times', '(x => x * x * x)(2);'],
    ['named function', 'function f(y) {\n  return y + y;\n}\nf(3);'],
  ];

  test.each(REPEATED)('%s: each occurrence gets its own id', (_name, code) => {
    const { serialized } = run(code, Chapter.SOURCE_1);
    for (const step of serialized) {
      const ids = collectNodeIds(step.ast);
      expect(new Set(ids).size, 'ids must stay unique per position').toBe(ids.length);
    }
  });

  test.each(REPEATED)('%s: markers cover every occurrence, not just one', (_name, code) => {
    const { raw, serialized } = run(code, Chapter.SOURCE_1);
    for (const [i, step] of serialized.entries()) {
      const rawMarkers = raw[i].markers ?? [];
      // One serialized marker per occurrence of each redex, so a value substituted into two
      // places is highlighted in both — matching what the reference stepper does with a node
      // reference the renderer matches by identity.
      const expected = rawMarkers.reduce(
        (total, marker) =>
          total + (marker.redex ? Math.max(1, countOccurrences(raw[i].ast, marker.redex)) : 1),
        0,
      );
      expect(step.markers?.length ?? 0, `step ${i}`).toBe(expected);
    }
  });

  test.each(REPEATED)('%s: every redexId still resolves', (_name, code) => {
    const { serialized } = run(code, Chapter.SOURCE_1);
    for (const step of serialized) {
      const ids = new Set(collectNodeIds(step.ast));
      for (const marker of step.markers ?? []) {
        if (marker.redexId != null) expect(ids.has(marker.redexId)).toBe(true);
      }
    }
  });
});
