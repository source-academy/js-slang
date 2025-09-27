import { Program } from 'estree'
import { schemeParse } from '../../alt-langs/scheme/scm-slang/src'
import { Context } from '../../types'
import { Chapter } from '../../langs'
import { FatalSyntaxError } from '../errors'
import { AcornOptions, Parser } from '../types'
import { positionToSourceLocation } from '../utils'

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
      return schemeParse(programStr, this.chapter, true)
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
