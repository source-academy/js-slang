import type { Context } from '../../../types'

export const memoizedGetModuleDocsAsync = jest.fn((module: string) =>
  Promise.resolve(
    module === 'another_module'
      ? {
          bar: 'bar',
          foo: 'foo'
        }
      : {
          bar: 'bar',
          foo: 'foo',
          default: 'default'
        }
  )
)

export const memoizedGetModuleManifestAsync = jest.fn().mockResolvedValue({
  one_module: { tabs: [] },
  another_module: { tabs: [] },
  other_module: { tabs: [] }
})

export const loadModuleBundleAsync = jest.fn((name: string) => {
  const baseModule = {
    foo: () => 'foo',
    bar: () => 'bar'
  }

  return name === 'another_module' ? baseModule : { ...baseModule, default: () => 'def' }
})

export const loadModuleTabsAsync = jest.fn().mockResolvedValue([])

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
