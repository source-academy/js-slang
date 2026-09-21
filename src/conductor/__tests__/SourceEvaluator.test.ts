import { describe, expect, test } from 'vitest';

import { SourceEvaluator1, SourceEvaluator3 } from '..';

/** The slice of `IRunnerPlugin` these evaluators actually touch. */
function fakeConductor() {
  const output: string[] = [];
  const errors: { message: string; name: string }[] = [];
  return {
    output,
    errors,
    plugin: {
      sendOutput: (m: string) => output.push(m),
      sendError: (e: { message: string; name: string }) => errors.push(e),
      sendResult: () => {},
      tryRequestInput: () => undefined,
      requestFile: () => Promise.resolve(undefined),
      requestChunk: () => Promise.resolve(''),
      updateStatus: () => {},
      registerPlugin: () => ({}),
      hostLoadPlugin: () => Promise.resolve(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

describe('SourceEvaluator', () => {
  test('display() output reaches the host', async () => {
    const { plugin, output } = fakeConductor();
    const value = await new SourceEvaluator1(plugin).evaluateChunk('display("hi"); 1 + 1;');
    expect(output).toContain('"hi"');
    expect(value).toBe(2);
  });

  test('a syntax error is sent on the error channel, not stdout', async () => {
    const { plugin, output, errors } = fakeConductor();
    await new SourceEvaluator1(plugin).evaluateChunk('1 +;');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].name).toBe('EvaluatorSyntaxError');
    expect(output).toEqual([]);
  });

  test('a syntax error is reported exactly once', async () => {
    // The debugger-statement check parses the chunk before the run does. Parsing into the shared
    // context appended its diagnostics there, runFilesInContext then parsed again and appended
    // the same ones, and the host received every error twice.
    const { plugin, errors } = fakeConductor();
    await new SourceEvaluator1(plugin).evaluateChunk('1 +;');
    expect(errors.length).toBe(1);
  });

  test('an undeclared name is reported exactly once', async () => {
    const { plugin, errors } = fakeConductor();
    await new SourceEvaluator1(plugin).evaluateChunk('nope();');
    expect(errors.length).toBe(1);
  });

  test('errors do not leak into the next chunk', async () => {
    const { plugin, errors } = fakeConductor();
    const evaluator = new SourceEvaluator1(plugin);
    await evaluator.evaluateChunk('1 +;');
    const afterFirst = errors.length;
    await evaluator.evaluateChunk('1 + 1;');
    expect(errors.length).toBe(afterFirst);
  });

  test('a later chunk sees an earlier chunk’s declarations', async () => {
    const { plugin } = fakeConductor();
    const evaluator = new SourceEvaluator1(plugin);
    await evaluator.evaluateChunk('const y = 41;');
    await expect(evaluator.evaluateChunk('y + 1;')).resolves.toBe(42);
  });

  describe('debugger statement', () => {
    test('§3 points the user at the CSE evaluator', async () => {
      const { plugin, output } = fakeConductor();
      await new SourceEvaluator3(plugin).evaluateChunk('const x = 1;\ndebugger;\nx + 1;');
      expect(output.join('\n')).toMatch(/CSE machine evaluator/);
    });

    test('§1 does not, since no CSE evaluator exists there', async () => {
      const { plugin, output } = fakeConductor();
      await new SourceEvaluator1(plugin).evaluateChunk('const x = 1;\ndebugger;\nx + 1;');
      const joined = output.join('\n');
      expect(joined).toMatch(/ignores `debugger;`/);
      expect(joined).not.toMatch(/CSE machine evaluator/);
    });

    test('`debugger` inside a string does not trigger the hint', async () => {
      const { plugin, output } = fakeConductor();
      await new SourceEvaluator3(plugin).evaluateChunk('const s = "debugger;";\ns;');
      expect(output.join('\n')).not.toMatch(/ignores `debugger;`/);
    });

    test('the program still runs normally', async () => {
      const { plugin } = fakeConductor();
      const value = await new SourceEvaluator3(plugin).evaluateChunk(
        'const x = 1;\ndebugger;\nx + 1;',
      );
      expect(value).toBe(2);
    });
  });
});
