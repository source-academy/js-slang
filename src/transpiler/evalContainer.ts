import { NativeStorage } from '../types'
import { NATIVE_STORAGE_ID } from '../constants'

type Evaler = (code: string, nativeStorage: NativeStorage) => any

/*
  We need to use new Function here to ensure that the parameter names do not get
  minified, as the transpiler uses NATIVE_STORAGE_ID for access
 */

export const sandboxedEval: Evaler = new Function("code", NATIVE_STORAGE_ID, `
console.log(code)
return eval(code)
`) as Evaler
