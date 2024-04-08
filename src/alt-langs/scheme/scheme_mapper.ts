import { ArrowFunctionExpression, Identifier, RestElement } from "estree"
import Closure from "../../interpreter/closure"
import { decode, estreeDecode } from "./scm-slang/src"
import { boolean$63$, car, cdr, circular$45$list$63$, cons, dotted$45$list$63$, last$45$pair, list$45$tail, null$63$, number$63$, pair$63$, proper$45$list$63$, set$45$cdr$33$, vector$63$ } from "./scm-slang/src/stdlib/source-scheme-library"
import { ErrorType, Result, SourceError } from "../../types"
import { List, Pair } from "../../stdlib/list"
import { Representation } from "../mapper"

export function mapResultToScheme(res: Result): Result {
  if (res.status === "finished" || res.status === "suspended-non-det") {
    return {
      ...res,
      value: decodeValue(res.value),
      representation: showSchemeData(res.value)
    }
  }
  return res
}

// Given an error, decode its message if and
// only if an encoded value may exist in it.
export function mapErrorToScheme(error: SourceError): SourceError {
  if (error.type === ErrorType.SYNTAX) {
    // Syntax errors are not encoded.
    return error
  }
  const newExplain = decodeString(error.explain())
  const newElaborate = decodeString(error.elaborate())
  return {
    ...error,
    explain: () => newExplain,
    elaborate: () => newElaborate
  }
}

function showSchemeData(data: any): Representation {
  return schemeVisualise(decodeValue(data))
}

function decodeString(str: string): string {
  return str.replace(/\$scheme_[\w$]+|\$\d+\$/g, match => {
    return decode(match)
  })
}

// Given any value, change the representation of it to
// the required scheme representation.
function schemeVisualise(x: any): Representation {
  function stringify(x: any): string {
    if (null$63$(x)) {
      return '()'
    } else if (x === undefined) {
      return 'undefined'
    } else if (typeof x === 'string') {
      return `"${x}"`
    } else if (number$63$(x)) {
      return x.toString()
    } else if (boolean$63$(x)) {
      return x ? '#t' : '#f'
    } else if (x instanceof Closure) {
      const node = x.originalNode
      const parameters = node.params.map((param: Identifier | RestElement) => param.type === "Identifier" ? param.name : ". " + (param.argument as Identifier).name).join(' ').trim()
      return `#<procedure (${parameters})>`
    } else if (circular$45$list$63$(x)) {
      return '(circular list)'
    } else if (pair$63$(x) && dotted$45$list$63$(x)) {
      let string = '('
      let current = x
      while (pair$63$(current)) {
        string += `${schemeVisualise(car(current))} `
        current = cdr(current)
      }
      return string.trim() + ` . ${schemeVisualise(current)})`
    } else if (proper$45$list$63$(x)) {
      let string = '('
      let current = x
      while (current !== null) {
        string += `${schemeVisualise(car(current))} `
        current = cdr(current)
      }
      return string.trim() + ')'
    } else if (vector$63$(x)) {
      let string = '#('
      for (let i = 0; i < x.length; i++) {
        string += `${schemeVisualise(x[i])} `
      }
      return string.trim() + ')'
    } else {
      return x.toString()
    }
  }

  // return an object with a toString method that returns the stringified version of x
  return new Representation(stringify(x))
}

// Given any value, decode it if and
// only if an encoded value may exist in it.
// this function is used to accurately display
// values in the REPL.
export function decodeValue(x: any): any {
  // helper version of list_tail that assumes non-null return value
  function list_tail(xs: List, i: number): List {
    if (i === 0) {
      return xs
    } else {
      return list_tail(list$45$tail(xs), i - 1)
    }
  }

  if (circular$45$list$63$(x)) {
    // May contain encoded strings.
    let circular_pair_index = -1
    const all_pairs: Pair<any, any>[] = []

    // iterate through all pairs in the list until we find the circular pair
    let current = x
    while (current !== null) {
      if (all_pairs.includes(current)) {
        circular_pair_index = all_pairs.indexOf(current)
        break
      }
      all_pairs.push(current)
      current = cdr(current)
    }

    // assemble a new list using the elements in all_pairs
    let new_list = null
    for (let i = all_pairs.length - 1; i >= 0; i--) {
      new_list = cons(decodeValue(car(all_pairs[i])), new_list)
    }

    // finally we can set the last cdr of the new list to the circular-pair itself

    const circular_pair = list_tail(new_list, circular_pair_index)
    set$45$cdr$33$(last$45$pair(new_list), circular_pair)
    return new_list
  } else if (pair$63$(x)) {
    // May contain encoded strings.
    return cons(decodeValue(car(x)), decodeValue(cdr(x)))
  } else if (vector$63$(x)) {
    // May contain encoded strings.
    return x.map(decodeValue)
  } else if (x instanceof Closure) {
    const newNode = estreeDecode(x.originalNode) as ArrowFunctionExpression

    // not a big fan of mutation, but we assert we will never need the original node again anyway
    x.node = newNode
    x.originalNode = newNode
    return x
  } else if (typeof x === 'function') {
    // copy x to avoid modifying the original object
    const newX = { ...x }
    const newString = decodeString(x.toString())
    // change the toString method to return the decoded string
    newX.toString = () => newString
    return newX
  } else {
    // string, number, boolean, null, undefined
    // no need to decode.
    return x
  }
}

