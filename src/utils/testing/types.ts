import type { Context } from '../..';
import type { Chapter, LanguageOptions, Variant } from '../../langs';
import { CustomBuiltIns, Value } from '../../types';

export type TestOptions =
  | {
      chapter?: Chapter;
      variant?: Variant;
      testBuiltins?: TestBuiltins;
      languageOptions?: LanguageOptions;
      verboseErrors?: boolean;
    }
  | Chapter;

export interface TestResults {
  displayResult: string[];
  promptResult: string[];
  alertResult: string[];
  /** One entry per `draw_data(...)` call, each the call's full argument list (see #2078). */
  visualiseListResult: Value[][];
  /** One entry per `set_timeout(f, t)` call, as `[f, t]` — the generic test harness records the
   * call rather than actually scheduling `f`, since only `SourceEvaluator` (see #2025) has a real
   * implementation; a test that needs `f` to actually run should override via `testBuiltins`. */
  setTimeoutResult: [Value, number][];
}

export type TestContext = Context<any> & TestResults;

export type TestBuiltins = {
  [builtinName: string]: any;
} & Partial<CustomBuiltIns>;
