import { expect, test } from 'vitest'
import { Chapter } from '../langs'
import { testFailure, testForValue } from '../utils/testing'

test('draw_data returns first argument if more than one argument', async () => {
  const value = await testForValue(`draw_data(1, 2);`, Chapter.SOURCE_3)
  expect(value).toEqual(1)
})

test('draw_data returns first argument if exactly one argument', async () => {
  const value = await testForValue(`draw_data(1);`, Chapter.SOURCE_3)
  expect(value).toEqual(1)
})

test('draw_data with no arguments throws error', () => {
  return expect(testFailure(`draw_data();`, Chapter.SOURCE_3)).resolves.toMatchInlineSnapshot(
    `"Line 1: Expected 1 or more arguments, but got 0."`
  )
})
