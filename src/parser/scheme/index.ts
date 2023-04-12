import { Node, Program } from 'estree'

import { decode, encode, schemeParse } from '../../scm-slang/src'
import { Pair } from '../../scm-slang/src/stdlib/source-scheme-library'
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
  // In future: add support for decoding vectors.
  if (x instanceof Pair) {
    // May contain encoded strings.
    return new Pair(decodeValue(x.car), decodeValue(x.cdr))
  } else if (x instanceof Array) {
    // May contain encoded strings.
    return x.map(decodeValue)
  } else if (x instanceof Function) {
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
