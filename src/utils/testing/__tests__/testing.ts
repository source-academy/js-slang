import { createTestContext } from '..'
import { Chapter, Variant } from '../../../types'
import { processTestOptions } from '../misc'
import type { TestOptions } from '../types'

describe('Test processRawOptions', () => {
  const options: [string, TestOptions, TestOptions][] = [
    ['Chapter Number is a valid TestOption', Chapter.SOURCE_4, { chapter: Chapter.SOURCE_4 }],
    [
      'Specifying chapter number in options object',
      { chapter: Chapter.SOURCE_4 },
      { chapter: Chapter.SOURCE_4 }
    ]
  ]
  test.each(options)('%s', (_, value, expected) => {
    expect(processTestOptions(value)).toEqual(expected)
  })
})

describe('Testing createTestContext', () => {
  test('Providing no test options runs default variant and Source 1', () => {
    const context = createTestContext()
    expect(context.chapter).toEqual(Chapter.SOURCE_1)
    expect(context.variant).toEqual(Variant.DEFAULT)
  })

  test('Providing a chaper runs default variant and that chapter', () => {
    const context = createTestContext(Chapter.SOURCE_3)
    expect(context.chapter).toEqual(Chapter.SOURCE_3)
    expect(context.variant).toEqual(Variant.DEFAULT)
  })

  test('Specifying variant but not chapter should use Source 1', () => {
    const context = createTestContext({ variant: Variant.EXPLICIT_CONTROL })
    expect(context.chapter).toEqual(Chapter.SOURCE_1)
    expect(context.variant).toEqual(Variant.EXPLICIT_CONTROL)
  })

  test('If both chapter and variant are specified, both are used', () => {
    const context = createTestContext({
      chapter: Chapter.SOURCE_4,
      variant: Variant.DEFAULT
    })
    expect(context.chapter).toEqual(Chapter.SOURCE_4)
    expect(context.variant).toEqual(Variant.DEFAULT)
  })
})
