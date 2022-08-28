import { Chapter } from '../types'
import { expectParsedError, expectResult } from '../utils/testing'

test('draw_data returns first argument if more than one argument', () => {
  return expectResult(`draw_data(1, 2);`, { chapter: Chapter.SOURCE_3 }).toMatchInlineSnapshot(`1`)
})

test('draw_data returns first argument if exactly one argument', () => {
  return expectResult(`draw_data(1);`, { chapter: Chapter.SOURCE_3 }).toMatchInlineSnapshot(`1`)
})

test('draw_data with no arguments throws error', () => {
  return expectParsedError(`draw_data();`, { chapter: Chapter.SOURCE_3 }).toMatchInlineSnapshot(
    `"Line 1: Expected 1 or more arguments, but got 0."`
  )
})
