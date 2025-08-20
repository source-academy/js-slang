import { expect, test } from 'vitest'
import { Chapter } from '../langs'
import { testFailure, testSuccess } from '../utils/testing'

test('draw_data returns first argument if more than one argument', async () => {
  const { context } = await testSuccess(`draw_data(1, 2);`, Chapter.SOURCE_3)
  expect(context.displayResult).toMatchInlineSnapshot(`1`)
})

test('draw_data returns first argument if exactly one argument', async () => {
  const { context } = await testSuccess(`draw_data(1);`, Chapter.SOURCE_3)
  expect(context.displayResult).toMatchInlineSnapshot(
    `1`
  )
})

test('draw_data with no arguments throws error', () => {
  return expect(testFailure(`draw_data();`, Chapter.SOURCE_3)).resolves.toMatchInlineSnapshot(
    `"Line 1: Expected 1 or more arguments, but got 0."`
  )
})
