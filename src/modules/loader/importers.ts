import { timeoutPromise } from '../../utils/misc'
import { ModuleConnectionError } from '../errors'
import { memoizedGetModuleDocsAsync, memoizedGetModuleManifestAsync } from './loaders'

/** Default modules static url. Exported for testing. */
export let MODULES_STATIC_URL = 'https://source-academy.github.io/modules'

export function setModulesStaticURL(url: string) {
  MODULES_STATIC_URL = url

  // Changing the module backend should clear these
  memoizedGetModuleDocsAsync.cache.clear()
  memoizedGetModuleManifestAsync.reset()
}

function wrapImporter<T extends (p: string, signal?: AbortSignal) => Promise<any>>(func: T) {
  return async (p: string, signal?: AbortSignal): Promise<Awaited<ReturnType<T>>> => {
    try {
      const result = await timeoutPromise(func(p, signal), 10000)
      return result
    } catch (error) {
      console.error('The error is', error)
      // Before calling this function, the import analyzer should've been used to make sure
      // that the module being imported already exists, so the following errors should
      // be thrown only if the modules server is unreachable
      if (
        // In the browser, import statements should throw TypeError
        (typeof window !== 'undefined' && error instanceof TypeError) ||
        // In Node a different error is thrown with the given code instead
        error.code === 'MODULE_NOT_FOUND' ||
        // Thrown specifically by vitest
        (process.env.NODE_ENV === 'test' && error.code === 'ERR_UNSUPPORTED_ESM_URL_SCHEME')
      ) {
        throw new ModuleConnectionError()
      }
      throw error
    }
  }
}

// Exported for testing
export const docsImporter = wrapImporter(async (p, signal) => {
  // TODO: Use import attributes when they become supported
  // Import Assertions and Attributes are not widely supported by all
  // browsers yet, so we use fetch in the meantime
  const resp = await fetch(p, { signal })
  if (resp.status !== 200 && resp.status !== 304) {
    throw new ModuleConnectionError()
  }

  const result = await resp.json()
  return { default: result }
})

function getBundleAndTabsImporter(): (p: string) => Promise<any> {
  if (process.env.NODE_ENV === 'test') return p => import(p)
  if (typeof window !== 'undefined')
    return new Function('path', 'return import(`${path}?q=${Date.now()}`)') as any

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return p => Promise.resolve(require(p))
}

/*
  Browsers natively support esm's import() but Jest and Node do not. So we need
  to change which import function we use based on the environment.

  For the browser, we use the function constructor to hide the import calls from
  webpack so that webpack doesn't try to compile them away.
*/
export const bundleAndTabImporter = wrapImporter(getBundleAndTabsImporter())
