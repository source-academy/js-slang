import { Chapter } from '../types'
import { expectDisplayResult, expectParsedError } from '../utils/testing'

test('display throw error if second argument is non-string when used', () => {
  return expectParsedError(`display(31072020, 0xDEADC0DE);`).toMatchInlineSnapshot(
    `"Line 1: TypeError: display expects the second argument to be a string"`
  )
})

test('display second argument can be a string', () => {
  return expectDisplayResult(`display(31072020, "my_first_String");`, { native: true })
    .toMatchInlineSnapshot(`
            Array [
              "my_first_String 31072020",
            ]
          `)
})

test('display can be used to display numbers', () => {
  return expectDisplayResult(`display(0);`, { native: true }).toMatchInlineSnapshot(`
Array [
  "0",
]
`)
})

test('display can be used to display funny numbers', () => {
  return expectDisplayResult(`display(1e38); display(NaN); display(Infinity);`, { native: true })
    .toMatchInlineSnapshot(`
Array [
  "1e+38",
  "NaN",
  "Infinity",
]
`)
})

test('display can be used to display (escaped) strings', () => {
  return expectDisplayResult(`display("Tom's assisstant said: \\"tuna.\\"");`, { native: true })
    .toMatchInlineSnapshot(`
Array [
  "\\"Tom's assisstant said: \\\\\\"tuna.\\\\\\"\\"",
]
`)
})

test('raw_display can be used to display (unescaped) strings directly', () => {
  return expectDisplayResult(`raw_display("Tom's assisstant said: \\"tuna.\\"");`, { native: true })
    .toMatchInlineSnapshot(`
Array [
  "Tom's assisstant said: \\"tuna.\\"",
]
`)
})

test('display can be used to display functions', () => {
  return expectDisplayResult(`display(x => x); display((x, y) => x + y);`).toMatchInlineSnapshot(`
Array [
  "x => x",
  "(x, y) => x + y",
]
`)
})

test('display can be used to display lists', () => {
  return expectDisplayResult(`display(list(1, 2));`, { chapter: Chapter.SOURCE_2, native: true })
    .toMatchInlineSnapshot(`
Array [
  "[1, [2, null]]",
]
`)
})

test('display can be used to display arrays', () => {
  return expectDisplayResult(`display([1, 2, [4, 5]]);`, {
    chapter: Chapter.SOURCE_3,
    native: true
  }).toMatchInlineSnapshot(`
Array [
  "[1, 2, [4, 5]]",
]
`)
})

test('display can be used to display objects', () => {
  return expectDisplayResult(`display({a: 1, b: 2, c: {d: 3}});`, {
    chapter: Chapter.LIBRARY_PARSER
  }).toMatchInlineSnapshot(`
Array [
  "{\\"a\\": 1, \\"b\\": 2, \\"c\\": {\\"d\\": 3}}",
]
`)
})

test('display with no arguments throws an error', () => {
  return expectParsedError(`display();`, { chapter: Chapter.LIBRARY_PARSER }).toMatchInlineSnapshot(
    `"Line 1: Expected 1 or more arguments, but got 0."`
  )
})
