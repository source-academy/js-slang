import type { RawSourceMap } from 'source-map';

import { JSSLANG_PROPERTIES } from '../constants';
import { CSEResultPromise, evaluate as CSEvaluate } from '../cse-machine/interpreter';
import { ExceptionError } from '../errors/errors';
import { TimeoutError } from '../errors/timeoutErrors';
import { getSteps } from '../stepper/steppers';
import { sandboxedEval } from '../transpiler/evalContainer';
import { hasImports, transpile } from '../transpiler/transpiler';
import { SourceErrorWithNode } from '../errors/base';
import { toSourceError } from './errors';
import fullJSRunner from './fullJSRunner';
import type { Runner } from './types';

let isPreviousCodeTimeoutError = false;
const runners = {
  fulljs: fullJSRunner,
  'cse-machine': (program, context, options) => {
    const value = CSEvaluate(program, context, options);
    return CSEResultPromise(context, value);
  },
  substitution: (program, context, options) => {
    const steps = getSteps(program, context, options);
    if (context.errors.length > 0) {
      return Promise.resolve({ status: 'error', context });
    }
    return Promise.resolve({
      status: 'finished',
      context,
      value: steps,
    });
  },
  native: async (program, context, options) => {
    if (!options.isPrelude) {
      if (context.shouldIncreaseEvaluationTimeout && isPreviousCodeTimeoutError) {
        context.nativeStorage.maxExecTime *= JSSLANG_PROPERTIES.factorToIncreaseBy;
      } else {
        context.nativeStorage.maxExecTime = options.originalMaxExecTime;
      }
    }

    let sourceMapJson: RawSourceMap | undefined;
    try {
      let transpiled: string;
      const isAsync = hasImports(program) || options.forceAsyncTranspile;
      ({ transpiled, sourceMapJson } = transpile(
        program,
        context,
        options.isPrelude,
        false,
        isAsync,
      ));

      // Cheap and always safe to await: a sync-mode chunk's transpiled code never returns a
      // thenable, and awaiting a plain value simply resolves to that same value one microtask
      // later. Only a dual/async-mode chunk's async IIFE (see transpiler.ts) actually returns a
      // Promise here, and this is the one place that Promise gets unwrapped into `value`.
      let value = await sandboxedEval(transpiled, context.nativeStorage);

      if (!options.isPrelude) {
        isPreviousCodeTimeoutError = false;
      }

      return {
        status: 'finished',
        context,
        value,
      };
    } catch (error) {
      if (error instanceof ExceptionError) {
        // if we know the location of the error, just throw it
        if (error.location.start.line !== -1) {
          context.errors.push(error);
          return { status: 'error', context };
        } else {
          error = error.error; // else we try to get the location from source map
        }
      }

      if (error instanceof SourceErrorWithNode) {
        if (error instanceof TimeoutError) {
          isPreviousCodeTimeoutError = true;
        }

        context.errors.push(error);
        return { status: 'error', context };
      }

      const sourceError = await toSourceError(error, sourceMapJson);
      context.errors.push(sourceError);
      return { status: 'error', context };
    }
  },
} satisfies Record<string, Runner>;

export default runners;

export type RunnerTypes = keyof typeof runners;
