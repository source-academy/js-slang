import { describe, expect, test } from 'vitest';

import { SourceStepperEvaluator1, SourceStepperEvaluator2 } from '..';

function fakeConductor(config?: Record<string, unknown>) {
  const output: string[] = [];
  const errors: { message: string; name: string }[] = [];
  const stepCalls: unknown[][] = [];
  return {
    output,
    errors,
    stepCalls,
    plugin: {
      sendOutput: (m: string) => output.push(m),
      sendError: (e: { message: string; name: string }) => errors.push(e),
      sendResult: () => {},
      tryRequestInput: () => undefined,
      requestFile: () => Promise.resolve(config ? JSON.stringify(config) : undefined),
      requestChunk: () => Promise.resolve(''),
      updateStatus: () => {},
      registerPlugin: () => ({
        setStepLimit: () => {},
        sendSteps: (ast: unknown) => {
          stepCalls.push([ast]);
          return Promise.resolve();
        },
      }),
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
