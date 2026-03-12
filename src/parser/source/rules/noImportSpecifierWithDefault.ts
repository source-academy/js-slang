import type { ImportSpecifier } from 'estree'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'
import syntaxBlacklist from '../syntax'

export class NoImportSpecifierWithDefaultError extends RuleError<ImportSpecifier> {
  public override explain() {
    return 'Import default specifiers are not allowed.'
  }

  public override elaborate() {
    return 'You are trying to use an import default specifier, which is not allowed (yet).'
  }
}

const noImportSpecifierWithDefault: Rule<ImportSpecifier> = {
  name: 'no-declare-mutable',
  disableFromChapter: syntaxBlacklist['ImportDefaultSpecifier'],

  checkers: {
    ImportSpecifier(node) {
      if (node.imported.name === defaultExportLookupName) {
        return [new NoImportSpecifierWithDefaultError(node)]
      }
      return []
    }
  }
}

export default noImportSpecifierWithDefault
