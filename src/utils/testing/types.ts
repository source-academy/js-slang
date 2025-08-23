import type { Context } from '../..'
import type { Chapter, LanguageOptions, Variant } from '../../langs'
import { Value } from '../../types'

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
