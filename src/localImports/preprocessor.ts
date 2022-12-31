import es from 'estree'

import { parse } from '../parser/parser'
import { Context } from '../types'
import { removeExports, removeNonSourceModuleImports } from './transformers'

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
  // Likewise, all import-related nodes in the AST which are not Source
  // module imports are no longer needed and are also removed.
  removeNonSourceModuleImports(program)

  return program
}

export default preprocessFileImports
