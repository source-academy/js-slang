import { schemeParse } from './scm-slang/src'
import { Program } from 'estree'

import { Chapter, Context} from '../../types'
import { FatalSyntaxError } from '../errors'
import { AcornOptions, Parser } from '../types'
import { positionToSourceLocation } from '../utils'

/**
 * Takes a Scheme identifier and encodes it to follow JS naming conventions.
 * 
 * @param identifier An identifier name.
 * @returns An encoded identifier that follows JS naming conventions.
 */
export function encode(identifier: string): string {
  return identifier
}

/**
 * Takes a JS identifier and decodes it to follow Scheme naming conventions.
 * 
 * @param identifier An encoded identifier name.
 * @returns A decoded identifier that follows Scheme naming conventions.
 */
export function decode(identifier: string): string {
  return identifier
}

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
      const chapterNum = (() => {switch(this.chapter) {
        case Chapter.SCHEME_1:
            return 1;
        case Chapter.SCHEME_2:
            return 2;
        case Chapter.SCHEME_3:
            return 3;
        case Chapter.SCHEME_4:
            return 4;
        default:
            // probably should throw an error here
            return undefined;
      }})();
      return schemeParse(programStr, chapterNum) as unknown as Program
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
    return true;
  }

  toString(): string {
    return `SchemeParser{chapter: ${this.chapter}}`;
  }
}
