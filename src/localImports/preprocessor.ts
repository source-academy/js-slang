import es from 'estree'

import { parse } from '../parser/parser'
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
  return program
}

export default preprocessFileImports
