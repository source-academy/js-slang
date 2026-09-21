import { describe, expect, test } from 'vitest';

import { SourceCseEvaluator3 } from '..';

function fakeConductor(config?: Record<string, unknown>) {
  const output: string[] = [];
  const errors: { message: string; name: string }[] = [];
  const snapshotCalls: { snapshots: unknown[]; breakpointSteps?: number[] }[] = [];
  return {
    output,
    errors,
    snapshotCalls,
    plugin: {
      sendOutput: (m: string) => output.push(m),
      sendError: (e: { message: string; name: string }) => errors.push(e),
      sendResult: () => {},
      tryRequestInput: () => undefined,
      requestFile: () => Promise.resolve(config ? JSON.stringify(config) : undefined),
      requestChunk: () => Promise.resolve(''),
      updateStatus: () => {},
      registerPlugin: () => ({
        sendSnapshots: (snapshots: unknown[], breakpointSteps?: number[]) =>
          snapshotCalls.push({ snapshots, breakpointSteps }),
      }),
      hostLoadPlugin: () => Promise.resolve(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

describe('SourceCseEvaluator', () => {
  test('a runtime error is reported exactly once, with its location', async () => {
    // handleRuntimeError both pushes onto context.errors and throws, so the catch used to send
    // the drained diagnostic *and* the thrown value — the second without any location.
    const { plugin, errors } = fakeConductor();
    await new SourceCseEvaluator3(plugin).evaluateChunk('1 + "a";');
    expect(errors.length).toBe(1);
    expect(errors[0].message).toMatch(/^\d+:\d+:/);
  });

  test('gutter breakpoint lines from the host reach the plugin', async () => {
    const { plugin, snapshotCalls } = fakeConductor({ breakpointLines: [3] });
    await new SourceCseEvaluator3(plugin).evaluateChunk(
      'const a = 1;\nconst b = 2;\nconst c = a + b;\nc;',
    );
    expect(snapshotCalls.length).toBe(1);
    expect(snapshotCalls[0].breakpointSteps!.length).toBeGreaterThan(0);
  });

  test('the host step limit caps what is sent', async () => {
    const { plugin, snapshotCalls } = fakeConductor({ stepLimit: 12 });
    await new SourceCseEvaluator3(plugin).evaluateChunk(
      'let i = 0;\nwhile (i < 100) {\n  i = i + 1;\n}\ni;',
    );
    expect(snapshotCalls[0].snapshots.length).toBe(12);
  });
});

describe('prelude', () => {
  // map/filter/accumulate are defined in Source (context.prelude), not as native builtins, so
  // they exist only after the prelude has been evaluated. This evaluator drives the machine
  // directly rather than through runFilesInContext, so it has to run the prelude itself —
  // without that, every prelude name raised UndefinedVariableError in the CSE tab.
  test.each([
    ['map', 'map(x => x + 1, list(1, 2));'],
    ['accumulate', 'accumulate((a, b) => a + b, 0, list(1, 2, 3));'],
    ['filter', 'filter(x => x > 1, list(1, 2, 3));'],
  ])('%s resolves', async (_name, code) => {
    const { plugin, errors } = fakeConductor();
    await new SourceCseEvaluator3(plugin).evaluateChunk(code);
    expect(errors.map(e => e.message)).toEqual([]);
  });

  test('the prelude is not stepped through: snapshots start at the user program', async () => {
    const { plugin, snapshotCalls } = fakeConductor();
    await new SourceCseEvaluator3(plugin).evaluateChunk('1 + 1;');
    // A few steps for a one-line program, not the hundreds the prelude would add.
    expect(snapshotCalls[0].snapshots.length).toBeLessThan(30);
  });

  test('it runs once, not per chunk', async () => {
    const { plugin, errors } = fakeConductor();
    const evaluator = new SourceCseEvaluator3(plugin);
    await evaluator.evaluateChunk('map(x => x, list(1));');
    await evaluator.evaluateChunk('accumulate((a, b) => a + b, 0, list(1, 2));');
    expect(errors.map(e => e.message)).toEqual([]);
  });
});
