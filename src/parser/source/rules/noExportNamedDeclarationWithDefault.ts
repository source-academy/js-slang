import type { ExportNamedDeclaration, ExportSpecifier } from 'estree'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import { RuleError, type Rule } from '../../types'
import syntaxBlacklist from '../syntax'
import { mapAndFilter } from '../../../utils/misc'

export class NoExportNamedDeclarationWithDefaultError extends RuleError<ExportSpecifier> {
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
    ExportNamedDeclaration(node) {
      return mapAndFilter(node.specifiers, spec => {
        if (spec.exported.name === defaultExportLookupName) {
          return new NoExportNamedDeclarationWithDefaultError(spec)
        }

        return undefined
      })
    }
  }
}

export default noExportNamedDeclarationWithDefault
