import { parse as babelParse } from '@babel/parser'
import { Options as AcornOptions } from 'acorn'
import { Program } from 'estree'

import { Context } from '../../..'
import { DEFAULT_ECMA_VERSION } from '../../../constants'
import * as TypedES from '../../../typeChecker/tsESTree'
import { checkForTypeErrors } from '../../../typeChecker/typeErrorChecker'
import { FatalSyntaxError } from '../../errors'
import {
  createAcornParserOptions,
  defaultBabelOptions,
  positionToSourceLocation
} from '../../utils'
import { SourceParser } from '..'
import TypeParser from './typeParser'
import { transformBabelASTToESTreeCompliantAST } from './utils'

export class SourceTypedParser extends SourceParser {
  parse(
    programStr: string,
    context: Context,
    options?: Partial<AcornOptions>,
    throwOnError?: boolean
  ): Program | null {
    // Parse with acorn type parser first to catch errors such as
    // import/export not at top level, trailing commas, missing semicolons
    try {
      TypeParser.parse(
        programStr,
        createAcornParserOptions(DEFAULT_ECMA_VERSION, context.errors, options, throwOnError)
      )
    } catch (error) {
      if (error instanceof SyntaxError) {
        error = new FatalSyntaxError(
          positionToSourceLocation((error as any).loc, options?.sourceFile),
          error.toString()
        )
      }

      if (throwOnError) throw error
      context.errors.push(error)

      return null
    }

    // Parse again with babel parser to capture all type syntax
    // and catch remaining syntax errors not caught by acorn type parser
    const ast = babelParse(programStr, {
      ...defaultBabelOptions,
      sourceFilename: options?.sourceFile,
      errorRecovery: !throwOnError
    })

    if (ast.errors.length) {
      ast.errors
        .filter(error => error instanceof SyntaxError)
        .forEach(error => {
          context.errors.push(
            new FatalSyntaxError(
              positionToSourceLocation((error as any).loc, options?.sourceFile),
              error.toString()
            )
          )
        })

      return null
    }

    // TODO typed parser should be throwing on error
    const typedProgram: TypedES.Program = ast.program as TypedES.Program
    const typedCheckedProgram: Program = checkForTypeErrors(typedProgram, context)

    if (context.errors.length > 0 && throwOnError) {
      throw context.errors[0]
    }

    transformBabelASTToESTreeCompliantAST(typedCheckedProgram)

    return typedCheckedProgram
  }

  toString(): string {
    return 'SourceTypedParser'
  }
}
