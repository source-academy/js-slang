import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'
import syntaxBlacklist from '../syntax'

export class NoImportSpecifierWithDefaultError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.ImportSpecifier) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Import default specifiers are not allowed'
  }

  public elaborate() {
    return 'You are trying to use an import default specifier, which is not allowed (yet).'
  }
}

const noImportSpecifierWithDefault: Rule<es.ImportSpecifier> = {
  name: 'no-declare-mutable',
  disableFromChapter: syntaxBlacklist['ImportDefaultSpecifier'],

  checkers: {
    ImportSpecifier(node: es.ImportSpecifier, _ancestors: [es.Node]) {
      if (node.imported.name === defaultExportLookupName) {
        return [new NoImportSpecifierWithDefaultError(node)]
      }
      return []
    }
  }
}

export default noImportSpecifierWithDefault
