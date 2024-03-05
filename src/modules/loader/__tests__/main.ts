import loadSourceModules from '..'
import { mockContext } from '../../../mocks/context'
import { Chapter, Variant } from '../../../types'
import * as loaders from '../loaders'

jest.mock('../loaders')

const moduleMocker = jest.fn()

jest.mock(
  `${jest.requireActual('../loaders').MODULES_STATIC_URL}/bundles/one_module.js`,
  () => ({
    default: moduleMocker
  }),
  { virtual: true }
)

jest.mock(
  `${jest.requireActual('../loaders').MODULES_STATIC_URL}/modules.json`,
  () => ({
    one_module: { tabs: ['tab1', 'tab2'] }
  }),
  { virtual: true }
)

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.resetModules()
})

test('Test loadSourceModules', async () => {
  const context = mockContext(Chapter.SOURCE_4, Variant.DEFAULT)

  function foo() {
    return foo.name
  }

  const bundle = {
    foo,
    bar: () => 'bar'
  }

  moduleMocker.mockReturnValueOnce(bundle)
  await loadSourceModules(new Set(['one_module']), context, true)

  const mod = context.nativeStorage.loadedModules['one_module']
  expect(mod.foo()).toEqual('foo')
  expect(mod.bar()).toEqual('bar')

  expect(loaders.loadModuleTabsAsync).toHaveBeenCalledTimes(1)
})
