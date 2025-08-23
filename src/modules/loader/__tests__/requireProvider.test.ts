import { expect, test, vi } from 'vitest'
import { mockContext } from '../../../utils/testing/mocks'
import { Chapter } from '../../../langs'
import { getRequireProvider } from '../requireProvider'

vi.mock(
  import('../../../stdlib'),
  () =>
    ({
      bar: vi.fn().mockReturnValue('bar'),
      list: {
        foo: vi.fn().mockReturnValue('foo')
      }
    }) as any
)

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
