import { expect, test } from 'vitest'
import { schemeVisualise } from "../scheme-mapper"
import { make_number } from "../scm-slang/src/stdlib/core-math"
import { circular$45$list, cons, cons$42$, list } from "../scm-slang/src/stdlib/base"

test("schemeVisualise: should visualise null properly", () => {
  expect(schemeVisualise(null).toString()).toEqual("()")
})

test("schemeVisualise: should visualise undefined properly", () => {
  expect(schemeVisualise(undefined).toString()).toEqual("undefined")
})

test("schemeVisualise: should visualise strings properly", () => {
  expect(schemeVisualise("hello").toString()).toEqual("\"hello\"")
})

test("schemeVisualise: should visualise scheme numbers properly", () => {
  expect(schemeVisualise(make_number("1i")).toString()).toEqual("0+1i")
})

test("schemeVisualise: should visualise booleans properly", () => {
  expect(schemeVisualise(true).toString()).toEqual("#t")
  expect(schemeVisualise(false).toString()).toEqual("#f")
})

test("schemeVisualise: should visualise circular lists properly", () => {
  const circularList = circular$45$list(1, 2, 3)
  //expect(schemeVisualise(circularList).toString()).toEqual("#0=(1 2 3 . #0#)")
  //for now, this will do
  expect(schemeVisualise(circularList).toString()).toEqual("(circular list)")
})

test("schemeVisualise: should visualise dotted lists properly", () => {
  const dottedList = cons$42$(1, 2, 3)
  expect(schemeVisualise(dottedList).toString()).toEqual("(1 2 . 3)")
})

test("schemeVisualise: should visualise proper lists properly", () => {
  const properList = list(1, 2, 3, 4)
  expect(schemeVisualise(properList).toString()).toEqual("(1 2 3 4)")
})

test("schemeVisualise: should visualise vectors properly", () => {
  const vector = [1, 2, 3, 4]
  expect(schemeVisualise(vector).toString()).toEqual("#(1 2 3 4)")
})

test("schemeVisualise: should visualise pairs properly", () => {
  const pair = cons(1, 2)
  expect(schemeVisualise(pair).toString()).toEqual("(1 . 2)")
})

test("schemeVisualise: vectors and pairs should be distinct", () => {
  const maybe_pair = [1, 2]
  expect(schemeVisualise(maybe_pair).toString()).toEqual("#(1 2)")
})

export { schemeVisualise }
