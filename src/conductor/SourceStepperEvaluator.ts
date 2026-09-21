import { STEPPER_DIRECTORY_ID } from '@sourceacademy/common-stepper';
import { BasicEvaluator, type IRunnerPlugin } from '@sourceacademy/conductor/runner';

import createContext from '../createContext';
import type { SourceError } from '../errors/base';
import { Chapter, Variant } from '../langs';
import { parse } from '../parser/parser';
import type { Context, Value } from '../types';
import { EvaluatorSyntaxError } from '@sourceacademy/conductor/common';

import { DEFAULT_STEP_LIMIT, fetchRunConfig } from './cse/runConfig';
import { isWarning, toConductorError, unknownToConductorError } from './errors';
import { SourceStepperRunnerPlugin } from './stepper/SourceStepperRunnerPlugin';

/**
 * Runs Source §1–§2 through the substitution stepper and pushes the steps to the host's Stepper
 * tab.
 *
 * §1/§2 only: the stepper explains evaluation *as substitution*, which stops being the right
 * account once §3 introduces mutation — the legacy tab draws the same line (`chapter <= 2`), as
 * does py-slang with `PyStepperEvaluator1`/`2`.
 *
 * Carries `EvaluatorCapability.STEPPER` in the language directory, which means the host hides it
 * from the evaluator dropdown and selects it automatically when the user opens the Stepper tab.
 */
abstract class SourceStepperEvaluatorBase extends BasicEvaluator {
  private readonly chapter: Chapter;
  private readonly context: Context;
  private readonly stepper: SourceStepperRunnerPlugin;

  protected constructor(conductor: IRunnerPlugin, chapter: Chapter) {
    super(conductor);
    this.chapter = chapter;
    this.context = this.freshContext();
    this.stepper = conductor.registerPlugin(
      SourceStepperRunnerPlugin,
      this.context,
      DEFAULT_STEP_LIMIT,
    );
    void conductor.hostLoadPlugin(STEPPER_DIRECTORY_ID);
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
      visualiseList: () => {
        throw new Error('draw_data is not supported by this evaluator.');
      },
    });
  }

  async evaluateChunk(chunk: string): Promise<Value> {
    try {
      const program = parse(chunk, this.context);
      if (program === null) {
        this.reportErrors();
        return undefined;
      }

      // The stepper has no converter for import/export declarations, and handing it one does not
      // degrade gracefully — `getSteps` throws `this.body[0].contractEmpty is not a function`,
      // which would reach the user as an internal-looking message with no hint of the cause.
      //
      // The non-conductor substitution path avoids this by running `preprocessFileImports` first.
      // Doing that here would pull the whole module pipeline into this slice, which is module
      // support (#2062) rather than stepping, so for now say plainly what is unsupported.
      const importing = program.body.find(
        node =>
          node.type === 'ImportDeclaration' ||
          node.type === 'ExportNamedDeclaration' ||
          node.type === 'ExportDefaultDeclaration' ||
          node.type === 'ExportAllDeclaration',
      );
      if (importing) {
        this.conductor.sendError(
          new EvaluatorSyntaxError(
            'The stepper does not support import and export declarations.',
            importing.loc?.start.line,
            importing.loc?.start.column,
          ),
        );
        this.reportErrors();
        return undefined;
      }

      const config = await fetchRunConfig(this.conductor);
      this.stepper.setStepLimit(config.stepLimit ?? DEFAULT_STEP_LIMIT);
      await this.stepper.sendSteps(program);

      this.reportErrors();
      return undefined;
    } catch (e) {
      const reported = this.reportErrors();
      if (!reported.includes(e as never)) {
        this.conductor.sendError(unknownToConductorError(e));
      }
      return undefined;
    }
  }

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
