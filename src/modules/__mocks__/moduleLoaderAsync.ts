import { Context } from '../../types'

export const memoizedGetModuleDocsAsync = jest.fn().mockResolvedValue({
  foo: 'foo',
  bar: 'bar'
})

export const memoizedGetModuleBundleAsync = jest.fn().mockResolvedValue(
  `require => ({
    foo: () => 'foo',
    bar: () => 'bar',
  })`
)

export const memoizedGetModuleManifestAsync = jest.fn().mockResolvedValue({
  one_module: { tabs: [] },
  other_module: { tabs: [] },
  another_module: { tabs: [] }
})

export function loadModuleBundleAsync() {
  return Promise.resolve({
    foo: () => 'foo',
    bar: () => 'bar'
  })
}

export function loadModuleTabsAsync(_name: string) {
  return Promise.resolve([])
}

export async function initModuleContextAsync(
  moduleName: string,
  context: Context,
  loadTabs: boolean
) {
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
