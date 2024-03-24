import { Context } from '../../../types'

export const loadModuleBundle = jest.fn(() => ({
  foo: () => 'foo',
  bar: () => 'bar'
}))

export const loadModuleTabs = jest.fn(_name => [])

export const memoizedGetModuleManifest = jest.fn(() => ({
  one_module: { tabs: [] },
  other_module: { tabs: [] },
  another_module: { tabs: [] }
}))

export function initModuleContext(moduleName: string, context: Context, loadTabs: boolean) {
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
