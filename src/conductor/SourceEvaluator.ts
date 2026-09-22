import { DATA_VISUALIZER_DIRECTORY_ID } from '@sourceacademy/common-data-visualizer';
import { BasicEvaluator, type IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { ModuleLoaderRunnerPlugin } from '@sourceacademy/runner-module-loader';

import createContext from '../createContext';
import { Chapter, Variant } from '../langs';
import { runFilesInContext } from '../index';
import { parse } from '../parser/parser';
import type { SourceError } from '../errors/base';
import type { Context, Value } from '../types';
import { simple } from '../utils/ast/walkers';
import { callIfFuncAndRightArgsAsync } from '../utils/operators';
import { registerAutoCompletePlugin } from './plugins/autocomplete';
import { SourceDataVisualizerRunnerPlugin } from './dataVisualizer/SourceDataVisualizerRunnerPlugin';
import { isWarning, toConductorError, unknownToConductorError } from './errors';
import { asInterfacableEvaluator, SourceDataHandler } from './modules/SourceDataHandler';
import {
  conductorManifestImporter,
  createConductorBundleImporter,
} from './modules/conductorBundleImporter';

/** Fallback entrypoint path, used only if the host never names one. js-slang validates file paths
 * (`validateFilePath`), so this cannot simply be the empty string. */
const DEFAULT_ENTRYPOINT = '/program.js';

/**
 * Runs Source §1–4 (`Variant.DEFAULT`) under Conductor, on js-slang's transpiler.
 *
 * `evaluateChunk` is the only thing implemented here: as of conductor 0.8.3 `BasicEvaluator`
 * already owns the REPL loop, emits `RunnerStatus.EVAL_READY`/`RUNNING`/`ERROR` around each chunk,
 * and calls `sendResult` with whatever `evaluateChunk` returns — so this class must *return* the
 * program's value rather than sending it, or every run would show up twice in the host's REPL.
 *
 * One `Context` is created per evaluator instance and reused across chunks, so a later REPL entry
 * sees the declarations of an earlier one.
 *
 * ## Modules
 *
 * `import` is wired to Conductor module plugins via `createConductorBundleImporter`, plugged into
 * the *existing* legacy preprocessing pipeline (`preprocessFileImports`, reached through
 * `runFilesInContext`) as its `sourceBundleImporter` — see that importer's own doc for why this is
 * the chosen integration point rather than a parallel one. `dataHandler` (`SourceDataHandler`) is the
 * `IDataHandler` a loaded module's values are read through; it is registered as this evaluator's
 * `IInterfacableEvaluator` half via `asInterfacableEvaluator` so `ModuleLoaderRunnerPlugin` can use
 * both halves as one object, exactly mirroring py-slang's own evaluators.
 *
 * A chunk that imports something — or any chunk after one that did, tracked by
 * `hasEverLoadedAModule` — is transpiled in dual/async mode (`forceAsyncTranspile`), because a name
 * bound in an earlier chunk (a module export, or anything derived from one) may be referenced from a
 * *later* chunk that has no import of its own. This is deliberately coarser than a real reachability
 * analysis — see source-academy/js-slang#2081 — and, in exchange, simple: once a session has touched
 * a module at all, every later chunk stays on the async path for its own remaining lifetime.
 *
 * Known limitation, also recorded in #2081: an import binding survives into a later chunk just like
 * a sync-mode declaration does (`transpiler.ts` deliberately keeps import bindings *outside* the
 * async IIFE, in the same outer, eval-chainable scope sync mode already relies on — they're plain
 * property reads that never need `await`, since the module they name already finished loading before
 * this chunk was transpiled at all). What does *not* survive is a name the chunk's *own code*
 * declares — `let`/`const`/a function defined inside the async IIFE itself — because dual mode has to
 * run that code inside a real async function body for its `await` calls to be legal, and that
 * function's own scope is invisible to a later, separate `eval()` call the way sync mode's bare block
 * scope is not. Reading an *earlier* chunk's own declarations works fine either way; only a later
 * chunk seeing what an async-mode chunk's *own code* just introduced does not.
 */
abstract class SourceEvaluatorBase extends BasicEvaluator {
  private readonly context: Context;
  private readonly chapter: Chapter;
  private readonly dataHandler = new SourceDataHandler();
  private entrypoint = DEFAULT_ENTRYPOINT;

  /** See the class doc's "Modules" section: once true, stays true for the rest of this evaluator's
   * lifetime, forcing every subsequent chunk onto the async transpilation path. */
  private hasEverLoadedAModule = false;

  /** Registered only for §2+ — `draw_data` doesn't exist as a builtin below that, so there's no
   * reason to register the plugin or have the host fetch its web bundle for a §1 user. */
  private readonly dataVisualizerPlugin?: SourceDataVisualizerRunnerPlugin;

  /** Every `set_timeout(f, t)` call still outstanding (see #2025), so `clear_all_timeout()` can
   * cancel them and so `evaluateChunk`'s own `beginPendingWork()`/`endPendingWork()` pair — one per
   * entry here — always balances, however the timer resolves. */
  private readonly pendingTimeoutIds = new Set<ReturnType<typeof setTimeout>>();

  protected constructor(conductor: IRunnerPlugin, chapter: Chapter) {
    super(conductor);
    this.chapter = chapter;
    registerAutoCompletePlugin(conductor, chapter);

    this.conductor.registerPlugin(
      ModuleLoaderRunnerPlugin,
      this.conductor,
      asInterfacableEvaluator(this, this.dataHandler),
    );

    if (chapter >= Chapter.SOURCE_2) {
      this.dataVisualizerPlugin = conductor.registerPlugin(SourceDataVisualizerRunnerPlugin);
      conductor.hostLoadPlugin(DATA_VISUALIZER_DIRECTORY_ID);
    }

    const rawDisplay = (value: Value, str: string) => {
      this.conductor.sendOutput((str === undefined ? '' : str + ' ') + String(value));
      return value;
    };

    this.context = createContext(chapter, Variant.DEFAULT, {}, [], undefined, {
      rawDisplay,
      alert: rawDisplay,
      // js-slang's `prompt` is synchronous (`CustomBuiltIns.prompt` returns `string | null`), so it
      // cannot await the host. `tryRequestInput` is conductor's synchronous counterpart: it hands
      // back input the host has already queued, or `undefined` if there is none right now. There is
      // no way to *block* for input on this engine, so an unattended `prompt()` reads as a
      // cancelled prompt (`null`) rather than hanging the worker.
      prompt: () => this.conductor.tryRequestInput() ?? null,
      visualiseList: values => this.dataVisualizerPlugin?.sendDrawing(values),
      // A compiled Source function already *is* a plain JS closure (mirrors py-slang's Py2JS
      // `set_timeout` — see #2025), so a real `setTimeout` firing later can just call it directly,
      // no cold-re-entry machinery needed. `beginPendingWork`/`endPendingWork` keep the host from
      // tearing this evaluator down while a timer is still outstanding (py-slang#329 documents what
      // goes wrong without that).
      setTimeout: (f: Value, delayMs: number) => {
        this.beginPendingWork();
        const id = setTimeout(() => {
          this.pendingTimeoutIds.delete(id);
          callIfFuncAndRightArgsAsync(f, -1, -1, null, this.context.nativeStorage)
            .catch((e: unknown) => this.conductor.sendError(toConductorError(e as SourceError)))
            .finally(() => this.endPendingWork());
        }, delayMs);
        this.pendingTimeoutIds.add(id);
      },
      clearAllTimeout: () => {
        for (const id of this.pendingTimeoutIds) {
          clearTimeout(id);
          this.endPendingWork();
        }
        this.pendingTimeoutIds.clear();
      },
    });
  }

  /**
   * Captures the host's entrypoint name, so the file js-slang is asked to run is the one the host
   * actually named rather than a constant invented here. It is the map key and the entrypoint
   * argument below; `validateFilePath` and the module preprocessor's resolution both key off it.
   *
   * It deliberately does *not* reach reported errors. `runFilesInContext` defaults
   * `shouldAddFileName` to `Object.keys(files).length > 1` (`src/index.ts:258`), and this evaluator
   * always passes exactly one file, so the linker parses without `sourceFile` and
   * `error.location.source` stays undefined — meaning `toConductorError` renders `1:3: ...` rather
   * than `/program.js:1:3: ...`. That is the wanted behaviour while there is only ever one file:
   * js-slang's own default exists precisely to keep a redundant filename off every single-file
   * diagnostic. When this evaluator grows real multi-file support (local imports, folder mode) it
   * should pass `shouldAddFileName: true` at the same time, because then the filename genuinely
   * disambiguates.
   */
  override async evaluateFile(fileName: string, fileContent: string): Promise<Value> {
    this.entrypoint = fileName;
    return this.evaluateChunk(fileContent);
  }

  /**
   * Warns, once per run, that a `debugger;` statement does nothing on this evaluator.
   *
   * Both pre-existing behaviours were invisible to the user: the legacy `'auto'` execution
   * method silently *switched engines* on seeing a `debugger;` (see `determineExecutionMethod`),
   * while this evaluator pins `'native'` and silently ignores it. A hint is better than either.
   *
   * Only §3/§4 get pointed at the CSE evaluator, because that is the only place one exists — the
   * frontend gates the CSE tab at `chapter >= Chapter.SOURCE_3`. Below that, say what happens and
   * stop there rather than sending the user somewhere that is not in their dropdown.
   *
   * Detection walks the AST rather than the source text, so `"debugger;"` inside a string or a
   * comment does not trigger it. A parse failure here is ignored: the real run reports it.
   */
  private warnIfDebuggerStatement(chunk: string): void {
    let program;
    try {
      // A throwaway context: this parse exists only to look for `debugger;`, and its errors are
      // not the run's. Parsing into `this.context` appended them to the shared array, and
      // `runFilesInContext` then parsed the same chunk again and appended the same errors, so an
      // invalid chunk reported every diagnostic to the host twice.
      program = parse(chunk, createContext(this.chapter, Variant.DEFAULT), {}, false);
    } catch {
      return;
    }
    if (!program) return;

    let found = false;
    simple(program, {
      DebuggerStatement() {
        found = true;
      },
    });
    if (!found) return;

    this.conductor.sendOutput(
      this.chapter >= Chapter.SOURCE_3
        ? 'Note: this evaluator ignores `debugger;`. Select the CSE machine evaluator to step ' +
            'through the program instead.'
        : 'Note: this evaluator ignores `debugger;`.',
    );
  }

  async evaluateChunk(chunk: string): Promise<Value> {
    const path = this.entrypoint;
    try {
      // The Conductor-era equivalent of the old frontend's DataVisualizer.clearWithData() on every
      // Run press — without this, rows from an earlier REPL entry keep accumulating into this one's.
      this.dataVisualizerPlugin?.resetRun();
      this.warnIfDebuggerStatement(chunk);
      const result = await runFilesInContext({ [path]: chunk }, path, this.context, {
        // Pin the engine. The default 'auto' silently switches to the CSE machine when verbose
        // errors are on or the program contains a `debugger;` statement (see
        // `determineExecutionMethod`), which this evaluator does not support. Revisit once the CSE
        // evaluator exists and there is somewhere sensible to switch *to*.
        executionMethod: 'native',
        // See this class's doc on modules: forced on from the first chunk that ever imports
        // anything, and stays on — a later chunk may reference what that one bound.
        forceAsyncTranspile: this.hasEverLoadedAModule,
        importOptions: {
          sourceBundleImporter: createConductorBundleImporter(this.dataHandler),
          // Tabs are a frontend UI concept from the legacy, non-Conductor module panels; Conductor
          // modules don't have them, and there is nothing for this importer to fetch on their
          // behalf. Loading them would just fail (or silently fetch nothing) on every import.
          loadTabs: false,
          // Without this, module *name resolution* (not loading) still hits the network — see
          // conductorManifestImporter's own doc for why a permissive stand-in is correct here, not
          // just convenient for testing.
          resolverOptions: { manifestImporter: conductorManifestImporter },
        },
      });

      // `loadedModules` reflects only *this* run's own imports (`loadSourceModules` replaces it
      // wholesale, from that run's own import graph) — never mixed with an earlier chunk's, so this
      // correctly latches on the first chunk that imports anything and never turns back off.
      this.hasEverLoadedAModule ||=
        Object.keys(this.context.nativeStorage.loadedModules).length > 0;

      this.reportErrors();
      return result.status === 'finished' ? result.value : undefined;
    } catch (e) {
      // runFilesInContext is not expected to throw — it reports through context.errors — so
      // anything landing here is a bug in js-slang or a host failure. Report whatever we have.
      this.reportErrors();
      this.conductor.sendError(unknownToConductorError(e));
      return undefined;
    }
  }

  /**
   * Drains `context.errors`, sending each one to the host. Draining matters as much as sending:
   * the context outlives the chunk, so an undrained error would be re-reported on every subsequent
   * REPL entry.
   */
  private reportErrors(): void {
    const errors = this.context.errors;
    this.context.errors = [];

    for (const error of errors) {
      if (isWarning(error)) {
        // The host renders everything on the error channel in red, which would misrepresent a
        // warning as a failed run.
        this.conductor.sendOutput(error.explain());
      } else {
        this.conductor.sendError(toConductorError(error));
      }
    }
  }
}

export class SourceEvaluator1 extends SourceEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, Chapter.SOURCE_1);
  }
}

export class SourceEvaluator2 extends SourceEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, Chapter.SOURCE_2);
  }
}

export class SourceEvaluator3 extends SourceEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, Chapter.SOURCE_3);
  }
}

export class SourceEvaluator4 extends SourceEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, Chapter.SOURCE_4);
  }
}
