import es from 'estree'

import { parse } from '../parser/parser'
import { removeExports } from '../transpiler/transpiler'
import { Context } from '../types'

const preprocessFileImports = (
  files: Partial<Record<string, string>>,
  entrypointFilename: string,
  context: Context
): es.Program | undefined => {
  const entrypointCode = files[entrypointFilename]
  if (entrypointCode === undefined) {
    return undefined
  }

  const program = parse(entrypointCode, context)
  if (program === undefined) {
    return undefined
  }

  // After this pre-processing step, all export-related nodes in the AST
  // are no longer needed and are thus removed.
  removeExports(program)

  return program
}

export default preprocessFileImports
