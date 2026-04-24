import type { ExportNamedDeclaration } from 'estree';
import { specifierToString } from '../../../utils/ast/helpers';
import { RuleError } from '../../errors';
import { defineRule } from '../../types';

export class NoExportNamedDeclarationWithSourceError extends RuleError<ExportNamedDeclaration> {
  public override explain() {
    return 'exports of the form `export { a } from "./file.js";` are not allowed.';
  }

  public override elaborate() {
    const [imports, exps] = this.node.specifiers.reduce(
      ([ins, outs], spec) => [
        [...ins, spec.local.name],
        [...outs, specifierToString(spec)],
      ],
      [[], []] as [string[], string[]],
    );
    const importStr = `import { ${imports.join(', ')} } from "${this.node.source!.value}";`;
    const exportStr = `export { ${exps.join(', ')} };`;

    return `Import what you are trying to export, then export it again, like this:\n${importStr}\n${exportStr}`;
  }
}

export default defineRule('no-export-named-declaration-with-source', {
  ExportNamedDeclaration(node) {
    if (node.source !== null) {
      return [new NoExportNamedDeclarationWithSourceError(node)];
    }
    return [];
  },
});
