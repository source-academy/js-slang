import { describe, expect, test } from 'vitest';

import { SourceStepperEvaluator1, SourceStepperEvaluator2 } from '..';
import { SourceDataVisualizerRunnerPlugin } from '../dataVisualizer/SourceDataVisualizerRunnerPlugin';

/**
 * `registerPlugin` constructs a *real* `SourceDataVisualizerRunnerPlugin` when asked for one —
 * over a minimal fake channel that just records every message sent — rather than the stepper
 * plugin stand-in every other registration gets here. §2 (only) registers a data visualizer, so
 * a §2 test needs a real one to call `resetRun`/`sendDrawing` on, not the stepper stand-in.
 */
function fakeConductor(config?: Record<string, unknown>) {
  const output: string[] = [];
  const errors: { message: string; name: string }[] = [];
  const stepCalls: unknown[][] = [];
  const dataVisualizerMessages: unknown[] = [];
  return {
    output,
    errors,
    stepCalls,
    dataVisualizerMessages,
    plugin: {
      sendOutput: (m: string) => output.push(m),
      sendError: (e: { message: string; name: string }) => errors.push(e),
      sendResult: () => {},
      tryRequestInput: () => undefined,
      requestFile: () => Promise.resolve(config ? JSON.stringify(config) : undefined),
      requestChunk: () => Promise.resolve(''),
      updateStatus: () => {},
      registerPlugin: (pluginClass: unknown) => {
        if (pluginClass === SourceDataVisualizerRunnerPlugin) {
          const channel = {
            name: '__data_visualizer',
            send: (message: unknown) => dataVisualizerMessages.push(message),
            subscribe: () => {},
            unsubscribe: () => {},
            close: () => {},
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return new SourceDataVisualizerRunnerPlugin({} as any, [channel]);
        }
        return {
          setStepLimit: () => {},
          sendSteps: (ast: unknown) => {
            stepCalls.push([ast]);
            return Promise.resolve();
          },
        };
      },
      hostLoadPlugin: () => Promise.resolve(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

describe('SourceStepperEvaluator', () => {
  test('a valid program is handed to the stepper plugin', async () => {
    const { plugin, stepCalls, errors } = fakeConductor();
    await new SourceStepperEvaluator1(plugin).evaluateChunk('1 + 2;');
    expect(stepCalls.length).toBe(1);
    expect(errors).toEqual([]);
  });

  test('an import is reported clearly instead of crashing the stepper', async () => {
    // getSteps has no converter for import declarations and throws
    // "this.body[0].contractEmpty is not a function", which would reach the user as an
    // internal-looking message with no hint of the cause.
    const { plugin, errors, stepCalls } = fakeConductor();
    await new SourceStepperEvaluator2(plugin).evaluateChunk('import { show } from "rune";\n1 + 1;');
    expect(stepCalls.length).toBe(0);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toMatch(/does not support import and export/);
    expect(errors[0].message).not.toMatch(/contractEmpty/);
  });

  test('a syntax error is reported once and does not reach the stepper', async () => {
    const { plugin, errors, stepCalls } = fakeConductor();
    await new SourceStepperEvaluator1(plugin).evaluateChunk('1 +;');
    expect(stepCalls.length).toBe(0);
    expect(errors.length).toBe(1);
  });
});

// Regression coverage for #2078.
describe('draw_data plugin wiring', () => {
  test('§1 never registers the data visualizer plugin', async () => {
    const { plugin, errors, stepCalls } = fakeConductor();
    await new SourceStepperEvaluator1(plugin).evaluateChunk('1 + 1;');
    // The real assertion is that nothing crashed calling a plugin that was never registered —
    // §1 has no draw_data builtin at all, so there's nothing to call it with here.
    expect(errors).toEqual([]);
    expect(stepCalls.length).toBe(1);
  });

  // draw_data itself does not visibly work through the stepper (see SourceStepperEvaluator.ts's
  // own doc comment on dataVisualizerPlugin — the stepper's symbolic draw_data never calls
  // visualiseList) — this only confirms §2's registration and per-chunk resetRun() don't crash.
  test('§2 registers the plugin without crashing per-chunk resetRun', async () => {
    const { plugin, errors, stepCalls, dataVisualizerMessages } = fakeConductor();
    const evaluator = new SourceStepperEvaluator2(plugin);
    await evaluator.evaluateChunk('1 + 1;');
    await evaluator.evaluateChunk('2 + 2;');
    expect(errors).toEqual([]);
    expect(stepCalls.length).toBe(2);
    expect(dataVisualizerMessages).toEqual([
      { type: 'rows', rows: [] },
      { type: 'rows', rows: [] },
    ]);
  });
});
