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
