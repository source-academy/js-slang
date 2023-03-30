import { mockContext } from '../../mocks/context'
import { Chapter } from '../../types'
import { getRequireProvider } from '../requireProvider'

jest.mock('../../stdlib', () => ({
  bar: jest.fn().mockReturnValue('bar'),
  list: {
    foo: jest.fn().mockReturnValue('foo')
  }
}))

const context = mockContext(Chapter.SOURCE_4)
const provider = getRequireProvider(context)

test('Single segment', () => {
  expect(provider('js-slang/context')).toBe(context)
})

test('Multiple segments', () => {
  expect(provider('js-slang/dist/stdlib').bar()).toEqual('bar')

  expect(provider('js-slang/dist/stdlib/list').foo()).toEqual('foo')
})

test('Provider should throw an error if an unknown import is requested', () => {
  expect(() => provider('something')).toThrow(
    new Error('Dynamic require of something is not supported')
  )
})
