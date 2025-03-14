import type { ExportNamedDeclaration } from 'estree'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import type { Rule } from '../../types'
import syntaxBlacklist from '../syntax'
import { RuleError } from '../../errors'

export class NoExportNamedDeclarationWithDefaultError extends RuleError<ExportNamedDeclaration> {
  public explain() {
    return 'Export default declarations are not allowed'
  }

  public elaborate() {
    return 'You are trying to use an export default declaration, which is not allowed (yet).'
  }
}

const noExportNamedDeclarationWithDefault: Rule<ExportNamedDeclaration> = {
  name: 'no-declare-mutable',
  disableFromChapter: syntaxBlacklist['ExportDefaultDeclaration'],

  checkers: {
    ExportNamedDeclaration(node) {
      const errors: NoExportNamedDeclarationWithDefaultError[] = []
      node.specifiers.forEach(specifier => {
        if (specifier.exported.name === defaultExportLookupName) {
          errors.push(new NoExportNamedDeclarationWithDefaultError(node))
        }
      })
      return errors
    }
  }
}

export default noExportNamedDeclarationWithDefault
