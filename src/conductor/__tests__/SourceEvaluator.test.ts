import { WEB_PLUGIN_ID } from '@sourceacademy/common-autocomplete';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SourceEvaluator1, SourceEvaluator2, SourceEvaluator3 } from '..';
import { SourceDataVisualizerRunnerPlugin } from '../dataVisualizer/SourceDataVisualizerRunnerPlugin';
import AutoCompletePlugin from '../plugins/autocomplete';

/** The slice of `IRunnerPlugin` these evaluators actually touch.
 *
 * `registerPlugin` constructs a *real* `SourceDataVisualizerRunnerPlugin` when asked for one —
 * rather than the bare `{}` every other plugin class gets here — over a minimal fake channel that
 * just records every message sent, so a test can assert on what actually reached "the host" through
 * the real `sendDrawing`/`resetRun` methods, not a stand-in.
 */
function fakeConductor() {
  const output: string[] = [];
  const errors: { message: string; name: string }[] = [];
  const dataVisualizerMessages: unknown[] = [];
  const registeredPluginClasses: unknown[] = [];
  const hostLoadedPlugins: unknown[] = [];
  return {
    output,
    errors,
    dataVisualizerMessages,
    registeredPluginClasses,
    hostLoadedPlugins,
    plugin: {
      sendOutput: (m: string) => output.push(m),
      sendError: (e: { message: string; name: string }) => errors.push(e),
      sendResult: () => {},
      tryRequestInput: () => undefined,
      requestFile: () => Promise.resolve(undefined),
      requestChunk: () => Promise.resolve(''),
      updateStatus: () => {},
      registerPlugin: (pluginClass: unknown) => {
        registeredPluginClasses.push(pluginClass);
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
        return {};
      },
      hostLoadPlugin: (id: unknown) => {
        hostLoadedPlugins.push(id);
        return Promise.resolve();
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

describe('SourceEvaluator', () => {
  // Every evaluator now registers AutoCompletePlugin unconditionally (#2079), whose constructor
  // starts a real setInterval pushing mode data to the host. Fake timers keep that interval from
  // actually firing (and leaking across tests) for every test in this file, not just the ones
  // that exercise autocomplete directly.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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

  // Regression coverage for #2078: the data visualizer plugin, wired up through the same
  // `visualiseList` hook createContext.ts already had.
  describe('draw_data', () => {
    test('reaches the data visualizer plugin with every argument, not just the first', async () => {
      const { plugin, dataVisualizerMessages } = fakeConductor();
      await new SourceEvaluator2(plugin).evaluateChunk('draw_data(1, 2, 3);');
      expect(dataVisualizerMessages[dataVisualizerMessages.length - 1]).toEqual({
        type: 'rows',
        rows: [
          [
            { type: 'leaf', displayValue: '1', label: 'number' },
            { type: 'leaf', displayValue: '2', label: 'number' },
            { type: 'leaf', displayValue: '3', label: 'number' },
          ],
        ],
      });
    });

    test('rows do not accumulate across chunks', async () => {
      const { plugin, dataVisualizerMessages } = fakeConductor();
      const evaluator = new SourceEvaluator2(plugin);
      await evaluator.evaluateChunk('draw_data(1);');
      await evaluator.evaluateChunk('draw_data(2);');
      expect(dataVisualizerMessages[dataVisualizerMessages.length - 1]).toEqual({
        type: 'rows',
        rows: [[{ type: 'leaf', displayValue: '2', label: 'number' }]],
      });
    });

    test('§1 never registers the plugin — draw_data is not even a declared name there', async () => {
      const { plugin, errors } = fakeConductor();
      await new SourceEvaluator1(plugin).evaluateChunk('draw_data(1);');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].name).toBe('EvaluatorRuntimeError');
    });
  });

  // Regression coverage for #2025: mirrors py-slang's Py2JS `set_timeout` — a compiled Source
  // function is already a plain JS closure, so a real timer firing later can just call it
  // directly. Every test in this file already runs under `vi.useFakeTimers()` (see the top-level
  // `beforeEach` above), so `vi.advanceTimersByTimeAsync` both fires the timer and flushes the
  // microtasks `callIfFuncAndRightArgsAsync`'s `.catch`/`.finally` chain needs to settle.
  describe('set_timeout / clear_all_timeout', () => {
    test('f runs after the delay, without blocking evaluateChunk', async () => {
      const { plugin, output } = fakeConductor();
      const evaluator = new SourceEvaluator3(plugin);
      const value = await evaluator.evaluateChunk('set_timeout(() => display("late"), 100);');
      expect(value).toBeUndefined();
      expect(output).toEqual([]);
      await vi.advanceTimersByTimeAsync(100);
      expect(output).toContain('"late"');
    });

    test('an error thrown by f is reported, not silently swallowed', async () => {
      // This is the exact bug #2025 exists to retire: the `matrix` module's own hand-rolled
      // `set_timeout` reimplementation drops an uncaught error from its scheduled callback on the
      // floor (source-academy/modules#831).
      const { plugin, errors } = fakeConductor();
      const evaluator = new SourceEvaluator3(plugin);
      await evaluator.evaluateChunk('set_timeout(() => head(null), 10);');
      expect(errors).toEqual([]);
      await vi.advanceTimersByTimeAsync(10);
      expect(errors.length).toBe(1);
      expect(errors[0].name).toBe('EvaluatorRuntimeError');
    });

    test('clear_all_timeout() cancels a pending timer before it fires', async () => {
      const { plugin, output } = fakeConductor();
      const evaluator = new SourceEvaluator3(plugin);
      await evaluator.evaluateChunk('set_timeout(() => display("late"), 100);');
      await evaluator.evaluateChunk('clear_all_timeout();');
      await vi.advanceTimersByTimeAsync(200);
      expect(output).toEqual([]);
    });

    test('is not declared below §3', async () => {
      const { plugin, errors } = fakeConductor();
      await new SourceEvaluator2(plugin).evaluateChunk('set_timeout(() => 1, 10);');
      expect(errors.length).toBe(1);
    });
  });

  // Regression coverage for #2079: every chapter registers the autocomplete plugin, unlike the
  // data visualizer above (§1 has no draw_data, but §1 still wants autocomplete/highlighting).
  test('the autocomplete plugin is registered at every chapter, including §1', () => {
    const { plugin, registeredPluginClasses, hostLoadedPlugins } = fakeConductor();
    new SourceEvaluator1(plugin);
    expect(registeredPluginClasses).toContain(AutoCompletePlugin);
    expect(hostLoadedPlugins).toContain(WEB_PLUGIN_ID);
  });
});
