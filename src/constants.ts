import type { SourceLocation } from 'estree'
import type { AcornOptions } from './parser/types'

export const DEFAULT_ECMA_VERSION = 6
export const ACORN_PARSE_OPTIONS: AcornOptions = { ecmaVersion: DEFAULT_ECMA_VERSION }

export const REQUIRE_PROVIDER_ID = 'requireProvider'
export const CUT = 'cut' // cut operator for Source 4.3
export const TRY_AGAIN = 'retry' // command for Source 4.3
export const GLOBAL = typeof window === 'undefined' ? global : window
export const NATIVE_STORAGE_ID = 'nativeStorage'
export const MAX_LIST_DISPLAY_LENGTH = 100
export const UNKNOWN_LOCATION: SourceLocation = {
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
