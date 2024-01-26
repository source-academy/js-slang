import { mockContext } from '../../../mocks/context'
import { Chapter, Variant } from '../../../types'
import * as moduleLoader from '../loaders'

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  memoize: jest.fn(x => x)
}))

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

global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.resetModules()
})

test('Loading a single bundle', async () => {
  const context = mockContext(Chapter.SOURCE_4, Variant.DEFAULT)
  moduleMocker.mockReturnValueOnce({
    foo() {
      return this.foo.name
    },
    bar: () => 'bar'
  })
  const mod = await moduleLoader.loadModuleBundleAsync('one_module', context)
  expect(mod.foo()).toEqual('foo')
  expect(mod.foo[moduleLoader.sourceModuleObject]).toEqual(true)
})
