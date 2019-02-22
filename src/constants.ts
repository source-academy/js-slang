import * as es from 'estree'

export const GLOBAL = typeof window === 'undefined' ? global : window
export const GLOBAL_KEY_TO_ACCESS_NATIVE_STORAGE = '$$NATIVE_STORAGE'
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
