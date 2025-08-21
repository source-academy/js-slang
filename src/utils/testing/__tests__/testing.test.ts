import { describe, expect, test, vi } from 'vitest'
import { createTestContext, processTestOptions, testFailure, testSuccess } from '..'
import * as main from '../../..'
import { Chapter, Variant } from '../../../langs'
import type { TestOptions } from '../types'

const mockedRunInContext = vi.spyOn(main, 'runInContext')

function mockEvalSuccess(value: any = 0) {
  mockedRunInContext.mockResolvedValueOnce({
    value,
    context: {} as main.Context,
    status: 'finished'
  })
}

function mockEvalFailure() {
  mockedRunInContext.mockResolvedValueOnce({
    status: 'error'
  })
}

describe('Test processRawOptions', () => {
  const options: [string, TestOptions, TestOptions][] = [
    ['Chapter Number is a valid TestOption', Chapter.SOURCE_4, { chapter: Chapter.SOURCE_4 }],
    [
      'Specifying chapter number in options object',
      { chapter: Chapter.SOURCE_4 },
      { chapter: Chapter.SOURCE_4 }
    ],
    ['Empty options object is valid', {}, {}]
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

  test('Providing empty test options runs default variant and Source 1', () => {
    const context = createTestContext({})
    expect(context.chapter).toEqual(Chapter.SOURCE_1)
    expect(context.variant).toEqual(Variant.DEFAULT)
  })

  test('Providing a chapter runs default variant and that chapter', () => {
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

describe('Test testing functions', () => {
  test('testSuccess resolves on evaluation success', () => {
    mockEvalSuccess()
    return expect(testSuccess('').then(({ result: { value } }) => value)).resolves.toEqual(0)
  })

  test('testSuccess rejects on evaluation failure', () => {
    mockEvalFailure()
    return expect(testSuccess('')).rejects.toThrow()
  })

  test('testFailure resolves on evaluation failure', () => {
    mockEvalFailure()
    return expect(testFailure('')).resolves.toEqual('')
  })

  test('testFailure rejects on evaluation success', () => {
    mockEvalSuccess()
    return expect(testFailure('')).rejects.toThrow()
  })
})
