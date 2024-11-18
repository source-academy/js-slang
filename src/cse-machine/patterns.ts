// a single transformer stored within the transformers component
// will be henceforth referred to as a "transformer".
// it consists of a set of literals used as additional syntax,
// a pattern (for a list to match against)
// and a final template (for the list to be transformed into).
import { List, Pair } from '../stdlib/list'
import { _Symbol } from '../alt-langs/scheme/scm-slang/src/stdlib/base'
import {
  arrayToImproperList,
  arrayToList,
  flattenList,
  improperListLength,
  isImproperList,
  isPair,
  isList
} from './macro-utils'
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

// we use the match() function to match a list against a pattern and literals
// and verify if it is a match.
export function match(input: any, pattern: any, literals: string[]): boolean {
  // we should compare the input and pattern based on the possible forms of pattern:
  // 1. an identifier
  // 2. a literal such as null, a number, a string, or a boolean
  // 3. (<pattern>+)
  // 4. (<pattern>+ . <pattern>)
  // 5. (<pattern>+ ... <pattern>+)
  // 6. (<pattern>+ ... <pattern>+ . <pattern>)

  // case 1
  if (pattern instanceof _Symbol && literals.includes(pattern.sym)) {
    return input instanceof _Symbol && input.sym === pattern.sym
  }

  if (pattern instanceof _Symbol) {
    return !(input instanceof _Symbol && literals.includes(input.sym))
  }

  // case 2
  if (pattern === null) {
    return input === null
  }

  if (is_number(pattern)) {
    return is_number(input) && atomic_equals(input, pattern)
  }

  if (typeof pattern === 'string' || typeof pattern === 'boolean' || typeof pattern === 'number') {
    return input === pattern
  }

  // case 3 and 5
  if (isList(pattern)) {
    if (!isList(input)) {
      return false
    }
    const inputList = flattenList(input)
    const patternList = flattenList(pattern)
    // there can be a single ellepsis in the pattern, but it must be behind some element.
    // scan the pattern for the ... symbol.
    // we will need the position of the ... symbol to compare the front and back of the list.
    const ellipsisIndex = patternList.findIndex(
      elem => elem instanceof _Symbol && elem.sym === '...'
    )

    // case 5
    if (ellipsisIndex !== -1) {
      // if the input is shorter than the pattern (minus the ... and matching pattern), it can't match.
      if (inputList.length < patternList.length - 2) {
        return false
      }

      const frontPatternLength = ellipsisIndex - 1
      const ellipsisPattern = patternList[ellipsisIndex - 1]
      const backPatternLength = patternList.length - ellipsisIndex - 1

      // compare the front of the list with the front of the pattern as per normal
      for (let i = 0; i < frontPatternLength; i++) {
        if (!match(inputList[i], patternList[i], literals)) {
          return false
        }
      }

      // compare the items that should be captured by the ellipsis
      for (let i = frontPatternLength; i < inputList.length - backPatternLength; i++) {
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

    // case 3
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

  // case 4 and 6
  if (isImproperList(pattern)) {
    // if the input is not a pair, it can't match.
    if (!isPair(input)) {
      return false
    }

    let currEllipsisPattern
    let currentPattern = pattern
    let currentInput = input
    let ellipsisFound = false

    // iterate through currentPattern while it is a pair
    while (isPair(currentPattern)) {
      if (!isPair(currentInput)) {
        return false
      }
      const [headPattern, tailPattern] = currentPattern
      const [headInput, tailInput] = currentInput

      // we can lookahead to see if the ellipsis symbol is the next pattern element.
      if (
        isPair(tailPattern) &&
        tailPattern[0] instanceof _Symbol &&
        tailPattern[0].sym === '...'
      ) {
        ellipsisFound = true
        currEllipsisPattern = headPattern
        // skip ahead to the (cddr pattern) for the next iteration
        // the cddr is what "remains" of the pattern after the ellipsis.
        currentPattern = tailPattern[1]
        continue
      }

      // if the ellipis is found, continue to match the pattern until the ellipsis is exhausted.
      // (this is done by comparing the length of the input to the length of the remaining pattern)
      if (ellipsisFound && improperListLength(currentInput) > improperListLength(currentPattern)) {
        // match the headInput with the currEllipsisPattern
        if (!match(headInput, currEllipsisPattern, literals)) {
          return false
        }
        currentInput = tailInput // move to the next input
        continue
      }

      // if the ellipsis symbol is not found, or we have already matched the ellipsis pattern,
      // match the headInput with the headPattern
      if (!match(headInput, headPattern, literals)) {
        return false
      }
      currEllipsisPattern = headPattern
      currentPattern = tailPattern
      currentInput = tailInput
    }
    // now we can compare the last item in the pattern with the rest of the input
    return match(currentInput, currentPattern, literals)
  }

  return false
}

// once a pattern is matched, we need to collect all of the matched variables.
// ONLY called on matching patterns.
export function collect(input: any, pattern: any, literals: string[]): Map<string, any[]> {
  const collected = new Map<string, (List | _Symbol)[]>()
  // we should compare the input and pattern based on the possible forms of pattern:
  // 1. an identifier
  // 2. a literal such as null, a number, a string, or a boolean
  // 3. (<pattern>+)
  // 4. (<pattern>+ . <pattern>)
  // 5. (<pattern>+ ... <pattern>+)
  // 6. (<pattern>+ ... <pattern>+ . <pattern>)

  // case 1
  if (pattern instanceof _Symbol && !literals.includes(pattern.sym)) {
    if (!collected.has(pattern.sym)) {
      collected.set(pattern.sym, [])
    }
    collected.get(pattern.sym)?.push(input)
    return collected
  }

  // case 2
  if (pattern === null) {
    return collected
  }

  if (is_number(pattern)) {
    return collected
  }

  if (typeof pattern === 'string' || typeof pattern === 'boolean' || typeof pattern === 'number') {
    return collected
  }

  // cases 3 and 5
  if (isList(pattern)) {
    const inputList = flattenList(input)
    const patternList = flattenList(pattern)
    const ellipsisIndex = patternList.findIndex(
      elem => elem instanceof _Symbol && elem.sym === '...'
    )

    // case 5
    if (ellipsisIndex !== -1) {
      const frontPatternLength = ellipsisIndex - 1
      const ellipsisPattern = patternList[ellipsisIndex - 1]
      const backPatternLength = patternList.length - ellipsisIndex - 1

      for (let i = 0; i < frontPatternLength; i++) {
        const val = collect(inputList[i], patternList[i], literals)
        for (let [key, value] of val) {
          if (!collected.has(key)) {
            collected.set(key, [])
          }
          collected.get(key)?.push(...value)
        }
      }

      for (let i = frontPatternLength; i < inputList.length - backPatternLength; i++) {
        const val = collect(inputList[i], ellipsisPattern, literals)
        for (let [key, value] of val) {
          if (!collected.has(key)) {
            collected.set(key, [])
          }
          collected.get(key)?.push(...value)
        }
      }

      for (let i = inputList.length - backPatternLength; i < inputList.length; i++) {
        const val = collect(
          inputList[i],
          patternList[i - (inputList.length - patternList.length)],
          literals
        )
        for (let [key, value] of val) {
          if (!collected.has(key)) {
            collected.set(key, [])
          }
          collected.get(key)?.push(...value)
        }
      }
      return collected
    }

    // case 3
    for (let i = 0; i < inputList.length; i++) {
      const val = collect(inputList[i], patternList[i], literals)
      for (let [key, value] of val) {
        if (!collected.has(key)) {
          collected.set(key, [])
        }
        collected.get(key)?.push(...value)
      }
    }
    return collected
  }

  // case 4 and 6
  if (isImproperList(pattern)) {
    let currEllipsisPattern
    let currentPattern = pattern
    let currentInput = input
    let ellipsisFound = false

    // iterate through currentPattern while it is a pair
    while (isPair(currentPattern)) {
      const [headPattern, tailPattern] = currentPattern
      const [headInput, tailInput] = currentInput

      // we can lookahead to see if the ellipsis symbol is the next pattern element.
      if (
        isPair(tailPattern) &&
        tailPattern[0] instanceof _Symbol &&
        tailPattern[0].sym === '...'
      ) {
        ellipsisFound = true
        currEllipsisPattern = headPattern
        // skip ahead to the (cddr pattern) for the next iteration
        // the cddr is what "remains" of the pattern after the ellipsis.
        currentPattern = tailPattern[1]
        continue
      }

      // if the ellipis is found, continue to match the pattern until the ellipsis is exhausted.
      // (this is done by comparing the length of the input to the length of the remaining pattern)
      // it may be the case that the ellipsis pattern is not matched at all.
      if (ellipsisFound && improperListLength(currentInput) > improperListLength(currentPattern)) {
        const val = collect(headInput, currEllipsisPattern, literals)
        for (let [key, value] of val) {
          if (!collected.has(key)) {
            collected.set(key, [])
          }
          collected.get(key)?.push(...value)
        }
        currentInput = tailInput // move to the next input
        continue
      }

      // if the ellipsis symbol is not found, or we have already matched the ellipsis pattern,
      // match the headInput with the headPattern
      const val = collect(headInput, headPattern, literals)
      for (let [key, value] of val) {
        if (!collected.has(key)) {
          collected.set(key, [])
        }
        collected.get(key)?.push(...value)
      }
      currEllipsisPattern = headPattern
      currentPattern = tailPattern
      currentInput = tailInput
    }
    // now we can compare the last item in the pattern with the rest of the input
    const val = collect(currentInput, currentPattern, literals)
    for (let [key, value] of val) {
      if (!collected.has(key)) {
        collected.set(key, [])
      }
      collected.get(key)?.push(...value)
    }
    return collected
  }

  return collected
}

// when matched against a pattern, we use the transform() function
// to transform the list into the template.
// returns a list, a pair, or any value, as determined by the template.
export function transform(
  template: any,
  collected: Map<string, any[]>,
  indexToCollect: number = 0
): any {
  // there are 5 possible forms of the template:
  // 1. an identifier
  // 2. a literal such as null, a number, a string, or a boolean
  // 3. (... <template>)
  // 4. (<element>+)
  // 5. (<element>+ . <template>)
  // where <element> is <template> | <template> ...

  // case 1
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

  // case 2
  if (template === null) {
    return null
  }

  if (
    typeof template === 'string' ||
    typeof template === 'boolean' ||
    typeof template === 'number'
  ) {
    return template
  }

  if (is_number(template)) {
    return template
  }

  // case 3
  if (
    isList(template) &&
    template !== null &&
    template[0] instanceof _Symbol &&
    template[0].sym === '...'
  ) {
    // parser should ensure that the ellipsis is followed by a single value.
    // this value is the template to be used.
    // get the cadr of the template and return it.
    return template[1][0]
  }

  // collects all items in an ellipsis template to be used in the final list.
  // helper function for dealing with ellipsis templates.
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

  // case 4
  if (isList(template)) {
    const templateList = flattenList(template)
    const transformedList: any[] = []
    for (let i = 0; i < templateList.length; i++) {
      if (templateList[i] instanceof _Symbol && templateList[i].sym === '...') {
        // if the ellipsis symbol is found, we can skip ahead to the next template
        // as the ellipsis symbol is not used in the transformation.
        continue
      }
      // lookahead for the ellipsis symbol
      if (
        i + 1 < templateList.length &&
        templateList[i + 1] instanceof _Symbol &&
        templateList[i + 1].sym === '...'
      ) {
        const currEllipsisPattern = templateList[i]
        const items = deepFlatten(currEllipsisPattern)
        // add items to the transformed list
        // until the templates are exhausted.
        let currIndex = 0
        while (true) {
          // check if all items are exhausted
          let itemsAreExhausted = false
          for (let j = 0; j < items.length; j++) {
            if (!collected.has(items[j].sym)) {
              itemsAreExhausted = true
              break
            }
            if (
              collected.has(items[j].sym) &&
              currIndex >= (collected.get(items[j].sym) as any[]).length
            ) {
              itemsAreExhausted = true
              break
            }
          }
          if (itemsAreExhausted) {
            break
          }
          // apply the last ellipsis template again
          transformedList.push(transform(currEllipsisPattern, collected, currIndex))
          currIndex++
        }
        continue
      }
      transformedList.push(transform(templateList[i], collected))
    }
    return arrayToList(transformedList)
  }

  // case 5
  if (isImproperList(template)) {
    let currEllipsisPattern: any = undefined
    let currentPattern = template

    let collectedItems: any[] = []

    // iterate through currentPattern while it is a pair
    while (isPair(currentPattern)) {
      const [headPattern, tailPattern] = currentPattern

      // we can lookahead to see if the ellipsis symbol is the next pattern element.
      if (
        isPair(tailPattern) &&
        tailPattern[0] instanceof _Symbol &&
        tailPattern[0].sym === '...'
      ) {
        currEllipsisPattern = headPattern
        // skip ahead to the (cddr pattern) for the next iteration
        // the cddr is what "remains" of the pattern after the ellipsis.
        currentPattern = tailPattern[1]
        continue
      }

      // if a current ellipsis pattern exists, we continue collecting items from it until it is exhausted.
      // then we undefine the current ellipsis pattern.
      if (currEllipsisPattern !== undefined) {
        const items = deepFlatten(currEllipsisPattern)
        let currIndex = 0
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
              currIndex >= (collected.get(items[i].sym) as any[]).length
            ) {
              itemsAreExhausted = true
              break
            }
          }
          if (itemsAreExhausted) {
            break
          }
          // add the ellipsis pattern to the collected items
          collectedItems.push(transform(currEllipsisPattern, collected, currIndex))
          currIndex++
        }
        currEllipsisPattern = undefined
        continue
      }
      collectedItems.push(transform(headPattern, collected))
      currentPattern = tailPattern
    }
    // now we can compare the last item in the pattern with the rest of the input
    const val = transform(currentPattern, collected)
    return arrayToImproperList(collectedItems, val)
  }
  return template
}
