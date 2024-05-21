import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import { ErrorSeverity, ErrorType, Node, SourceError } from '../../../types'
import { Rule } from '../../types'
import syntaxBlacklist from '../syntax'

export class NoImportSpecifierWithDefaultError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.ImportSpecifier) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Import default specifiers are not allowed.'
  }

  public elaborate() {
    return 'You are trying to use an import default specifier, which is not allowed (yet).'
  }
}

const noImportSpecifierWithDefault: Rule<es.ImportSpecifier> = {
  name: 'no-import-default-specifier',
  disableFromChapter: syntaxBlacklist['ImportDefaultSpecifier'],
  testSnippets: [
    [
      'import { default as a } from "./a.js";',
      'Line 1: Import default specifiers are not allowed.'
    ],
  ],

  checkers: {
    ImportSpecifier(node: es.ImportSpecifier, _ancestors: [Node]) {
      if (node.imported.name === defaultExportLookupName) {
        return [new NoImportSpecifierWithDefaultError(node)]
      }
      return []
    }
  }
}

export default noImportSpecifierWithDefault
