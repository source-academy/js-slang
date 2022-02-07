import { Options } from 'acorn'
import * as es from 'estree'

import { SourceLanguage } from './types'

export const CUT = 'cut' // cut operator for Source 4.3
export const TRY_AGAIN = 'retry' // command for Source 4.3
export const GLOBAL = typeof window === 'undefined' ? global : window
export const NATIVE_STORAGE_ID = 'nativeStorage'
export const MODULE_PARAMS_ID = 'moduleParams'
export const MAX_LIST_DISPLAY_LENGTH = 100
export const UNKNOWN_LOCATION: es.SourceLocation = {
  start: {
    line: -1,
    column: -1
  },
  end: {
    line: -1,
    column: -1
  }
}
export const JSSLANG_PROPERTIES = {
  maxExecTime: 1000,
  factorToIncreaseBy: 10
}

export const sourceLanguages: SourceLanguage[] = [
  { chapter: 1, variant: 'default' },
  { chapter: 1, variant: 'wasm' },
  { chapter: 1, variant: 'lazy' },
  { chapter: 2, variant: 'default' },
  { chapter: 2, variant: 'lazy' },
  { chapter: 3, variant: 'default' },
  { chapter: 3, variant: 'concurrent' },
  { chapter: 3, variant: 'non-det' },
  { chapter: 4, variant: 'default' },
  { chapter: 4, variant: 'gpu' }
]

export const ACORN_PARSE_OPTIONS: Options = { ecmaVersion: 2015 }
