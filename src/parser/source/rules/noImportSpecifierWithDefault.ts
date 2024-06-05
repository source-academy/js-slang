import type { ImportSpecifier } from 'estree'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import { RuleError, type Rule } from '../../types'
import syntaxBlacklist from '../syntax'

export class NoImportSpecifierWithDefaultError extends RuleError<ImportSpecifier> {
  public explain() {
    return 'Import default specifiers are not allowed.'
  }

  public elaborate() {
    return 'You are trying to use an import default specifier, which is not allowed (yet).'
  }
}

const noImportSpecifierWithDefault: Rule<ImportSpecifier> = {
  name: 'no-import-default-specifier',
  disableFromChapter: syntaxBlacklist['ImportDefaultSpecifier'],
  testSnippets: [
    ['import { default as a } from "./a.js";', 'Line 1: Import default specifiers are not allowed.']
  ],

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
