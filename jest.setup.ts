jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  memoize: jest.fn((x: any) => x),
}))


jest.mock('./src/modules/moduleLoaderAsync')
jest.mock('./src/modules/moduleLoader')