import type { Context } from '../../..'
import {
  unknownDocs,
  type FunctionDocumentation,
  type ModuleFunctions,
  type VariableDocumentation
} from '../../moduleTypes'

export const memoizedGetModuleDocsAsync = jest.fn((module: string) => {
  const barDocs: FunctionDocumentation = {
    kind: 'function',
    retType: 'void',
    params: [['a', 'number']],
    description: 'bar'
  }

  const fooDocs: VariableDocumentation = {
    kind: 'variable',
    type: 'string',
    description: 'foo'
  }

  return Promise.resolve(
    module === 'another_module'
      ? {
          bar: barDocs,
          foo: fooDocs
        }
      : {
          bar: barDocs,
          foo: fooDocs,
          default: unknownDocs
        }
  )
})

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

  return Promise.resolve(
    name === 'another_module' ? baseModule : { ...baseModule, default: () => 'def' }
  )
})

export const loadModuleTabsAsync = jest.fn().mockResolvedValue([])

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

export default async function loadSourceModules(
  sourceModulesToImport: Set<string>,
  context: Context,
  loadTabs: boolean
) {
  const loadedModules = await Promise.all(
    [...sourceModulesToImport].map(async moduleName => {
      await initModuleContextAsync(moduleName, context, loadTabs)
      const bundle = await loadModuleBundleAsync(moduleName)
      return [moduleName, bundle] as [string, ModuleFunctions]
    })
  )
  context.nativeStorage.loadedModules = Object.fromEntries(loadedModules)
}
