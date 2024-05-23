import type es from 'estree'

import { UNKNOWN_LOCATION } from '../../../constants'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import { ErrorSeverity, ErrorType, type SourceError } from '../../../types'
import type { Rule } from '../../types'
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
  testSnippets: [
    [
      `
        const a = 0;
        export { a as default };
      `,
      'Line 3: Export default declarations are not allowed'
    ]
  ],

  checkers: {
    ExportNamedDeclaration(node: es.ExportNamedDeclaration) {
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
