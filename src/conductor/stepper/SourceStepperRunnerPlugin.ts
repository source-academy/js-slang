import type { SerializedStepperStep } from '@sourceacademy/common-stepper';
import { BaseStepperRunnerPlugin } from '@sourceacademy/runner-stepper';
import type { IChannel, IConduit } from '@sourceacademy/conductor/conduit';
import type es from 'estree';

import createContext from '../../createContext';
import { Chapter, Variant } from '../../langs';
import { getSteps } from '../../stepper/steppers';
import { serializeSteps } from './serializeSteps';

const DEFAULT_STEP_LIMIT = 1000;

/**
 * The js-slang (Source) implementation of the language-agnostic stepper runner.
 *
 * It receives a parsed Source program (an estree AST) and produces serialized evaluation steps by
 * driving js-slang's substitution stepper (`getSteps`) and serializing its class-based output via
 * {@link serializeSteps}. All Source-specific knowledge lives here; the base class and host plugin
 * remain language-agnostic.
 */
export class SourceStepperRunnerPlugin extends BaseStepperRunnerPlugin<es.Program> {
  private readonly chapter: Chapter;
  private readonly stepLimit: number;

  constructor(
    conduit: IConduit,
    channels: IChannel<any>[],
    chapter: Chapter = Chapter.SOURCE_2,
    stepLimit: number = DEFAULT_STEP_LIMIT,
  ) {
    super(conduit, channels);
    this.chapter = chapter;
    this.stepLimit = stepLimit;
  }

  getSteps(ast: es.Program): SerializedStepperStep[] {
    const context = createContext(this.chapter, Variant.DEFAULT);
    const steps = getSteps(ast, context, { stepLimit: this.stepLimit });
    return serializeSteps(steps);
  }
}
