import { parse as babelParse } from '@babel/parser'
import { createProjectSync, ts } from '@ts-morph/bootstrap'
import { parse } from 'acorn'
import type * as es from 'estree'

import type { Context } from '../..'
import * as TypedES from '../../typeChecker/tsESTree'
import { removeTSNodes } from '../../typeChecker/typeErrorChecker'
import { extractIdsFromPattern } from '../../utils/ast/astUtils'
import { recursive } from '../../utils/ast/walkers'
import { FatalSyntaxError } from '../errors'
import { transformBabelASTToESTreeCompliantAST } from '../source/typed/utils'
import { AcornOptions, Parser } from '../types'
import { defaultBabelOptions, positionToSourceLocation } from '../utils'

const IMPORT_TOP_LEVEL_ERROR =
  'An import declaration can only be used at the top level of a namespace or module.'
const START_OF_MODULE_ERROR = 'Cannot find module '

export class FullTSParser implements Parser<AcornOptions> {
  parse(
    programStr: string,
    context: Context,
    options?: Partial<AcornOptions>,
    throwOnError?: boolean
  ): es.Program | null {
    // Create a fake declaration file
    const builtins: string[] = [...context.nativeStorage.builtins.keys()]
    if (context.prelude) {
      const prelude = parse(context.prelude, {
        ecmaVersion: 6,
        sourceType: 'module'
      }) as unknown as es.Program

      recursive(prelude, null, {
        VariableDeclaration({ declarations }: es.VariableDeclaration) {
          for (const { id } of declarations) {
            extractIdsFromPattern(id).forEach(({ name }) => builtins.push(name))
          }
        },
        FunctionDeclaration({ id }: es.FunctionDeclaration) {
          if (id && !id.name.startsWith('$')) {
            builtins.push(id.name)
          }
        }
        // Preludes shouldn't contain export declarations
        // ExportNamedDeclaration({ declaration }: es.ExportNamedDeclaration, _state, c) {
        //   if (declaration) c(declaration, null)
        // },
        // ExportDefaultDeclaration({ declaration }: es.ExportDefaultDeclaration, _state, c) {
        //   if (declaration) c(declaration, null)
        // }
      })
    }

    // Add builtins to code
    // Each declaration is replaced with a single constant declaration with type `any`
    // to reduce evaluation time
    const declarationFile = `export {}; declare global {${builtins
      .map(name => `const ${name}: any`)
      .join('\n')}}`
    const project = createProjectSync({
      useInMemoryFileSystem: true,
      compilerOptions: {
        skipLibCheck: true
      }
    })
    project.createSourceFile('index.d.ts', declarationFile)
    project.createSourceFile('program.ts', programStr)

    // Get TS diagnostics from file, formatted as TS error string
    const diagnostics = ts.getPreEmitDiagnostics(project.createProgram())
    const formattedString = project.formatDiagnosticsWithColorAndContext(diagnostics)

    // Reformat TS error string to Source error by getting line number using regex
    // This is because logic to retrieve line number is only present in
    // formatDiagnosticsWithColorAndContext and cannot be called directly
    const lineNumRegex = /(?<=\[7m)\d+/
    diagnostics.forEach(diagnostic => {
      const message = diagnostic.messageText.toString()
      // Ignore errors regarding imports
      // as TS does not have information about Source modules
      if (message === IMPORT_TOP_LEVEL_ERROR || message.startsWith(START_OF_MODULE_ERROR)) {
        return
      }
      const lineNumRegExpArr = lineNumRegex.exec(formattedString.split(message)[1])
      const lineNum = lineNumRegExpArr === null ? 0 : parseInt(lineNumRegExpArr[0])
      const position = { line: lineNum, column: 0, offset: 0 }
      context.errors.push(new FatalSyntaxError(positionToSourceLocation(position), message))
    })

    if (context.errors.length > 0) {
      return null
    }

    // Parse code into Babel AST, which supports type syntax
    const ast = babelParse(programStr, {
      ...defaultBabelOptions,
      sourceFilename: options?.sourceFile,
      errorRecovery: throwOnError ?? true
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

    // Transform Babel AST into ESTree AST
    const typedProgram: TypedES.Program = ast.program as TypedES.Program
    const transpiledProgram: es.Program = removeTSNodes(typedProgram)
    transformBabelASTToESTreeCompliantAST(transpiledProgram)

    return transpiledProgram
  }

  validate(_ast: es.Program, _context: Context, _throwOnError: boolean): boolean {
    return true
  }

  toString(): string {
    return 'FullTSParser'
  }
}
