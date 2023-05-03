export function loadModuleBundle() {
  return {
    foo: () => 'foo',
    bar: () => 'bar',
  }
}

export function loadModuleTabs() {
  return []
}
export const memoizedGetModuleManifest = () => ({
  one_module: { tabs: [] },
  other_module: { tabs: [] },
  another_module: { tabs: [] },
})