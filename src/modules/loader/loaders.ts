import type { Context, Node } from '../../types'
import { timeoutPromise } from '../../utils/misc'
import { ModuleConnectionError, ModuleInternalError } from '../errors'
import type {
  ModuleBundle,
  ModuleDocumentation,
  ModuleFunctions,
  ModuleManifest
} from '../moduleTypes'
import { getRequireProvider } from './requireProvider'

/** Default modules static url. Exported for testing. */
export let MODULES_STATIC_URL = 'https://source-academy.github.io/modules'

export function setModulesStaticURL(url: string) {
  MODULES_STATIC_URL = url

  // Changing the module backend should clear these
  memoizedGetModuleDocsAsync.cache.clear()
  memoizedGetModuleManifestAsync.reset()
}

function wrapImporter<T>(func: (p: string) => Promise<T>) {
  return async (p: string): Promise<T> => {
    try {
      const result = await timeoutPromise(func(p), 10000)
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
        (process.env.NODE_ENV === 'test' && error.code === 'ENOENT')
      ) {
        throw new ModuleConnectionError()
      }
      throw error
    }
  }
}

// Exported for testing
export const docsImporter = wrapImporter<{ default: any }>(async p => {
  // TODO: Use import attributes when they become supported
  // Import Assertions and Attributes are not widely supported by all
  // browsers yet, so we use fetch in the meantime
  const resp = await fetch(p)
  if (resp.status !== 200 && resp.status !== 304) {
    throw new ModuleConnectionError()
  }

  const result = await resp.json()
  return { default: result }
})

// lodash's memoize function memoizes on errors. This is undesirable,
// so we have our own custom memoization that won't memoize on errors
function getManifestImporter() {
  let manifest: ModuleManifest | null = null

  async function func() {
    if (manifest !== null) {
      return manifest
    }

    ;({ default: manifest } = await docsImporter(`${MODULES_STATIC_URL}/modules.json`))

    return manifest!
  }

  func.reset = () => {
    manifest = null
  }

  return func
}

function getMemoizedDocsImporter() {
  const docs = new Map<string, ModuleDocumentation>()

  async function func(moduleName: string, throwOnError: true): Promise<ModuleDocumentation>
  async function func(moduleName: string, throwOnError?: false): Promise<ModuleDocumentation | null>
  async function func(moduleName: string, throwOnError?: boolean) {
    if (docs.has(moduleName)) {
      return docs.get(moduleName)!
    }

    try {
      const { default: loadedDocs } = await docsImporter(
        `${MODULES_STATIC_URL}/jsons/${moduleName}.json`
      )
      docs.set(moduleName, loadedDocs)
      return loadedDocs
    } catch (error) {
      if (throwOnError) throw error
      console.warn(`Failed to load documentation for ${moduleName}:`, error)
      return null
    }
  }

  func.cache = docs
  return func
}

export const memoizedGetModuleManifestAsync = getManifestImporter()
export const memoizedGetModuleDocsAsync = getMemoizedDocsImporter()

function getBundleAndTabImporter(): (p: string) => Promise<{ default: ModuleBundle }> {
  if (process.env.NODE_ENV === 'test') {
    return p => import(p)
  }

  if (typeof window !== 'undefined') {
    return (new Function('path', 'return import(`${path}?q=${Date.now()}`)') as any)
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return p => Promise.resolve(require(p))
}

/*
  Browsers natively support esm's import() but Jest and Node do not. So we need
  to change which import function we use based on the environment.

  For the browser, we use the function constructor to hide the import calls from
  webpack so that webpack doesn't try to compile them away.
*/
const bundleAndTabImporter = wrapImporter(getBundleAndTabImporter())

export async function loadModuleBundleAsync(
  moduleName: string,
  context: Context,
  node?: Node
): Promise<ModuleFunctions> {
  const { default: result } = await bundleAndTabImporter(
    `${MODULES_STATIC_URL}/bundles/${moduleName}.js`
  )
  try {
    const loadedModule = result(getRequireProvider(context))
    return Object.entries(loadedModule).reduce((res, [name, value]) => {
      if (typeof value === 'function') {
        const repr = `function ${name} {\n\t[Function from ${moduleName}\n\tImplementation hidden]\n}`
        value[Symbol.toStringTag] = () => repr
        value.toString = () => repr
      }
      return {
        ...res,
        [name]: value
      }
    }, {})
  } catch (error) {
    throw new ModuleInternalError(moduleName, error, node)
  }
}

export async function loadModuleTabsAsync(moduleName: string) {
  const manifest = await memoizedGetModuleManifestAsync()
  const moduleInfo = manifest[moduleName]

  return Promise.all(
    moduleInfo.tabs.map(async tabName => {
      const { default: result } = await bundleAndTabImporter(
        `${MODULES_STATIC_URL}/tabs/${tabName}.js`
      )
      return result
    })
  )
}
