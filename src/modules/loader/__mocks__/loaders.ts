import {
  unknownDocs,
  type FunctionDocumentation,
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
