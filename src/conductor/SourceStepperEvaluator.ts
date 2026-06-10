import { STEPPER_DIRECTORY_ID } from '@sourceacademy/common-stepper';
import { ConductorError, EvaluatorSyntaxError } from '@sourceacademy/conductor/common';
import { BasicEvaluator, type IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { RunnerStatus } from '@sourceacademy/conductor/types';

import { parseError, runInContext } from '..';
import createContext from '../createContext';
import { Chapter, Variant } from '../langs';
import { parse } from '../parser/parser';
import { stringify } from '../utils/stringify';
import { SourceStepperRunnerPlugin } from './stepper/SourceStepperRunnerPlugin';

/**
 * A Conductor evaluator for Source that drives the stepper.
 *
 * On construction it registers the {@link SourceStepperRunnerPlugin} (so steps can be produced) and
 * asks the host to load the stepper's web plugin. Each run parses the program, pushes the evaluation
 * steps to the host (for the Stepper tab), runs the program for the REPL result, and emits the
 * status updates the host needs to stop the run spinner and finish the run.
 */
abstract class SourceStepperEvaluatorBase extends BasicEvaluator {
  private readonly chapter: Chapter;
  private readonly stepper: SourceStepperRunnerPlugin;

  protected constructor(conductor: IRunnerPlugin, chapter: Chapter) {
    super(conductor);
    this.chapter = chapter;
    // Register the language-agnostic stepper runner (Source binding) and load its host (web) half.
    this.stepper = conductor.registerPlugin(SourceStepperRunnerPlugin, chapter);
    conductor.hostLoadPlugin(STEPPER_DIRECTORY_ID);
  }

  /**
   * One-shot run: evaluate the entrypoint, then report completion. We override `startEvaluator`
   * (rather than only implementing `evaluateChunk`) so that:
   *  - we emit RUNNING true/false status updates (the host clears the run spinner on RUNNING=false),
   *  - we emit a terminal STOPPED status so the host's evaluation loop completes and tears down, and
   *  - we never let the base class send an `undefined` result (which crashes the host saga channel).
   */
  override async startEvaluator(entryPoint: string): Promise<void> {
    const code = await this.conductor.requestFile(entryPoint);
    if (code === undefined) {
      this.conductor.sendError(new ConductorError('Cannot load entrypoint file'));
    } else {
      await this.runChunk(code);
    }
    // Signal that this run has finished so the host stops waiting and cleans up.
    this.conductor.updateStatus(RunnerStatus.STOPPED, true);
  }

  private async runChunk(chunk: string): Promise<void> {
    this.conductor.updateStatus(RunnerStatus.RUNNING, true);
    try {
      const parseContext = createContext(this.chapter, Variant.DEFAULT);
      const program = parse(chunk, parseContext);
      if (program === null) {
        this.conductor.sendError(new EvaluatorSyntaxError(parseError(parseContext.errors)));
        return;
      }

      // Push evaluation steps to the host for the Stepper tab.
      await this.stepper.sendSteps(program);

      // Run normally so the REPL still shows the program's result. We send a string (never
      // `undefined`) so the result survives the channel and does not break the host's result saga.
      const runContext = createContext(this.chapter, Variant.DEFAULT);
      const result = await runInContext(chunk, runContext);
      if (result.status === 'finished') {
        this.conductor.sendResult(stringify(result.value));
      } else if (result.status === 'error') {
        this.conductor.sendError(new ConductorError(parseError(runContext.errors)));
      }
    } catch (error) {
      this.conductor.sendError(
        error instanceof ConductorError
          ? error
          : new ConductorError(error instanceof Error ? error.message : String(error)),
      );
    } finally {
      this.conductor.updateStatus(RunnerStatus.RUNNING, false);
    }
  }

  // Required by BasicEvaluator. Not used directly (startEvaluator is overridden), but kept correct.
  async evaluateChunk(chunk: string): Promise<void> {
    await this.runChunk(chunk);
  }
}

export class SourceStepperEvaluator1 extends SourceStepperEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, Chapter.SOURCE_1);
  }
}

export class SourceStepperEvaluator2 extends SourceStepperEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, Chapter.SOURCE_2);
  }
}
