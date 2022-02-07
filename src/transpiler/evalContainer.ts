import { MODULE_PARAMS_ID, NATIVE_STORAGE_ID } from '../constants'
import { NativeStorage } from '../types'

type Evaler = (code: string, nativeStorage: NativeStorage, moduleParams: any) => any

/*
  We need to use new Function here to ensure that the parameter names do not get
  minified, as the transpiler uses NATIVE_STORAGE_ID for access
 */

export const sandboxedEval: Evaler = new Function(
  'code',
  NATIVE_STORAGE_ID,
  MODULE_PARAMS_ID,
  `
  if (${NATIVE_STORAGE_ID}.evaller === null) {
    return eval(code);
  } else {
    return ${NATIVE_STORAGE_ID}.evaller(code);
  }
`
) as Evaler
