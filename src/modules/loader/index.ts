import type { Context } from '../..'
import { initModuleContextAsync, loadModuleBundleAsync } from './loaders'

export default async function loadSourceModules(
  sourceModulesToLoad: Set<string>,
  context: Context,
  loadTabs: boolean
) {
  const entries = await Promise.all(
    [...sourceModulesToLoad].map(async moduleName => {
      await initModuleContextAsync(moduleName, context, loadTabs)
      const funcs = await loadModuleBundleAsync(moduleName, context)
      return [moduleName, funcs] as [string, typeof funcs]
    })
  )
  context.nativeStorage.loadedModules = Object.fromEntries(entries)
}

export { setModulesStaticURL, sourceModuleObject } from './loaders'
