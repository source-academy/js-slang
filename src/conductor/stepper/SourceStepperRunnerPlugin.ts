import type { SerializedStepperStep } from '@sourceacademy/common-stepper';
import { checkIsPluginClass, type IChannel, type IConduit } from '@sourceacademy/conductor/conduit';
import { BaseStepperRunnerPlugin } from '@sourceacademy/runner-stepper';
import type es from 'estree';

import { getSteps } from '../../stepper/steppers';
import type { Context } from '../../types';
import { serializeSteps } from './serialize';

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
}
checkIsPluginClass(SourceStepperRunnerPlugin);
