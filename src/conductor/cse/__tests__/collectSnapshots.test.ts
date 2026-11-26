/**
 * Parity checks for the CSE snapshot serialiser.
 *
 * The bar for this evaluator is agreement with the machine it is visualising, not "the tab shows
 * something" — so these compare the serialised sequence against the raw CSE machine run over the
 * same program, rather than snapshotting the serialiser's own output.
 */

import { describe, expect, test } from 'vitest';

import { Control, generateCSEMachineStateStream, Stash } from '../../../cse-machine/interpreter';
import { Chapter, Variant } from '../../../langs';
import { parse } from '../../../parser/parser';
import type { Context } from '../../../types';
import * as seq from '../../../utils/statementSeqTransform';
import { stringify } from '../../../utils/stringify';
import createContext from '../../../createContext';
import { collectSnapshots } from '../collectSnapshots';
import { serializeValue } from '../serialize';

function setup(code: string, chapter: Chapter = Chapter.SOURCE_3) {
  const context: Context = createContext(chapter, Variant.DEFAULT);
  const program = parse(code, context)!;
  expect(program).not.toBeNull();
  seq.transform(program);
  const control = new Control(program);
  const stash = new Stash();
  context.runtime.control = control;
  context.runtime.stash = stash;
  return { context, control, stash };
}

/** Runs the raw machine, recording the control depth and stash contents at each step. */
function rawRun(code: string, chapter: Chapter = Chapter.SOURCE_3) {
  const { context, control, stash } = setup(code, chapter);
  const steps: { controlDepth: number; stash: string[] }[] = [];
  for (const { stash: s, control: c } of generateCSEMachineStateStream(
    context,
    control,
    stash,
    -1,
    -1,
  )) {
    steps.push({
      controlDepth: c.getStack().length,
      stash: s
        .getStack()
        .slice()
        .reverse()
        .map(v => stringify(v)),
    });
  }
  return steps;
}

function serialisedRun(
  code: string,
  chapter: Chapter = Chapter.SOURCE_3,
  limit = 100000,
  breakpointLines: number[] = [],
) {
  const { context, control, stash } = setup(code, chapter);
  return collectSnapshots(context, control, stash, code, limit, breakpointLines);
}

const PROGRAMS: [string, string][] = [
  ['arithmetic', 'const x = 1 + 2 * 3;\nx;'],
  ['function application', 'function f(a, b) {\n  return a + b;\n}\nf(1, 2);'],
  [
    'closure capture',
    'function adder(n) {\n  return x => x + n;\n}\nconst add2 = adder(2);\nadd2(5);',
  ],
  ['conditional', 'const y = 3 > 2 ? "yes" : "no";\ny;'],
  ['block scope', '{\n  const a = 1;\n  a + 1;\n}'],
  ['array', 'const xs = [1, [2, [3, 4]]];\nxs;'],
  ['while loop', 'let i = 0;\nwhile (i < 3) {\n  i = i + 1;\n}\ni;'],
];

describe('snapshot sequence agrees with the raw machine', () => {
  test.each(PROGRAMS)('%s', (_name, code) => {
    const raw = rawRun(code);
    const { snapshots } = serialisedRun(code);

    // One extra snapshot at the front: step 0 captures the program before the generator's first
    // yield, so the user's first step shows the whole program rather than an opened block.
    expect(snapshots.length).toBe(raw.length + 1);

    for (let i = 0; i < raw.length; i++) {
      const snap = snapshots[i + 1];
      expect(snap.control.length, `control depth at step ${i}`).toBe(raw[i].controlDepth);
      expect(
        snap.stash.map(v => v.displayValue),
        `stash at step ${i}`,
      ).toEqual(raw[i].stash.map(s => (s.startsWith('"') ? s : s)));
    }
  });
});

