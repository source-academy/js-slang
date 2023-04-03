import { NATIVE_STORAGE_ID, REQUIRE_PROVIDER_ID } from '../constants'
import { RequireProvider } from '../modules/requireProvider'
import { NativeStorage } from '../types'

type Evaler = (code: string, req: RequireProvider, nativeStorage: NativeStorage) => any

/*
  We need to use new Function here to ensure that the parameter names do not get
  minified, as the transpiler uses NATIVE_STORAGE_ID for access
 */

export const sandboxedEval: Evaler = new Function(
  'code',
  REQUIRE_PROVIDER_ID,
  NATIVE_STORAGE_ID,
  `
  if (${NATIVE_STORAGE_ID}.evaller === null) {
    return eval(code);
  } else {
    return ${NATIVE_STORAGE_ID}.evaller(code);
  }
`
) as Evaler
