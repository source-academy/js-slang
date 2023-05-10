import { SourceMapConsumer } from "source-map"

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  memoize: jest.fn((x: any) => x),
}))


jest.mock('./src/modules/moduleLoaderAsync')
jest.mock('./src/modules/moduleLoader')

// @ts-ignore
SourceMapConsumer.initialize({
  'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm'
})

global.fetch = jest.fn()