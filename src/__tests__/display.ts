import { Chapter } from '../types'
import { expectDisplayResult, expectParsedError } from '../utils/testing'

test('display throw error if second argument is non-string when used', () => {
  return expectParsedError(`display(31072020, 0xDEADC0DE);`).toMatchInlineSnapshot(
    `"Line 1: TypeError: display expects the second argument to be a string"`
  )
})

test('display second argument can be a string', () => {
  return expectDisplayResult(`display(31072020, "my_first_String");`).toMatchInlineSnapshot(
    `Array []`
  )
})

test('display can be used to display numbers', () => {
  return expectDisplayResult(`display(0);`).toMatchInlineSnapshot(`Array []`)
})

test('display can be used to display funny numbers', () => {
  return expectDisplayResult(
    `display(1e38); display(NaN); display(Infinity);`
  ).toMatchInlineSnapshot(`Array []`)
})

test('display can be used to display (escaped) strings', () => {
  return expectDisplayResult(
    `display("Tom's assisstant said: \\"tuna.\\"");`
  ).toMatchInlineSnapshot(`Array []`)
})

test('raw_display can be used to display (unescaped) strings directly', () => {
  return expectDisplayResult(
    `raw_display("Tom's assisstant said: \\"tuna.\\"");`
  ).toMatchInlineSnapshot(`Array []`)
})

test('display can be used to display functions', () => {
  return expectDisplayResult(`display(x => x); display((x, y) => x + y);`).toMatchInlineSnapshot(
    `Array []`
  )
})

test('display can be used to display lists', () => {
  return expectDisplayResult(`display(list(1, 2));`, Chapter.SOURCE_2).toMatchInlineSnapshot(
    `Array []`
  )
})

test('display can be used to display arrays', () => {
  return expectDisplayResult(`display([1, 2, [4, 5]]);`, {
    chapter: Chapter.SOURCE_3
  }).toMatchInlineSnapshot(`Array []`)
})

test('display can be used to display objects', () => {
  return expectDisplayResult(`display({a: 1, b: 2, c: {d: 3}});`, {
    chapter: Chapter.LIBRARY_PARSER
  }).toMatchInlineSnapshot(`Array []`)
})

test('display with no arguments throws an error', () => {
  return expectParsedError(`display();`, { chapter: Chapter.LIBRARY_PARSER }).toMatchInlineSnapshot(
    `"Line 1: Expected 1 or more arguments, but got 0."`
  )
})
