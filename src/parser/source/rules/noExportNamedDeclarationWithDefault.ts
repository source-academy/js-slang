import type { ExportNamedDeclaration } from 'estree';
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude';
import { mapAndFilter } from '../../../utils/misc';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';
import syntaxBlacklist from '../syntax';

export class NoExportNamedDeclarationWithDefaultError extends RuleError<ExportNamedDeclaration> {
  public override explain() {
    return 'Export default declarations are not allowed.';
  }

  public override elaborate() {
    return 'You are trying to use an export default declaration, which is not allowed (yet).';
  }
}

export default defineRule(
  'no-named-export-with-default',
  {
    ExportNamedDeclaration(node) {
      return mapAndFilter(node.specifiers, specifier =>
        specifier.exported.name === defaultExportLookupName
          ? new NoExportNamedDeclarationWithDefaultError(node)
          : undefined,
      );
    },
  },
  syntaxBlacklist['ExportDefaultDeclaration'],
);
