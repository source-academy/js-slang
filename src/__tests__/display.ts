import { expectDisplayResult } from '../utils/testing'

test('display can be used to display numbers', () => {
  return expectDisplayResult(`display(0);`).toMatchInlineSnapshot(`
Array [
  "0",
]
`)
})

test('display can be used to display funny numbers', () => {
  return expectDisplayResult(`display(1e38); display(NaN); display(Infinity);`)
    .toMatchInlineSnapshot(`
Array [
  "1e+38",
  "NaN",
  "Infinity",
]
`)
})

test('display can be used to display (escaped) strings', () => {
  return expectDisplayResult(`display("Tom's assisstant said: \\"tuna.\\"");`)
    .toMatchInlineSnapshot(`
Array [
  "\\"Tom's assisstant said: \\\\\\"tuna.\\\\\\"\\"",
]
`)
})

test('raw_display can be used to display (unescaped) strings directly', () => {
  return expectDisplayResult(`raw_display("Tom's assisstant said: \\"tuna.\\"");`)
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
  return expectDisplayResult(`display(list(1, 2));`, 2).toMatchInlineSnapshot(`
Array [
  "[1, [2, null]]",
]
`)
})

test('display can be used to display arrays', () => {
  return expectDisplayResult(`display([1, 2, [4, 5]]);`, 3).toMatchInlineSnapshot(`
Array [
  "[1, 2, [4, 5]]",
]
`)
})

test('display can be used to display objects', () => {
  return expectDisplayResult(`display({a: 1, b: 2, c: {d: 3}});`, 100).toMatchInlineSnapshot(`
Array [
  "{\\"a\\": 1, \\"b\\": 2, \\"c\\": {\\"d\\": 3}}",
]
`)
})
