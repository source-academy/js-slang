// a single pattern stored within the patterns component
// will be henceforth referred to as a "transformer".
// it consists of a set of literals used as additional syntax,
// a pattern (for a list to match against)
// and a final template (for the list to be transformed into).
import { List, Pair } from '../stdlib/list'
import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import { flattenList, isList } from './scheme-macros'
import { atomic_equals, is_number } from '../alt-langs/scheme/scm-slang/src/stdlib/core-math'

// a single pattern stored within the patterns component
// may have several transformers attributed to it.
export class Transformer {
  literals: string[]
  pattern: List
  template: List

  constructor(literals: string[], pattern: List, template: List) {
    this.literals = literals
    this.pattern = pattern
    this.template = template
  }
}

// given a matching transformer,
// the macro_transform() function will transform a list
// into the template of the transformer.
export function macro_transform(input: any, transformer: Transformer): any {
  const collected = collect(input, transformer.pattern, transformer.literals)
  return transform(transformer.template, collected)
}

export function arrayToList(arr: any[]): List {
  if (arr.length === 0) {
    return null
  }
  const pair: any[] = [arr[0], arrayToList(arr.slice(1))] as any[]
  ;(pair as any).pair = true
  return pair as List
}

export function arrayToImproperList(arr: any[], last: any): any {
  if (arr.length === 0) {
    return last
  }
  const pair: any[] = [arr[0], arrayToImproperList(arr.slice(1), last)] as any[]
  ;(pair as any).pair = true
  return pair
}

export function isImproperList(value: any): boolean {
  if (value === null) {
    return false
  }
  return Array.isArray(value) && value.length === 2 && !isList(value[1])
}

export function flattenImproperList(value: any): [any[], any] {
  let items = []
  let working = value
  while (working instanceof Array && working.length === 2) {
    items.push(working[0])
    working = working[1]
  }
  return [items, working]
}

// we use the match() function to match a list against a pattern and literals
// and verify if it is a match.
export function match(input: any, pattern: any, literals: string[]): boolean {
  // deal with the cases where the pattern is a literal - a Scheme Number, string, or boolean
  if (typeof pattern === 'string' || typeof pattern === 'boolean') {
    return input === pattern
  }

  if (is_number(pattern)) {
    return atomic_equals(input, pattern)
  }

  if (pattern instanceof _Symbol && !literals.includes(pattern.sym)) {
    // this will match whatever the input list is unless it is
    // a literal in the literals list. (ie syntax)
    return !(input instanceof _Symbol && literals.includes(input.sym))
  }

  if (pattern instanceof _Symbol && literals.includes(pattern.sym)) {
    // only match if the input is the same as the pattern
    return input instanceof _Symbol && input.sym === pattern.sym
  }

  // at this point, we know that the pattern is a list or improper list
  // make sure that the input is one too.
  if (!isList(input) && !isImproperList(input)) {
    return false
  }

  // we know that both the pattern and inputs are at least pairs now.
  // we can take the head and tails of both.
  if (isImproperList(pattern)) {
    if (input === null) {
      return false
    }
    const [patternHead, patternTail] = pattern as [any, any]
    const [inputHead, inputTail] = input as [any, any]
    return match(inputHead, patternHead, literals) && match(inputTail, patternTail, literals)
  }

  // at this point, the pattern is a list.
  // if the input is not a list, it can't match.
  if (!isList(input)) {
    return false
  }

  // now we know that both the pattern and list are lists.
  // we can match the elements of the list against the pattern,
  // but we also need to compare and check for the ... syntax.
  if (input === null && pattern === null) {
    return true
  }

  // it's easier to reason about the lists as arrays for now.
  const inputList = flattenList(input)
  const patternList = flattenList(pattern)

  // there can be a single ellepsis in the pattern, but it must be behind some element.
  // scan the pattern for the ... symbol.
  // we will need the position of the ... symbol to compare the front and back of the list.
  const ellipsisIndex = patternList.findIndex(elem => elem instanceof _Symbol && elem.sym === '...')

  // check if an ellipsis exists within the pattern.
  if (ellipsisIndex !== -1) {
    // if the input is shorter than the pattern (minus the ...), it can't match.
    if (inputList.length < patternList.length - 1) {
      return false
    }

    const frontPatternLength = ellipsisIndex
    const ellipsisPattern = patternList[ellipsisIndex - 1]
    const backPatternLength = patternList.length - ellipsisIndex - 1

    // compare the front of the list with the front of the pattern as per normal
    for (let i = 0; i < frontPatternLength; i++) {
      if (!match(inputList[i], patternList[i], literals)) {
        return false
      }
    }

    // compare the items that should be captured by the ellipsis
    for (let i = ellipsisIndex; i < inputList.length - backPatternLength; i++) {
      if (!match(inputList[i], ellipsisPattern, literals)) {
        return false
      }
    }

    // now we can compare the back of the list with the rest of the patterns
    for (let i = inputList.length - backPatternLength; i < inputList.length; i++) {
      if (
        !match(inputList[i], patternList[i - (inputList.length - patternList.length)], literals)
      ) {
        return false
      }
    }

    // else all is good and return true
    return true
  }

  // here, we have no ... syntax.

  // we can just compare the elements of the list with the pattern.
  if (inputList.length !== patternList.length) {
    return false
  }

  for (let i = 0; i < inputList.length; i++) {
    if (!match(inputList[i], patternList[i], literals)) {
      return false
    }
  }

  return true
}

