import * as es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'
import syntaxBlacklist from '../syntax'

export class NoExportNamedDeclarationWithDefaultError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: es.ExportNamedDeclaration) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'Export default declarations are not allowed'
  }

  public elaborate() {
    return 'You are trying to use an export default declaration, which is not allowed (yet).'
  }
}

const noExportNamedDeclarationWithDefault: Rule<es.ExportNamedDeclaration> = {
  name: 'no-declare-mutable',
  disableFromChapter: syntaxBlacklist['ExportDefaultDeclaration'],

  checkers: {
    ExportNamedDeclaration(node: es.ExportNamedDeclaration, _ancestors: [es.Node]) {
      const errors: NoExportNamedDeclarationWithDefaultError[] = []
      node.specifiers.forEach((specifier: es.ExportSpecifier) => {
        if (specifier.exported.name === defaultExportLookupName) {
          errors.push(new NoExportNamedDeclarationWithDefaultError(node))
        }
      })
      return errors
    }
  }
}

export default noExportNamedDeclarationWithDefault
