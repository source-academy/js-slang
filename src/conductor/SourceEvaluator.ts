import { BasicEvaluator, type IRunnerPlugin } from '@sourceacademy/conductor/runner';

import createContext from '../createContext';
import { Chapter, Variant } from '../langs';
import { runFilesInContext } from '../index';
import type { Context, Value } from '../types';
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
  private entrypoint = DEFAULT_ENTRYPOINT;

  protected constructor(conductor: IRunnerPlugin, chapter: Chapter) {
    super(conductor);

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

  /** Captures the host's entrypoint name so reported errors carry the right file. */
  override async evaluateFile(fileName: string, fileContent: string): Promise<Value> {
    this.entrypoint = fileName;
    return this.evaluateChunk(fileContent);
  }

  async evaluateChunk(chunk: string): Promise<Value> {
    const path = this.entrypoint;
    try {
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
