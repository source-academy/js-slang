import { SourceMapConsumer } from 'source-map';

import createContext from './createContext';
import { InterruptedError } from './errors/errors';
import { Chapter, type Variant } from './langs';
import { setBreakpointAtLine } from './stdlib/inspector';
import type { Context, ExecutionMethod, Finished, Result, Error as ResultError } from './types';
import type { RecursivePartial } from './utils/typeUtils';
import type { ModuleContext, ImportOptions } from './modules/moduleTypes';

import { CSEResultPromise, resumeEvaluate } from './cse-machine/interpreter';
import type { SourceError } from './errors/base';
import { ModuleNotFoundError } from './modules/errors';
import { validateFilePath } from './modules/preprocessor/filePaths';
import { htmlRunner, sourceFilesRunner } from './runner';

export interface IOptions {
  steps: number;
  stepLimit: number;
  executionMethod: ExecutionMethod;
  variant: Variant;
  originalMaxExecTime: number;
  useSubst: boolean;
  isPrelude: boolean;
  throwInfiniteLoops: boolean;
  envSteps: number;

  importOptions: ImportOptions;

  /**
   * Set this to true if source file information should be
   * added when parsing programs into ASTs
   *
   * Set to null to let js-slang decide automatically
   */
  shouldAddFileName: boolean | null;
}

// needed to work on browsers
if (typeof window !== 'undefined') {
  // @ts-expect-error Initialize doesn't exist on SourceMapConsumer
  SourceMapConsumer.initialize({
    'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm',
  });
}

let verboseErrors: boolean = false;

export function parseError(errors: SourceError[], verbose: boolean = verboseErrors): string {
  const errorMessagesArr = errors.map(error => {
    // FIXME: Either refactor the parser to output an ESTree-compliant AST, or modify the ESTree types.
    const filePath = error.location?.source ? `[${error.location.source}] ` : '';
    const line = error.location?.start?.line ?? -1;
    const column = error.location?.start?.column ?? -1;

    if (!error.explain) {
      console.error('Unhandled error', error);
    }

    const explanation = error.explain();

    if (verbose) {
      // TODO currently elaboration is just tagged on to a new line after the error message itself. find a better
      // way to display it.
      const elaboration = error.elaborate();
      return line < 1
        ? `${filePath}${explanation}\n${elaboration}\n`
        : `${filePath}Line ${line}, Column ${column}: ${explanation}\n${elaboration}\n`;
    } else {
      return line < 1 ? explanation : `${filePath}Line ${line}: ${explanation}`;
    }
  });
  return errorMessagesArr.join('\n');
}

export async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {},
): Promise<Result> {
  const defaultFilePath = '/default.js';
  const files: Partial<Record<string, string>> = {};
  files[defaultFilePath] = code;
  return runFilesInContext(files, defaultFilePath, context, options);
}

// this is the first entrypoint for all source files.
// as such, all mapping functions required by alternate languages
// should be defined here.
export async function runFilesInContext(
  files: Partial<Record<string, string>>,
  entrypointFilePath: string,
  context: Context,
  options: RecursivePartial<IOptions> = {},
): Promise<Result> {
  for (const filePath in files) {
    const filePathError = validateFilePath(filePath);
    if (filePathError !== null) {
      context.errors.push(filePathError);
      return { status: 'error', context };
    }
  }

  let result: Result;
  if (context.chapter === Chapter.HTML) {
    const code = files[entrypointFilePath];
    if (code === undefined) {
      context.errors.push(new ModuleNotFoundError(entrypointFilePath));
      return { status: 'error', context };
    }
    result = await htmlRunner(code, context, options);
  } else {
    // FIXME: Clean up state management so that the `parseError` function is pure.
    //        This is not a huge priority, but it would be good not to make use of
    //        global state.
    ({ result, verboseErrors } = await sourceFilesRunner(
      p => Promise.resolve(files[p]),
      entrypointFilePath,
      context,
      {
        ...options,
        shouldAddFileName: options.shouldAddFileName ?? Object.keys(files).length > 1,
      },
    ));
  }

  return result;
}

export function resume(result: Result): Finished | ResultError | Promise<Result> {
  if (result.status === 'finished' || result.status === 'error') {
    return result;
  }
  const value = resumeEvaluate(result.context);
  return CSEResultPromise(result.context, value);
}

export function interrupt(context: Context) {
  const globalEnvironment = context.runtime.environments[context.runtime.environments.length - 1];
  context.runtime.environments = [globalEnvironment];
  context.runtime.isRunning = false;
  context.errors.push(new InterruptedError(context.runtime.nodes[0]));
}

export { Context, createContext, ModuleContext, Result, setBreakpointAtLine };