// once a pattern is matched, we need to collect all of the matched variables.
// ONLY called on matching patterns.
function collect(input: any, pattern: any, literals: string[]): Map<string, any[]> {
  const collected = new Map<string, (List | _Symbol)[]>()
  // deal with the cases where the pattern is a literal - a Scheme Number, string, or boolean
  if (typeof pattern === 'string' || typeof pattern === 'boolean') {
    return collected
  }

  if (is_number(pattern)) {
    return collected
  }

  if (pattern instanceof _Symbol && !literals.includes(pattern.sym)) {
    // collect the matching input here
    collected.set(pattern.sym, [input])
    return collected
  }

  if (pattern instanceof _Symbol && literals.includes(pattern.sym)) {
    // pattern is a syntax literal, don't collect anything
    return collected
  }

  if (pattern instanceof _Symbol && (pattern.sym === '_' || pattern.sym === '...')) {
    // don't collect anything
    return collected
  }

  // match on an improper list pattern
  if (isImproperList(pattern)) {
    const [patternHead, patternTail] = pattern as [any, any]
    const [inputHead, inputTail] = input as [any, any]

    // collect the head
    const collectedFirst = collect(inputHead, patternHead, literals)
    for (const [key, value] of collectedFirst) {
      collected.set(key, value)
    }

    // collect the tail
    const collectedSecond = collect(inputTail, patternTail, literals)
    for (const [key, value] of collectedSecond) {
      collected.set(key, value)
    }

    return collected
  }

  // at this point, we know that the pattern is a list
  // and the input should be too
  if (!isList(input)) {
    return collected
  }

  if ((input == pattern) == null) {
    // should be empty
    return collected
  }

  const inputList = flattenList(input)
  const patternList = flattenList(pattern)
  // there can be a single ellepsis in the pattern, but it must be behind some element.
  // scan the pattern for the ... symbol.
  // we will need the position of the ... symbol to compare the front and back of the list.
  const ellipsisIndex = patternList.findIndex(elem => elem instanceof _Symbol && elem.sym === '...')

  // check if an ellipsis exists within the pattern.
  if (ellipsisIndex !== -1) {
    const frontPatternLength = ellipsisIndex
    const ellipsisPattern = patternList[ellipsisIndex - 1]
    const backPatternLength = patternList.length - ellipsisIndex - 1

    // collect items from the front of the list with the front of the pattern
    for (let i = 0; i < frontPatternLength; i++) {
      const collectedFront = collect(inputList[i], patternList[i], literals)
      for (const [key, value] of collectedFront) {
        if (collected.has(key)) {
          // add the collected items to the back of the list
          // (this preserves the order of the list)
          collected.set(key, [...(collected.get(key) as any[]), ...value])
        } else {
          collected.set(key, value)
        }
      }
    }

    // compare the items that should be captured by the ellipsis
    for (let i = ellipsisIndex; i < inputList.length - backPatternLength; i++) {
      const collectedEllipsis = collect(inputList[i], ellipsisPattern, literals)
      for (const [key, value] of collectedEllipsis) {
        if (collected.has(key)) {
          collected.set(key, [...(collected.get(key) as any[]), ...value])
        } else {
          collected.set(key, value)
        }
      }
    }

    // collect the rest of the list with the back of the pattern
    for (let i = inputList.length - backPatternLength; i < inputList.length; i++) {
      const collectedRest = collect(
        inputList[i],
        patternList[i - (inputList.length - patternList.length)],
        literals
      )
      for (const [key, value] of collectedRest) {
        if (collected.has(key)) {
          collected.set(key, [...(collected.get(key) as any[]), ...value])
        } else {
          collected.set(key, value)
        }
      }
    }

    return collected
  }

  // final case, where there is no ... syntax
  for (let i = 0; i < inputList.length; i++) {
    const collectedItems = collect(inputList[i], patternList[i], literals)
    for (const [key, value] of collectedItems) {
      if (collected.has(key)) {
        collected.set(key, [...(collected.get(key) as any[]), ...value])
      } else {
        collected.set(key, value)
      }
    }
  }

  return collected
}

