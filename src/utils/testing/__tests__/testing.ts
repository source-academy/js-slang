import { createTestContext, testFailure, testSuccess } from '..'
import { Chapter, Variant } from '../../../types'
import { asMockedFunc, processTestOptions } from '../misc'
import type { TestOptions } from '../types'
import * as main from '../../..'

jest.spyOn(main, 'runInContext')

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
    asMockedFunc(main.runInContext).mockResolvedValueOnce({
      value: 0,
      context: {} as main.Context,
      status: 'finished'
    })

    return expect(testSuccess('').then(({ result: { value } }) => value)).resolves.toEqual(0)
  })

  test('Test testSuccess rejects on evaluation failure', () => {
    asMockedFunc(main.runInContext).mockResolvedValueOnce({
      status: 'error'
    })

    return expect(testSuccess('')).rejects.toThrow()
  })

  test('Test testFailure resolves on evaluation failure', () => {
    asMockedFunc(main.runInContext).mockResolvedValueOnce({
      status: 'error'
    })

    return expect(testFailure('')).resolves.toEqual('')
  })

  test('Test testFailure rejects on evaluation success', () => {
    asMockedFunc(main.runInContext).mockResolvedValueOnce({
      value: 0,
      context: {} as main.Context,
      status: 'finished'
    })

    return expect(testFailure('')).rejects.toThrow()
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
    const { context } = await testSuccess(`display("hi"); display("bye");`)
    expect(context.displayResult).toMatchObject(['"hi"', '"bye"'])
  })

  test('Calling alert actually adds to alertResult', async () => {
    const { context } = await testSuccess(`alert("hi"); alert("bye");`, Chapter.LIBRARY_PARSER)
    expect(context.alertResult).toMatchObject(['hi', 'bye'])
  })

  test('Calling draw_data actually adds to visualizeList', async () => {
    const { context } = await testSuccess(`draw_data(list(1, 2));`, Chapter.SOURCE_2)
    expect(context.visualiseListResult).toMatchInlineSnapshot(`
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