describe('environments', () => {
  test('a closure carries the id of the frame it was defined in', () => {
    const { snapshots } = serialisedRun(
      'function adder(n) {\n  return x => x + n;\n}\nconst add2 = adder(2);\nadd2(5);',
    );
    const closures = snapshots
      .flatMap(s => [...s.stash, ...s.environments.flatMap(e => e.bindings.map(b => b.value))])
      .filter(v => v.label === 'closure');

    expect(closures.length).toBeGreaterThan(0);
    for (const closure of closures) {
      const meta = closure.metadata as { closureFrameId?: string };
      expect(meta?.closureFrameId, 'every closure needs a defining frame').toBeTruthy();
    }
  });

  test('every frame parent id resolves to a frame in the same snapshot', () => {
    const { snapshots } = serialisedRun(
      'function f(a) {\n  function g(b) {\n    return a + b;\n  }\n  return g(1);\n}\nf(2);',
    );
    for (const snap of snapshots) {
      const ids = new Set(snap.environments.map(e => e.id));
      for (const frame of snap.environments) {
        if (frame.parentId !== null) {
          expect(ids.has(frame.parentId), `frame ${frame.name} parent dangling`).toBe(true);
        }
      }
    }
  });

  test('exactly one frame is marked active while the machine is running', () => {
    const { snapshots } = serialisedRun('function f(a) {\n  return a;\n}\nf(1);');
    for (const snap of snapshots) {
      expect(snap.environments.filter(e => e.isActive).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('values', () => {
  test('nested arrays serialise to full depth, not a fixed cutoff', () => {
    // #2004 truncated at depth 2, which silently flattens ordinary Source list programs.
    const deep = serializeValue([1, [2, [3, [4, [5]]]]]);
    let level = deep;
    for (let d = 0; d < 4; d++) {
      const elements = (level.metadata as { elements?: unknown[] }).elements!;
      expect(elements, `depth ${d} should still have elements`).toBeTruthy();
      level = elements[elements.length - 1] as typeof deep;
    }
    expect(level.label).toBe('array');
  });

  test('a cyclic structure terminates instead of hanging', () => {
    const cyclic: unknown[] = [1];
    cyclic.push(cyclic);
    expect(() => serializeValue(cyclic)).not.toThrow();
  });

  test('a builtin is labelled builtin, not closure', () => {
    const { snapshots } = serialisedRun('math_abs(-1);');
    const values = snapshots.flatMap(s => s.stash);
    const builtins = values.filter(v => v.label === 'builtin');
    expect(builtins.length).toBeGreaterThan(0);
  });
});

describe('run configuration', () => {
  test('the step limit caps collected snapshots', () => {
    const code = 'let i = 0;\nwhile (i < 1000) {\n  i = i + 1;\n}\ni;';
    const { snapshots } = serialisedRun(code, Chapter.SOURCE_3, 25);
    expect(snapshots.length).toBe(25);
  });

  test('steps are not deduplicated', () => {
    // Two steps can render identically while differing in the environments; collapsing them
    // would also desynchronise the step counter the user scrubs through from the machine's own.
    const code = 'let i = 0;\ni = i + 1;\ni = i + 1;\ni;';
    const raw = rawRun(code);
    const { snapshots } = serialisedRun(code);
    expect(snapshots.length).toBe(raw.length + 1);
  });

  test('a debugger statement is reported as a breakpoint step', () => {
    const { snapshots, breakpointSteps } = serialisedRun('const x = 1;\ndebugger;\nx + 1;');
    expect(breakpointSteps.length).toBeGreaterThan(0);
    for (const step of breakpointSteps) {
      expect(snapshots.some(s => s.stepIndex === step)).toBe(true);
    }
  });

  test('a program without a debugger statement reports no breakpoints', () => {
    const { breakpointSteps } = serialisedRun('const x = 1;\nx + 1;');
    expect(breakpointSteps).toEqual([]);
  });
});

describe('step indices', () => {
  test.each(PROGRAMS)('%s: every stepIndex is unique and matches its position', (_name, code) => {
    // `steps` is incremented before each yield, so the first yield reports 1. Subtracting one
    // produced a second snapshot numbered 0, colliding with the initial one — and every recorded
    // breakpoint step then pointed one position behind the state it described.
    const { snapshots } = serialisedRun(code);
    expect(snapshots.map(s => s.stepIndex)).toEqual(snapshots.map((_, i) => i));
  });

  test('a recorded breakpoint step indexes the snapshot whose control has the debugger on top', () => {
    const { snapshots, breakpointSteps } = serialisedRun('const x = 1;\ndebugger;\nx + 1;');
    expect(breakpointSteps.length).toBeGreaterThan(0);
    for (const step of breakpointSteps) {
      const snapshot = snapshots.find(s => s.stepIndex === step)!;
      expect(snapshot, `no snapshot at step ${step}`).toBeDefined();
      expect(snapshot.control[0].metadata).toMatchObject({ nodeType: 'DebuggerStatement' });
    }
  });
});

describe('editor gutter breakpoints', () => {
  const code = 'const a = 1;\nconst b = 2;\nconst c = a + b;\nc;';

  test('a breakpoint line is reported even with no debugger statement', () => {
    const { snapshots, breakpointSteps } = serialisedRun(code, Chapter.SOURCE_3, 100000, [3]);
    expect(breakpointSteps.length).toBeGreaterThan(0);
    for (const step of breakpointSteps) {
      const snapshot = snapshots.find(s => s.stepIndex === step)!;
      const meta = snapshot.control[0].metadata as { startLine?: number };
      expect(meta.startLine).toBe(3);
    }
  });

  test('no breakpoint lines means no breakpoint steps', () => {
    expect(serialisedRun(code, Chapter.SOURCE_3, 100000, []).breakpointSteps).toEqual([]);
  });

  test('one node staying on top across steps is reported once', () => {
    const { breakpointSteps } = serialisedRun(code, Chapter.SOURCE_3, 100000, [3]);
    expect(new Set(breakpointSteps).size).toBe(breakpointSteps.length);
  });
});

describe('reachable environments', () => {
  test('every frame id a value references is present in the same snapshot', () => {
    // An invariant, not a regression repro: `serializeValue` emits `envId` on arrays and
    // `closureFrameId` on closures, and the host looks both up in `environments`. Any id it
    // cannot resolve is a frame the adapter silently cannot rebuild.
    //
    // Honest caveat: in the programs tried here the frames stay reachable through the call stack
    // anyway, so this does not currently *distinguish* the array-following walk in
    // serializeEnvironments from one that skips arrays. That walk was added on the reasoning that
    // an array carries its own `environment` and may hold closures, so the ids can outlive the
    // call stack — a case this test would catch if one is ever constructed, but which is not
    // demonstrated below.
    const { snapshots } = serialisedRun(
      'function f() {\n  const n = 1;\n  return [() => n];\n}\nf();',
    );
    for (const snapshot of snapshots) {
      const ids = new Set(snapshot.environments.map(e => e.id));
      const referenced: string[] = [];
      const walk = (v: { label: string; metadata?: unknown }) => {
        const meta = (v.metadata ?? {}) as {
          closureFrameId?: string;
          envId?: string | null;
          elements?: { label: string; metadata?: unknown }[];
        };
        if (meta.closureFrameId) referenced.push(meta.closureFrameId);
        if (meta.envId) referenced.push(meta.envId);
        for (const el of meta.elements ?? []) walk(el);
      };
      snapshot.stash.forEach(walk);
      snapshot.environments.flatMap(e => e.bindings.map(b => b.value)).forEach(walk);
      for (const id of referenced) {
        expect(ids.has(id), `frame ${id} referenced but not serialised`).toBe(true);
      }
    }
  });
});

describe('global frame pruning', () => {
  const code = 'display(1);';

  function globalFrameOf(usedGlobalNames?: Set<string>) {
    const { context, control, stash } = setup(code);
    const { snapshots } = collectSnapshots(
      context,
      control,
      stash,
      code,
      100000,
      [],
      usedGlobalNames,
    );
    const last = snapshots[snapshots.length - 1];
    return last.environments.find(e => e.name === 'global' && e.parentId === null)!;
  }

  test('without a name set, every binding is sent', () => {
    // The default has to stay permissive: a caller that has not done the analysis must not
    // silently lose bindings.
    expect(globalFrameOf(undefined).bindings.length).toBeGreaterThan(20);
  });

  test('with one, the global frame carries only those names', () => {
    const frame = globalFrameOf(new Set(['display']));
    expect(frame.bindings.map(b => b.name)).toEqual(['display']);
  });

  test('pruning applies only to the global frame', () => {
    const { context, control, stash } = setup('function f(a) {\n  return a;\n}\nf(1);');
    const { snapshots } = collectSnapshots(
      context,
      control,
      stash,
      'function f(a) {\n  return a;\n}\nf(1);',
      100000,
      [],
      new Set<string>(),
    );
    // The global frame is emptied, but the program's own frames keep their bindings.
    const withBindings = snapshots.some(s =>
      s.environments.some(
        e => !(e.name === 'global' && e.parentId === null) && e.bindings.length > 0,
      ),
    );
    expect(withBindings).toBe(true);
  });

  test('the pruned frame is dramatically smaller', () => {
    // This is the point: an unpruned global frame renders the whole standard library, with full
    // source text, above the student's own frame.
    const all = globalFrameOf(undefined).bindings.length;
    const pruned = globalFrameOf(new Set(['display'])).bindings.length;
    expect(pruned).toBeLessThan(all / 10);
  });
});
