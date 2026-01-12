import type { Context } from '../../types'
import type { ModuleFunctions } from '../moduleTypes'
import { loadModuleBundleAsync, loadModuleTabsAsync } from './loaders'

/**
 * Initialize module contexts and add UI tabs needed for modules to program context
 */
async function initModuleContextAsync(moduleName: string, context: Context, loadTabs: boolean) {
  // Load the module's tabs
  if (!(moduleName in context.moduleContexts)) {
    context.moduleContexts[moduleName] = {
      state: null,
      tabs: loadTabs ? await loadModuleTabsAsync(moduleName) : null
    }
  } else if (context.moduleContexts[moduleName].tabs === null && loadTabs) {
    context.moduleContexts[moduleName].tabs = await loadModuleTabsAsync(moduleName)
  }
}

/**
 * With the given set of Source Modules to Import, load all of the bundles and
 * tabs (if `loadTabs` is true) and populate the `context.nativeStorage.loadedModules`
 * property.
 */
export default async function loadSourceModules(
  sourceModulesToImport: Set<string>,
  context: Context,
  loadTabs: boolean
) {
  const loadedModules = await Promise.all(
    [...sourceModulesToImport].map(async moduleName => {
      await initModuleContextAsync(moduleName, context, loadTabs)
      const bundle = await loadModuleBundleAsync(moduleName, context)
      return [moduleName, bundle] as [string, ModuleFunctions]
    })
  )
  const loadedObj = Object.fromEntries(loadedModules)
  context.nativeStorage.loadedModules = loadedObj
  return loadedObj
}

export async function loadSourceModuleTypes(sourceModulesToImport: Set<string>, context: Context) {
  const loadedModules = await Promise.all(
    [...sourceModulesToImport].map(async moduleName => {
      await initModuleContextAsync(moduleName, context, false)
      const bundle = await loadModuleBundleAsync(moduleName, context)
      return [moduleName, bundle] as [string, ModuleFunctions]
    })
  )
  const loadedObj = Object.fromEntries(loadedModules)
  sourceModulesToImport.forEach(module => {
    context.nativeStorage.loadedModuleTypes[module] = loadedObj[module].type_map
  })
}

export { MODULES_STATIC_URL } from './importers'

export {
  memoizedGetModuleDocsAsync,
  memoizedGetModuleManifestAsync,
  setModulesStaticURL
} from './loaders'
