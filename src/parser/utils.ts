import {
  Comment,
  ecmaVersion,
  Node,
  parse as acornParse,
  parseExpressionAt as acornParseAt,
  Position
} from 'acorn'
import { parse as acornLooseParse } from 'acorn-loose'
import { Program, SourceLocation } from 'estree'

import { Context } from '..'
import { DEFAULT_ECMA_VERSION } from '../constants'
import { SourceError } from '../types'
import { validateAndAnnotate } from '../validator/validator'
import { MissingSemicolonError, TrailingCommaError } from './errors'
import { AcornOptions, BabelOptions } from './types'

/**
 * Generates options object for acorn parser
 *
 * @param ecmaVersion ECMA version
 * @param errors error container
 * @param throwOnError throw on error if true else push to error container and resume exec
 * @param options partial acorn options
 * @returns
 */
export const createAcornParserOptions = (
  ecmaVersion: ecmaVersion,
  errors?: SourceError[],
  options?: Partial<AcornOptions>,
  throwOnError?: boolean
): AcornOptions => ({
  ecmaVersion,
  sourceType: 'module',
  locations: true,
  onInsertedSemicolon(_tokenEndPos: number, tokenPos: Position) {
    const error = new MissingSemicolonError(positionToSourceLocation(tokenPos, options?.sourceFile))
    if (throwOnError) throw error
    errors?.push(error)
  },
  onTrailingComma(_tokenEndPos: number, tokenPos: Position) {
    const error = new TrailingCommaError(positionToSourceLocation(tokenPos, options?.sourceFile))
    if (throwOnError) throw error
    errors?.push(error)
  },
  ...options
})

/**
 * Parses a single expression at a specified offset
 *
 * @param programStr program string
 * @param offset position offset
 * @param ecmaVersion ECMA version
 * @returns acorn AST Node if parse succeeds else null
 */
export function parseAt(
  programStr: string,
  offset: number,
  ecmaVersion: ecmaVersion = DEFAULT_ECMA_VERSION
): Node | null {
  try {
    return acornParseAt(programStr, offset, { ecmaVersion })
  } catch (_error) {
    return null
  }
}

/**
 * Parse a program, returning alongside comments found within that program
 *
 * @param programStr program string
 * @param ecmaVersion ECMA version
 * @returns tuple consisting of the parsed program, and a list of comments found within the program string
 */
export function parseWithComments(
  programStr: string,
  ecmaVersion: ecmaVersion = DEFAULT_ECMA_VERSION
): [Program, Comment[]] {
  let comments: Comment[] = []
  const acornOptions: AcornOptions = createAcornParserOptions(
    ecmaVersion,
    undefined,
    {
      onComment: comments
    },
    undefined
  )

  let ast: Program | undefined
  try {
    ast = acornParse(programStr, acornOptions) as unknown as Program
  } catch {
    comments = []
    ast = acornLooseParse(programStr, acornOptions)
  }

  return [ast, comments]
}

/**
 * Parse program with error-tolerant acorn parser
 *
 * @param programStr program string
 * @param context js-slang context
 * @returns ast for program string
 */
export function looseParse(programStr: string, context: Context): Program {
  return acornLooseParse(
    programStr,
    createAcornParserOptions(DEFAULT_ECMA_VERSION, context.errors)
  ) as unknown as Program
}

/**
 * TODO
 *
 * @param programStr program string
 * @param context js-slang context
 * @returns ast for program string
 */
export function typedParse(programStr: string, context: Context): Program {
  const ast: Program = looseParse(programStr, context)
  return validateAndAnnotate(ast, context)
}

/**
 * Converts acorn parser Position object to SourceLocation object
 *
 * @param position acorn Position object
 * @returns SourceLocation
 */
export const positionToSourceLocation = (position: Position, source?: string): SourceLocation => ({
  start: { ...position },
  end: { ...position, column: position.column + 1 },
  source
})

export const defaultBabelOptions: BabelOptions = {
  sourceType: 'module',
  plugins: ['typescript', 'estree']
}
