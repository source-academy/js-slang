import type { ExportNamedDeclaration } from 'estree'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import type { Rule } from '../../types'
import syntaxBlacklist from '../syntax'
import { RuleError } from '../../errors'
import { mapAndFilter } from '../../../utils/misc'

export class NoExportNamedDeclarationWithDefaultError extends RuleError<ExportNamedDeclaration> {
  public explain() {
    return 'Export default declarations are not allowed.'
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
      return mapAndFilter(node.specifiers, specifier =>
        specifier.exported.name === defaultExportLookupName
          ? new NoExportNamedDeclarationWithDefaultError(node)
          : undefined
      )
    }
  }
}

export default noExportNamedDeclarationWithDefault
