import { DataType, type IDataHandler, type TypedValue } from '@sourceacademy/conductor/types';
import { ModuleLoaderRunnerPlugin } from '@sourceacademy/runner-module-loader';
import { afterEach, describe, expect, test } from 'vitest';

import type { IModuleExport, IModulePlugin } from '@sourceacademy/conductor/module';

import { SourceEvaluator2 } from '..';

const num = (value: number): TypedValue<DataType.NUMBER> => ({ type: DataType.NUMBER, value });

/**
 * Same shape as `SourceEvaluator.test.ts`'s `fakeConductor`, plus one addition: `registerPlugin`
 * captures the `evaluator` argument `SourceEvaluator` passes when it registers
 * `ModuleLoaderRunnerPlugin` (`asInterfacableEvaluator(this, this.dataHandler)`, a proxy forwarding
 * `IDataHandler` calls to the evaluator's own, private `SourceDataHandler`). Every `TypedValue`
 * identifier is only valid against the *specific* handler instance that allocated it, so a test
 * module wanting to hand back a closure — not just a plain value — has to build it through this
 * captured proxy, exactly as a real module plugin would build it through the evaluator's own
 * `IDataHandler`, rather than through some other, unrelated `SourceDataHandler`.
 */
function fakeConductor() {
  const output: string[] = [];
  const errors: { message: string; name: string }[] = [];
  let capturedDataHandler: IDataHandler | undefined;
  return {
    output,
    errors,
    getDataHandler: () => {
      if (!capturedDataHandler) throw new Error('registerPlugin was never called');
      return capturedDataHandler;
    },
    plugin: {
      sendOutput: (m: string) => output.push(m),
      sendError: (e: { message: string; name: string }) => errors.push(e),
      sendResult: () => {},
      tryRequestInput: () => undefined,
      requestFile: () => Promise.resolve(undefined),
      requestChunk: () => Promise.resolve(''),
      updateStatus: () => {},
      registerPlugin: (_pluginClass: unknown, ...args: unknown[]) => {
        // registerPlugin(ModuleLoaderRunnerPlugin, conductor, evaluator) — the evaluator (which
        // also satisfies IDataHandler via the proxy) is always the last argument.
        capturedDataHandler = args[args.length - 1] as IDataHandler;
        return {};
      },
      hostLoadPlugin: () => Promise.resolve(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

describe('SourceEvaluator modules', () => {
  afterEach(() => {
    ModuleLoaderRunnerPlugin.instance = null;
  });

  test('a plain value export is importable and usable', async () => {
    ModuleLoaderRunnerPlugin.instance = {
      // eslint-disable-next-line @typescript-eslint/require-await
      requestModule: async (name: string) => {
        expect(name).toBe('fake_module');
        const exports: IModuleExport[] = [{ symbol: 'the_answer', value: num(42) }];
        return {
          id: 'fake',
          exports,
          evaluator: undefined,
          initialise: () => {},
        } as unknown as IModulePlugin;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const { plugin, errors } = fakeConductor();
    const evaluator = new SourceEvaluator2(plugin);
    const value = await evaluator.evaluateChunk(
      'import { the_answer } from "fake_module"; the_answer;',
    );

    expect(errors).toEqual([]);
    expect(value).toBe(42);
  });

  // The point of the whole design: a module's *closure* export is callable from Source, with its
  // argument and result round-tripping through the evaluator's own SourceDataHandler — the actual
  // async spine (source-academy/js-slang#2081), not just a name binding.
  test('a module closure is callable, awaiting through the trampoline, argument and result round-tripping', async () => {
    const { plugin, errors, getDataHandler } = fakeConductor();
    // Constructing the evaluator first is what makes registerPlugin fire, capturing the data
    // handler this evaluator will actually resolve identifiers against.
    const evaluator = new SourceEvaluator2(plugin);
    const dh = getDataHandler();

    // ExternCallable is an async generator by contract; this closure's own work is synchronous.
    const doubleTyped = await dh.closure_make(
      { args: [DataType.NUMBER], returnType: DataType.NUMBER },
      // eslint-disable-next-line @typescript-eslint/require-await
      async function* (a: TypedValue<DataType.NUMBER>) {
        return num(a.value * 2);
      },
    );

    ModuleLoaderRunnerPlugin.instance = {
      // eslint-disable-next-line @typescript-eslint/require-await
      requestModule: async () => {
        const exports: IModuleExport[] = [{ symbol: 'double', value: doubleTyped }];
        return {
          id: 'fake',
          exports,
          evaluator: dh,
          initialise: () => {},
        } as unknown as IModulePlugin;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const value = await evaluator.evaluateChunk(
      'import { double } from "fake_module"; double(21);',
    );

    expect(errors).toEqual([]);
    expect(value).toBe(42);
  });

  // A module closure calling *back* into a Source-defined function — the other direction of the
  // same round trip, via sourceToModule's CLOSURE case.
  test('a module can call back into a Source-defined closure', async () => {
    const { plugin, errors, getDataHandler } = fakeConductor();
    const evaluator = new SourceEvaluator2(plugin);
    const dh = getDataHandler();

    // apply_twice(f, x) calls the Source closure f it's handed, exactly as a module like `curve`
    // calling a student's custom shape function would.
    const applyTwiceTyped = await dh.closure_make(
      { args: [DataType.CLOSURE, DataType.NUMBER], returnType: DataType.NUMBER },
      async function* (f: TypedValue<DataType.CLOSURE>, x: TypedValue<DataType.NUMBER>) {
        const once = await drive(dh.closure_call(f, [x], DataType.NUMBER));
        return drive(dh.closure_call(f, [once], DataType.NUMBER));
      },
    );

    ModuleLoaderRunnerPlugin.instance = {
      // eslint-disable-next-line @typescript-eslint/require-await
      requestModule: async () => {
        const exports: IModuleExport[] = [{ symbol: 'apply_twice', value: applyTwiceTyped }];
        return {
          id: 'fake',
          exports,
          evaluator: dh,
          initialise: () => {},
        } as unknown as IModulePlugin;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const value = await evaluator.evaluateChunk(
      'import { apply_twice } from "fake_module"; apply_twice(x => x + 10, 1);',
    );

    expect(errors).toEqual([]);
    expect(value).toBe(21); // 1 -> 11 -> 21
  });

  // Cross-chunk: a name a later, non-importing chunk uses must still resolve, once
  // hasEverLoadedAModule has latched on — the coarser-than-strictly-necessary gate this evaluator
  // uses (see SourceEvaluator's own class doc).
  test('a later chunk with no import of its own can still use an earlier import', async () => {
    const { plugin, errors } = fakeConductor();
    ModuleLoaderRunnerPlugin.instance = {
      // eslint-disable-next-line @typescript-eslint/require-await
      requestModule: async () => {
        const exports: IModuleExport[] = [{ symbol: 'the_answer', value: num(42) }];
        return {
          id: 'fake',
          exports,
          evaluator: undefined,
          initialise: () => {},
        } as unknown as IModulePlugin;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const evaluator = new SourceEvaluator2(plugin);
    await evaluator.evaluateChunk('import { the_answer } from "fake_module";');
    const value = await evaluator.evaluateChunk('the_answer + 1;');

    expect(errors).toEqual([]);
    expect(value).toBe(43);
  });
});

async function drive<T>(gen: AsyncGenerator<void, T, undefined>): Promise<T> {
  let step = await gen.next();
  while (!step.done) step = await gen.next();
  return step.value;
}
