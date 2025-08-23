import { describe, expect, test, vi } from 'vitest'
import {
  createTestContext,
  expectFinishedResult,
  expectParsedError,
  testFailure,
  testSuccess
} from '..'
import { Chapter, Variant } from '../../../langs'
import { processTestOptions } from '../misc'
import type { TestOptions } from '../types'
import * as main from '../../..'

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
  test('Test testSuccess resolves on evaluation success', () => {
    mockEvalSuccess()
    return expect(testSuccess('').then(({ result: { value } }) => value)).resolves.toEqual(0)
  })

  test('Test testSuccess rejects on evaluation failure', () => {
    mockEvalFailure()
    return expect(testSuccess('')).rejects.toThrow()
  })

  test('Test testFailure resolves on evaluation failure', () => {
    mockEvalFailure()
    return expect(testFailure('')).resolves.toEqual('')
  })

  test('Test testFailure rejects on evaluation success', () => {
    mockEvalSuccess()
    return expect(testFailure('')).rejects.toThrow()
  })
})

describe('Test expect functions', () => {
  test('Test expectFinishedResult resolves on evaluation success', () => {
    mockEvalSuccess()
    return expectFinishedResult('').toEqual(0)
  })

  test('Test expectFinishedResult rejects on evaluation failure', () => {
    mockEvalFailure()
    return expect(expectFinishedResult('').toEqual(0)).rejects.toThrow()
  })

  test('Test expectParsedError rejects on evaluation success', () => {
    mockEvalSuccess()
    return expect(expectParsedError('').toEqual('')).rejects.toThrow()
  })

  test('Test expectParsedError resolves on evaluation failure', () => {
    mockEvalFailure()
    return expectParsedError('').toEqual('')
  })
})

describe('Extra test results', () => {
  test('Test context contains the extra results', () => {
    const context = createTestContext()
    expect('displayResult' in context).toEqual(true)
    expect('alertResult' in context).toEqual(true)
    expect('visualiseListResult' in context).toEqual(true)
    expect('promptResult' in context).toEqual(true)
  })

  test('Calling display actually adds to displayResult', async () => {
    const {
      context: { displayResult }
    } = await testSuccess(`display("hi"); display("bye");`)
    expect(displayResult).toMatchObject(['"hi"', '"bye"'])
  })

  test('Calling alert actually adds to alertResult', async () => {
    const {
      context: { alertResult }
    } = await testSuccess(`alert("hi"); alert("bye");`, Chapter.LIBRARY_PARSER)
    expect(alertResult).toMatchObject(['hi', 'bye'])
  })

  test('Calling draw_data actually adds to visualizeList', async () => {
    const {
      context: { visualiseListResult }
    } = await testSuccess(`draw_data(list(1, 2));`, Chapter.SOURCE_2)
    expect(visualiseListResult).toMatchInlineSnapshot(`
Array [
  Array [
    Array [
      1,
      Array [
        2,
        null,
      ],
    ],
  ],
]
`)
  })
})
