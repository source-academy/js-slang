import { Context } from '../../types'

export function loadModuleBundle() {
  return {
    foo: () => 'foo',
    bar: () => 'bar'
  }
}

export function loadModuleTabs(_name: string) {
  return []
}
export const memoizedGetModuleManifest = () => ({
  one_module: { tabs: [] },
  other_module: { tabs: [] },
  another_module: { tabs: [] }
})

export async function initModuleContext(moduleName: string, context: Context, loadTabs: boolean) {
  // Load the module's tabs
  if (!(moduleName in context.moduleContexts)) {
    context.moduleContexts[moduleName] = {
      state: null,
      tabs: loadTabs ? loadModuleTabs(moduleName) : null
    }
  } else if (context.moduleContexts[moduleName].tabs === null && loadTabs) {
    context.moduleContexts[moduleName].tabs = loadModuleTabs(moduleName)
  }
}
