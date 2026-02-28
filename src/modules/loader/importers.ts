import { timeoutPromise } from '../../utils/misc'
import { ModuleConnectionError } from '../errors'
import type {
  Importer,
  ModuleDocumentation,
  ModulesManifest,
  PartialSourceModule
} from '../moduleTypes'

/** Default modules static url. Exported for testing. */
export let MODULES_STATIC_URL = 'https://source-academy.github.io/modules'

export function setModulesStaticURL(url: string) {
  console.log('Modules Static URL set to', url)
  MODULES_STATIC_URL = url
}

function wrapImporter<T>(func: Importer<T>): Importer<T> {
  return async (p, node) => {
    try {
      const result = await timeoutPromise(func(p, node), 10000, node)
      return result
    } catch (error) {
      // Before calling this function, the import analyzer should've been used to make sure
      // that the module being imported already exists, so the following errors should
      // be thrown only if the modules server is unreachable
      if (
        // In the browser, import statements should throw TypeError
        (typeof window !== 'undefined' && error instanceof TypeError) ||
        // In Node a different error is thrown with the given code instead
        error.code === 'MODULE_NOT_FOUND' ||
        // Thrown specifically by Vitest
        (process.env.NODE_ENV === 'test' && error.code === 'ERR_UNSUPPORTED_ESM_URL_SCHEME')
      ) {
        throw new ModuleConnectionError(node)
      }
      throw error
    }
  }
}

function getDocsImporter(): Importer<object> {
  if (process.env.NODE_ENV === 'test') {
    return async p => {
      // @ts-expect-error This directive is here until js-slang moves to ESM
      const result = await import(p, { with: { type: 'json' } })
      return result
    }
  }

  if (typeof window !== 'undefined') {
    try {
      return new Function(
        'path',
        "return import(`${path}?q=${Date.now()}`, { with: { type: 'json'} })"
      ) as any
    } catch {
      // If the browser doesn't support import assertions, the above call will throw an error.
      // In that case, fallback to using fetch
    }
  }

  return async (p, node) => {
    const resp = await fetch(p)
    if (resp.status !== 200 && resp.status !== 304) {
      throw new ModuleConnectionError(node)
    }

    const result = await resp.json()
    return { default: result }
  }
}

export const docsImporter = wrapImporter(getDocsImporter()) as Importer<ModuleDocumentation>

export const manifestImporter = wrapImporter(getDocsImporter()) as Importer<ModulesManifest>

function getBundleAndTabImporter(): Importer<PartialSourceModule> {
  if (process.env.NODE_ENV === 'test') {
    return p => import(p)
  }

  if (typeof window !== 'undefined') {
    return new Function('path', 'return import(`${path}?q=${Date.now()}`)') as any
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return p => Promise.resolve(require(p))
}

/*
  Browsers natively support esm's import() but Node does not. So we need
  to change which import function we use based on the environment.

  For the browser, we use the function constructor to hide the import calls from
  webpack so that webpack doesn't try to compile them away.
*/
export const bundleAndTabImporter = wrapImporter(getBundleAndTabImporter())

export const defaultSourceBundleImporter: Importer<PartialSourceModule> = (moduleName, node) =>
  bundleAndTabImporter(`${MODULES_STATIC_URL}/bundles/${moduleName}.js`, node)
