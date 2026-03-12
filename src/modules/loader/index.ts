import type { Context } from '../../types'
import { WrongChapterForModuleError } from '../errors'
import type {
  ModuleInfo,
  LoadedBundle,
  ImportLoadingOptions,
  PartialSourceModule,
  Importer
} from '../moduleTypes'
import { defaultSourceBundleImporter } from './importers'
import { loadModuleBundleAsync, loadModuleTabsAsync } from './loaders'

/**
 * Initialize module contexts and add UI tabs needed for modules to program context. If the tabs
 * array is not provided or left empty, no tabs are loaded.
 */
async function initModuleContextAsync(moduleName: string, context: Context, tabs?: string[]) {
  // Load the module's tabs
  if (!(moduleName in context.moduleContexts)) {
    context.moduleContexts[moduleName] = {
      state: null,
      tabs: tabs ? await loadModuleTabsAsync(tabs) : null
    }
  } else if (context.moduleContexts[moduleName].tabs === null && tabs) {
    context.moduleContexts[moduleName].tabs = await loadModuleTabsAsync(tabs)
  }
}

/**
 * With the given set of Source Modules to Import, load all of the bundles and
 * tabs (if `loadTabs` is true) and populate the `context.nativeStorage.loadedModules`
 * property.
 */
export default async function loadSourceModules(
  sourceModulesToImport: Record<string, ModuleInfo>,
  context: Context,
  {
    loadTabs = true,
    sourceBundleImporter = defaultSourceBundleImporter
  }: Partial<ImportLoadingOptions> = {}
) {
  const loadedModules = await Promise.all(
    Object.values(sourceModulesToImport).map(async ({ name, tabs, requires, node }) => {
      if (requires !== undefined && context.chapter < requires) {
        throw new WrongChapterForModuleError(name, requires, context.chapter, node)
      }

      await initModuleContextAsync(name, context, loadTabs ? tabs : [])
      const bundle = await loadModuleBundleAsync(name, context, sourceBundleImporter, node)
      return [name, bundle] as [string, LoadedBundle]
    })
  )
  const loadedObj = Object.fromEntries(loadedModules)
  context.nativeStorage.loadedModules = loadedObj
  return loadedObj
}

export async function loadSourceModuleTypes(
  sourceModulesToImport: Set<string>,
  context: Context,
  sourceBundleLoader: Importer<PartialSourceModule> = defaultSourceBundleImporter
) {
  const loadedModules = await Promise.all(
    [...sourceModulesToImport].map(async moduleName => {
      await initModuleContextAsync(moduleName, context)
      const bundle = await loadModuleBundleAsync(moduleName, context, sourceBundleLoader)
      return [moduleName, bundle] as [string, LoadedBundle]
    })
  )
  const loadedObj = Object.fromEntries(loadedModules)
  sourceModulesToImport.forEach(module => {
    context.nativeStorage.loadedModuleTypes[module] = loadedObj[module].type_map
  })
}

export { MODULES_STATIC_URL, defaultSourceBundleImporter } from './importers'

export {
  memoizedLoadModuleDocsAsync as memoizedGetModuleDocsAsync,
  memoizedLoadModuleManifestAsync as memoizedGetModuleManifestAsync,
  setModulesStaticURL
} from './loaders'
