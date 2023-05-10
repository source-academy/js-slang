export const memoizedGetModuleDocsAsync = jest.fn().mockResolvedValue({
  foo: 'foo',
  bar: 'bar'
})

export const memoizedGetModuleBundleAsync = jest.fn().mockResolvedValue(
`require => ({
  foo: () => 'foo',
  bar: () => 'bar',
})`)

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

export function loadModuleTabsAsync() {
  return Promise.resolve([])
}
