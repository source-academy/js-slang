import type { Context } from '../..'
import type { Value } from '../../types'
import type { LanguageOptions } from '../../langs'
import type { Variant } from '../../langs'
import type { Chapter } from '../../langs'

export type TestOptions =
  | {
      chapter?: Chapter
      variant?: Variant
      testBuiltins?: TestBuiltins
      languageOptions?: LanguageOptions
    }
  | Chapter

export interface TestResults {
  displayResult: string[]
  promptResult: string[]
  alertResult: string[]
  visualiseListResult: Value[]
}

export type TestContext = Context<any> & TestResults

export interface TestBuiltins {
  [builtinName: string]: any
}
