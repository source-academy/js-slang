import type { List, Pair } from '../stdlib/list'

/**
 * Low-level check for a list.
 * @param value any value
 * @returns whether the value is a list
 */
export function isList(value: any): value is List {
  if (value === null) {
    return true
  }
  return Array.isArray(value) && value.length === 2 && isList(value[1])
}

/**
 * Turn a list into an array.
 * @param value a list
 * @returns
 */
export function flattenList(value: List): any[] {
  if (value === null) {
    return []
  }
  return [value[0], ...flattenList(value[1])]
}

/**
 * Convert an array into a list.
 * @param arr
 * @returns
 */
export function arrayToList(arr: any[]): List {
  return arrayToImproperList(arr, null) as List
}

/**
 * Convert an array into an improper list.
 * @param arr
 * @param last
 * @returns
 */
export function arrayToImproperList(arr: any[], last: any): any {
  if (arr.length === 0) {
    return last
  }
  const pair: any[] = [arr[0], arrayToImproperList(arr.slice(1), last)] as any[]
  ;(pair as any).pair = true
  return pair
}

/**
 * Check if a value is an improper list.
 * We force an improper list to be an array of two elements.
 * @param value
 * @returns
 */
export function isImproperList(value: any): value is Pair<any, any> {
  if (value === null) {
    return false
  }
  return Array.isArray(value) && value.length === 2 && !isList(value[1])
}

/**
 * Check if a value is a pair.
 * @param value
 * @returns
 */
export function isPair(value: any): value is Pair<any, any> {
  return Array.isArray(value) && value.length === 2
}

/**
 * Check if a value is a pair with nullary.
 * @param value
 * @returns
 */
export function isPairWithNullary(value: any): value is Pair<any, any> {
  return Array.isArray(value) && value.length === 2 && typeof value[1] === 'function' && (value[1] as Function).length === 0
}

/**
 * Convert an improper list into an array and a terminator.
 * @param value
 * @returns
 */
export function flattenImproperList(value: any): [any[], any] {
  let items = []
  let working = value
  while (working instanceof Array && working.length === 2) {
    items.push(working[0])
    working = working[1]
  }
  return [items, working]
}

/**
 * Get the length of an improper list.
 * @param value
 * @returns
 */
export function improperListLength(value: any): number {
  let length = 0
  let working = value
  while (isPair(working)) {
    length++
    working = working[1]
  }
  return length
}
