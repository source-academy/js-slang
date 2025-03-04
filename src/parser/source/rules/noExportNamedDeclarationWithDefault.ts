import type { ExportNamedDeclaration } from 'estree'
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude'
import { type Rule, RuleError } from '../../types'
import syntaxBlacklist from '../syntax'

export class NoExportNamedDeclarationWithDefaultError extends RuleError<ExportNamedDeclaration> {
  public explain() {
    return 'Export default declarations are not allowed'
  }

  public elaborate() {
    return 'You are trying to use an export default declaration, which is not allowed (yet).'
  }
}

const noExportNamedDeclarationWithDefault: Rule<ExportNamedDeclaration> = {
  name: 'no-default-export',
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
