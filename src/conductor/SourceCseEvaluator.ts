import { CSE_DIRECTORY_ID } from '@sourceacademy/common-cse-machine';
import { DATA_VISUALIZER_DIRECTORY_ID } from '@sourceacademy/common-data-visualizer';
import { BasicEvaluator, type IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { CseMachinePlugin } from '@sourceacademy/runner-cse-machine';

import createContext from '../createContext';
import { Chapter, Variant } from '../langs';
import { Control, evaluate as cseEvaluate, Stash } from '../cse-machine/interpreter';
import { parse } from '../parser/parser';
import type { SourceError } from '../errors/base';
import type { Context, Value } from '../types';
import * as seq from '../utils/statementSeqTransform';
import { collectSnapshots } from './cse/collectSnapshots';
import { collectUsedGlobalNames } from './cse/usedGlobals';
import { DEFAULT_STEP_LIMIT, fetchRunConfig } from './cse/runConfig';
import { registerAutoCompletePlugin } from './plugins/autocomplete';
import { SourceDataVisualizerRunnerPlugin } from './dataVisualizer/SourceDataVisualizerRunnerPlugin';
import { isWarning, toConductorError, unknownToConductorError } from './errors';

/**
 * Runs Source §3–§4 on the CSE machine and ships a snapshot per step to the host's CSE tab.
 *
 * Only §3 and §4: the frontend gates the tab at `chapter >= Chapter.SOURCE_3`
 * (`ApplicationTypes.ts:245`), and under Conductor shows it when the language offers an evaluator
 * carrying `EvaluatorCapability.CSE`. §1/§2 therefore have no CSE evaluator, matching Python's
 * `python3Cse`/`python4Cse`.
 *
 * The machine runs **synchronously** — see `cse/collectSnapshots.ts` for why that is the right
 * call for js-slang specifically, where the CSE machine is the visualiser rather than the
 * workhorse.
 *
 * ## Known divergence: the empty list
 *
 * `serializeValue` labels Source's `null` as `empty_list` rather than `null`, because the host
 * adapter maps the label `null` to a Python `None` stand-in
 * (`CseSnapshotAdapter.ts`, the `nonetype|none|null` branch) — wrong for Source, and it also
 * suppresses the empty-list visual the Source renderer has. `empty_list` is not a label the
 * adapter knows, so it currently falls through to the string fallback. Rendering the empty list
 * correctly needs a small frontend change to map this label to a real `null`; until then this is
 * a visible difference from the non-conductor tab.
 *
 * ## Known divergence: the global frame
 *
 * js-slang puts every builtin in the *global environment's* `head` (`defineBuiltin`), so the
 * global frame legitimately carries ~40 bindings. py-slang's global frame is empty — its builtins
 * live in `nativeStorage` — and the host adapter was written against that shape: it injects a
 * `Config.GlobalFrameDefaultText` (`:::pre-declared names::`) sentinel binding into whatever
 * frame is named `global`. For js-slang that sentinel is spurious and shows up as an extra row
 * above the real builtins.
 *
 * Confirmed live: the CSE tab renders, steps and scrubs correctly, and the global frame lists the
 * builtins. What has *not* been confirmed is whether the non-conductor tab renders that frame
 * identically — the deployment pins `conductor.enable`, so a side-by-side was not possible from
 * here. Until someone compares the two directly, treat the global frame as the one part of this
 * evaluator whose parity is unverified rather than established.
 */
abstract class SourceCseEvaluatorBase extends BasicEvaluator {
  private readonly chapter: Chapter;
  private readonly csePlugin: CseMachinePlugin;
  private context: Context;
  private preludeRun = false;

  // Unconditional, unlike the transpiler/stepper evaluators' own gating: this class only ever
  // instantiates for §3/§4 (SourceCseEvaluator3/4 below), both of which are >= Chapter.SOURCE_2.
  private readonly dataVisualizerPlugin: SourceDataVisualizerRunnerPlugin;

  protected constructor(conductor: IRunnerPlugin, chapter: Chapter) {
    super(conductor);
    this.chapter = chapter;
    registerAutoCompletePlugin(conductor, chapter);
    this.dataVisualizerPlugin = conductor.registerPlugin(SourceDataVisualizerRunnerPlugin);
    conductor.hostLoadPlugin(DATA_VISUALIZER_DIRECTORY_ID);
    this.context = this.freshContext();
    this.csePlugin = conductor.registerPlugin(CseMachinePlugin);
    void conductor.hostLoadPlugin(CSE_DIRECTORY_ID);
  }

  private freshContext(): Context {
    const rawDisplay = (value: Value, str: string) => {
      this.conductor.sendOutput((str === undefined ? '' : str + ' ') + String(value));
      return value;
    };
    return createContext(this.chapter, Variant.DEFAULT, {}, [], undefined, {
      rawDisplay,
      alert: rawDisplay,
      prompt: () => this.conductor.tryRequestInput() ?? null,
      visualiseList: values => this.dataVisualizerPlugin.sendDrawing(values),
    });
  }

  /**
   * Runs the chapter's prelude once, before the first chunk.
   *
   * `map`, `filter`, `accumulate` and the rest of the list library are defined in Source itself
   * (`context.prelude`), not as native builtins, so they only exist after the prelude has been
   * evaluated into the context. `runFilesInContext` does this for the transpiler evaluator; this
   * evaluator drives the machine directly and so has to do it itself. Without it, every prelude
   * name raises `UndefinedVariableError` in the CSE tab.
   *
   * The prelude runs to completion outside the snapshot stream: the student is stepping through
   * *their* program, and prepending several hundred steps of library setup would bury it.
   */
  private ensurePreludeRun(): void {
    if (this.preludeRun) return;
    this.preludeRun = true;
    const prelude = this.context.prelude;
    if (prelude === null) return;
    this.context.prelude = null;

    const program = parse(prelude, this.context);
    if (program === null) return;
    cseEvaluate(program, this.context, {
      isPrelude: true,
      envSteps: -1,
      stepLimit: Number.MAX_SAFE_INTEGER,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  async evaluateChunk(chunk: string): Promise<Value> {
    try {
      // The Conductor-era equivalent of the old frontend's DataVisualizer.clearWithData() on every
      // Run press — without this, rows from an earlier REPL entry keep accumulating into this one's.
      this.dataVisualizerPlugin.resetRun();
      this.ensurePreludeRun();
      const program = parse(chunk, this.context);
      if (program === null) {
        this.reportErrors();
        return undefined;
      }
      // The CSE machine works over StatementSequence rather than bare statement lists; the
      // non-conductor path applies the same transform before handing a program to the machine.
      seq.transform(program);

      const control = new Control(program);
      const stash = new Stash();
      this.context.runtime.control = control;
      this.context.runtime.stash = stash;

      const config = await fetchRunConfig(this.conductor);
      const maxSnapshots = config.stepLimit ?? DEFAULT_STEP_LIMIT;

      // Prune the global frame to the names this program touches. js-slang keeps every builtin in
      // the global environment's own head, so an unpruned frame renders the whole standard library
      // — with full source text — above the student's own frame. See cse/usedGlobals.ts and
      // source-academy/frontend#4401.
      const globalEnv = this.context.runtime.environments.find(env => env.tail === null);
      const preludeEnv = this.context.runtime.environments.find(env => env.name === 'prelude');
      const usedGlobalNames = globalEnv
        ? collectUsedGlobalNames(program, globalEnv.head, preludeEnv?.head)
        : undefined;

      const { snapshots, breakpointSteps } = collectSnapshots(
        this.context,
        control,
        stash,
        chunk,
        maxSnapshots,
        config.breakpointLines ?? [],
        usedGlobalNames,
      );

      this.csePlugin.sendSnapshots(snapshots, breakpointSteps);
      this.reportErrors();

      const items = stash.getStack();
      return items[items.length - 1];
    } catch (e) {
      // `handleRuntimeError` both pushes onto `context.errors` *and* throws, so a Source runtime
      // error arrives here already drained and reported by the line below. Sending the thrown
      // value too would show the user the same failure twice, the second time as a generic
      // message with no location.
      const reported = this.reportErrors();
      if (!reported.includes(e as never)) {
        this.conductor.sendError(unknownToConductorError(e));
      }
      return undefined;
    }
  }

  /** Same contract as the transpiler evaluator's: drain, so an error cannot be re-reported on
   * every later chunk, and route warnings to stdout since the host renders `__error` in red. */
  private reportErrors(): SourceError[] {
    const errors = this.context.errors;
    this.context.errors = [];
    for (const error of errors) {
      if (isWarning(error)) {
        this.conductor.sendOutput(error.explain());
      } else {
        this.conductor.sendError(toConductorError(error));
      }
    }
    return errors;
  }
}

export class SourceCseEvaluator3 extends SourceCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, Chapter.SOURCE_3);
  }
}

export class SourceCseEvaluator4 extends SourceCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, Chapter.SOURCE_4);
  }
}
