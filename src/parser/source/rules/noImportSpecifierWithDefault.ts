import type { ImportSpecifier } from 'estree';
import { defaultExportLookupName } from '../../../stdlib/localImport.prelude';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';
import syntaxBlacklist from '../syntax';

export class NoImportSpecifierWithDefaultError extends RuleError<ImportSpecifier> {
  public override explain() {
    return 'Import default specifiers are not allowed.';
  }

  public override elaborate() {
    return 'You are trying to use an import default specifier, which is not allowed (yet).';
  }
}

export default defineRule(
  'no-import-with-default',
  {
    ImportSpecifier(node) {
      if (node.imported.name === defaultExportLookupName) {
        return [new NoImportSpecifierWithDefaultError(node)];
      }
      return [];
    },
  },
  syntaxBlacklist['ImportDefaultSpecifier'],
);
