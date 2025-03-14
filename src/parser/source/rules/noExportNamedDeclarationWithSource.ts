import type { ExportNamedDeclaration } from 'estree'
import type { Rule } from '../../types'
import { RuleError } from '../../errors'

export class NoExportNamedDeclarationWithSourceError extends RuleError<ExportNamedDeclaration> {
  public explain() {
    return 'exports of the form export { a } from "./file.js"; are not allowed.'
  }

  public elaborate() {
    return 'Import what you are trying to export, then export it again.'
  }
}

const noExportNamedDeclarationWithSource: Rule<ExportNamedDeclaration> = {
  name: 'no-export-named-declaration-with-source',
  checkers: {
    ExportNamedDeclaration(node) {
      if (node.source !== null) {
        return [new NoExportNamedDeclarationWithSourceError(node)]
      }
      return []
    }
  }
}

export default noExportNamedDeclarationWithSource