// when matched against a pattern, we use the transform() function
// to transform the list into the template.
// returns a list, a pair, or any value, as determined by the template.
function transform(template: any, collected: Map<string, any[]>, indexToCollect: number = 0): any {
  // deal with the cases where the template is a literal - a Scheme Number, string, or boolean
  if (typeof template === 'string' || typeof template === 'boolean') {
    return template
  }

  if (is_number(template)) {
    return template
  }

  if (template instanceof _Symbol) {
    if (collected.has(template.sym)) {
      // get the item from the collected list,
      // remove it from the collected list,
      // and return it.
      const item = (collected.get(template.sym) as any[])[indexToCollect]
      return item
    }
    return template
  }

  if (isImproperList(template)) {
    const [head, tail] = template as [any, any]
    // assemble both parts of the template separately
    const firstPart = flattenList(transform(head, collected))
    const secondPart = transform(tail, collected)

    const newPair = [firstPart, secondPart] as any[]
    ;(newPair as any).pair = true
    return newPair
  }

  // at this point, its a list.
  const templateList = flattenList(template)

  // if the template is empty, return null
  if (templateList.length === 0) {
    return null
  }

  // if the template begins with the ... syntax, (... <value>)
  // it halts evaluation of the rest of the list.
  // (evaluation resolves to <value>)
  if (templateList[0] instanceof _Symbol && templateList[0].sym === '...') {
    return templateList[1]
  }

  // collects all items in an ellipsis template to be used in the final list.
  function deepFlatten(pair: Pair<any, any>): _Symbol[] {
    const items: _Symbol[] = []
    function flattenHelper(item: any) {
      if (item instanceof _Symbol && item.sym !== '...') {
        items.push(item)
      } else if (item === null) {
        return
      } else if (item instanceof Array && item.length === 2) {
        // based on the usage of (... <value>),
        // and our previous discussion on the viability
        // of ... within the ellipsis template
        // we can assume that any ellipsis used is used to halt macro expansion of <value>.
        if (item[0] instanceof _Symbol && item[0].sym === '...') {
          // do not collect any items here, this halts the collection
          return
        }
        // if its a pair, traverse both car and cdr
        flattenHelper(item[0])
        flattenHelper(item[1])
      }
    }
    flattenHelper(pair)
    return items
  }

  const transformedList: any[] = []
  let lastEllipsisTemplate: any

  // collect all items in the working list,
  // using the ellipsis templates if we need to.
  for (let i = 0; i < templateList.length; i++) {
    if (templateList[i] instanceof _Symbol && templateList[i].sym === '...') {
      // if we have an ellipsis, collect all items as necessary.
      // we track these items, and apply the last ellipsis template again
      // until these items are exhausted.
      const items = deepFlatten(lastEllipsisTemplate)
      // start at 1, since the first item has already been collected once.
      let collectingIndex = 1
      while (true) {
        // check if all items are exhausted
        let itemsAreExhausted = false
        for (let i = 0; i < items.length; i++) {
          if (!collected.has(items[i].sym)) {
            itemsAreExhausted = true
            break
          }
          if (
            collected.has(items[i].sym) &&
            (collected.get(items[i].sym) as any[]).length <= collectingIndex
          ) {
            itemsAreExhausted = true
            break
          }
        }
        if (itemsAreExhausted) {
          break
        }
        // apply the last ellipsis template again
        transformedList.push(transform(lastEllipsisTemplate, collected, collectingIndex))
        collectingIndex++
      }
      continue
    }
    // store this template for any ellipsis.
    lastEllipsisTemplate = templateList[i]
    transformedList.push(transform(templateList[i], collected))
  }
  return arrayToList(transformedList)
}
