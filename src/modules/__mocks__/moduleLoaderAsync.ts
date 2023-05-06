export const memoizedGetModuleDocsAsync = () =>
  Promise.resolve({
    foo: 'foo',
    bar: 'bar'
  })

export const memoizedGetModuleBundleAsync = () =>
  Promise.resolve(`require => ({
  foo: () => 'foo',
  bar: () => 'bar',
})`)

export const memoizedGetModuleManifestAsync = () =>
  Promise.resolve({
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
