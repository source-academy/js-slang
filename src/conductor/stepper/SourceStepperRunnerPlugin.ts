import type { SerializedStepperStep, TraceEnd } from '@sourceacademy/common-stepper';
import { checkIsPluginClass, type IChannel, type IConduit } from '@sourceacademy/conductor/conduit';
import { BaseStepperRunnerPlugin, type StepBatches } from '@sourceacademy/runner-stepper';
import type es from 'estree';

import type { IStepperPropContents } from '../../stepper';
import { generateSteps, getSteps } from '../../stepper/steppers';
import type { Context } from '../../types';
import { serializeSteps } from './serialize';

/** How many steps go into a batch that is sent to the host while the run goes on. A batch of a
 * long run is large (steps of a recursive program grow with the recursion), so not too many. */
export const STEPS_PER_BATCH = 25;

/**
 * The js-slang binding for the language-agnostic stepper runner.
 *
 * Everything protocol-shaped — channel wiring, the host's replay request, error reporting, caching
 * the most recent steps — lives in `BaseStepperRunnerPlugin`. All this adds is "how does *this*
 * language turn an AST into steps".
 *
 * `getSyntaxProfile()` is deliberately not overridden. The host's default renderer is the
 * Source/JavaScript one, so js-slang gets correct rendering by supplying nothing at all; py-slang
 * has to ship a full profile only because Python's surface syntax is not the default.
 */
export class SourceStepperRunnerPlugin extends BaseStepperRunnerPlugin<es.Program> {
  private readonly context: Context;
  private stepLimit: number;

  constructor(conduit: IConduit, channels: IChannel<never>[], context: Context, stepLimit: number) {
    super(conduit, channels);
    this.context = context;
    this.stepLimit = stepLimit;
  }

  /** The host's step budget can change between runs, so it is set per run rather than at
   * construction. py-slang shipped a hardcoded 1000 here and had to fix it (py-slang#427). */
  setStepLimit(stepLimit: number): void {
    this.stepLimit = stepLimit;
  }

  getSteps(ast: es.Program): SerializedStepperStep[] {
    return serializeSteps(getSteps(ast, this.context, { stepLimit: this.stepLimit }));
  }

  /**
   * The steps in batches, as they are computed, so that the host has the steps so far if the run is
   * stopped, or never finishes (the host stops a run by terminating the worker). The trace ends as
   * cut off, with the reason, if the step limit was reached.
   */
  protected override getStepBatches(ast: es.Program): StepBatches {
    const { context, stepLimit } = this;
    return (function* (): Generator<SerializedStepperStep[], TraceEnd | undefined> {
      const steps = generateSteps(ast, context, { stepLimit });
      let batch: IStepperPropContents[] = [];
      for (let next = steps.next(); ; next = steps.next()) {
        if (next.done) {
          if (batch.length > 0) yield serializeSteps(batch);
          return next.value.limitReached
            ? { status: 'cut-off', reason: `the limit of ${stepLimit} steps was reached` }
            : undefined;
        }
        batch.push(next.value);
        if (batch.length >= STEPS_PER_BATCH) {
          yield serializeSteps(batch);
          batch = [];
        }
      }
    })();
  }
}
checkIsPluginClass(SourceStepperRunnerPlugin);
