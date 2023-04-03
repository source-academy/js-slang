import { Node,Program } from 'estree'

import { Chapter, Context } from '../../types'
import { FatalSyntaxError } from '../errors'
import { AcornOptions, Parser } from '../types'
import { positionToSourceLocation } from '../utils'
import { encode,schemeParse } from './scm-slang/src'
const walk = require('acorn-walk')

export { schemeParse, decode } from './scm-slang/src'

export class SchemeParser implements Parser<AcornOptions> {
  private chapter: Chapter
  constructor(chapter: Chapter) {
    this.chapter = chapter
  }
  parse(
    programStr: string,
    context: Context,
    options?: Partial<AcornOptions>,
    throwOnError?: boolean
  ): Program | null {
    try {
      // parse the scheme code
      const chapterNum = (() => {
        switch (this.chapter) {
          case Chapter.SCHEME_1:
            return 1
          case Chapter.SCHEME_2:
            return 2
          case Chapter.SCHEME_3:
            return 3
          case Chapter.SCHEME_4:
            return 4
          default:
            return undefined
        }
      })()
      const estree = schemeParse(programStr, chapterNum);
      // walk the estree and encode all identifiers
      encodeTree(estree);
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

export function encodeTree(tree: Program): Program {
  walk.full(tree, (node: Node) => {
    if (node.type === 'Identifier') {
      node.name = encode(node.name)
    }
  });
  return tree
}
