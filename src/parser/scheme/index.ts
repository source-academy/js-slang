import { Node, Program } from 'estree'

import { decode, encode, schemeParse } from '../../scm-slang/src'
import {
  car,
  cdr,
  circular$45$list$63$,
  cons,
  last$45$pair,
  list$45$tail,
  pair$63$,
  procedure$63$,
  set$45$cdr$33$,
  vector$63$
} from '../../scm-slang/src/stdlib/base'
import { List, Pair } from '../../stdlib/list'
import { Chapter, Context, ErrorType, SourceError } from '../../types'
import { FatalSyntaxError } from '../errors'
import { AcornOptions, Parser } from '../types'
import { positionToSourceLocation } from '../utils'
const walk = require('acorn-walk')

export class SchemeParser implements Parser<AcornOptions> {
  private chapter: number
  constructor(chapter: Chapter) {
    this.chapter = getSchemeChapter(chapter)
  }
  parse(
    programStr: string,
    context: Context,
    options?: Partial<AcornOptions>,
    throwOnError?: boolean
  ): Program | null {
    try {
      // parse the scheme code
      const estree = schemeParse(programStr, this.chapter)
      // walk the estree and encode all identifiers
      encodeTree(estree)
      return estree as unknown as Program
    } catch (error) {
      if (error instanceof SyntaxError) {
        error = new FatalSyntaxError(positionToSourceLocation((error as any).loc), error.toString())
      }

      if (throwOnError) throw error
      context.errors.push(error)
    }
    return null
  }

  validate(_ast: Program, _context: Context, _throwOnError: boolean): boolean {
    return true
  }

  toString(): string {
    return `SchemeParser{chapter: ${this.chapter}}`
  }
}

function getSchemeChapter(chapter: Chapter): number {
  switch (chapter) {
    case Chapter.SCHEME_1:
      return 1
    case Chapter.SCHEME_2:
      return 2
    case Chapter.SCHEME_3:
      return 3
    case Chapter.SCHEME_4:
      return 4
    case Chapter.FULL_SCHEME:
      return Infinity
    default:
      // Should never happen
      throw new Error(`SchemeParser was not given a valid chapter!`)
  }
}

export function encodeTree(tree: Program): Program {
  walk.full(tree, (node: Node) => {
    if (node.type === 'Identifier') {
      node.name = encode(node.name)
    }
  })
  return tree
}

function decodeString(str: string): string {
  return str.replace(/\$scheme_[\w$]+|\$\d+\$/g, match => {
    return decode(match)
  })
}

// Given any value, decode it if and
// only if an encoded value may exist in it.
export function decodeValue(x: any): any {
  // helper version of list_tail that ensures non-null return value
  function list_tail(xs: List, i: number): List {
    if (i === 0) {
      return xs
    } else {
      return list_tail(list$45$tail(xs), i - 1)
    }
  }
  // In future: add support for decoding vectors.
  if (circular$45$list$63$(x)) {
    // May contain encoded strings, but we want to avoid a stack overflow.
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
  } else if (procedure$63$(x)) {
    const newString = decodeString(x.toString())
    x.toString = () => newString
    return x
  } else {
    // string, number, boolean, null, undefined
    // no need to decode.
    return x
  }
}

// Given an error, decode its message if and
// only if an encoded value may exist in it.
export function decodeError(error: SourceError): SourceError {
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
