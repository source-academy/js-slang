import { BasicEvaluator, type IRunnerPlugin } from '@sourceacademy/conductor/runner';

import createContext from '../createContext';
import { Chapter, Variant } from '../langs';
import { runFilesInContext } from '../index';
import { parse } from '../parser/parser';
import type { Context, Value } from '../types';
import { simple } from '../utils/ast/walkers';
import { isWarning, toConductorError, unknownToConductorError } from './errors';

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
 */
abstract class SourceEvaluatorBase extends BasicEvaluator {
  private readonly context: Context;
  private readonly chapter: Chapter;
  private entrypoint = DEFAULT_ENTRYPOINT;

  protected constructor(conductor: IRunnerPlugin, chapter: Chapter) {
    super(conductor);
    this.chapter = chapter;

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
      visualiseList: () => {
        throw new Error('draw_data is not supported by this evaluator.');
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
      this.warnIfDebuggerStatement(chunk);
      const result = await runFilesInContext({ [path]: chunk }, path, this.context, {
        // Pin the engine. The default 'auto' silently switches to the CSE machine when verbose
        // errors are on or the program contains a `debugger;` statement (see
        // `determineExecutionMethod`), which this evaluator does not support. Revisit once the CSE
        // evaluator exists and there is somewhere sensible to switch *to*.
        executionMethod: 'native',
      });

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
