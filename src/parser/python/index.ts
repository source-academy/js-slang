import { Program } from 'estree'

import { Chapter, Context } from '../../types'
import { FatalSyntaxError } from '../errors'
import { AcornOptions, Parser } from '../types'
import { positionToSourceLocation } from '../utils'
import { parsePythonToEstreeAst } from '../../py-slang/src';

export class PythonParser implements Parser<AcornOptions> {
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
          case Chapter.PYTHON_1:
            return 1
        //   case Chapter.PYTHON_2:
        //     return 2
        //   case Chapter.PYTHON_3:
        //     return 3
        //   case Chapter.PYTHON_4:
        //     return 4
          default:
            return undefined
        }
      })()
      return parsePythonToEstreeAst(programStr, chapterNum, false)
    } catch (error) {
      if (error instanceof SyntaxError) {
        // @TODO should translate from the python 
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
    return `PythonParser{chapter: ${this.chapter}}`
  }
}