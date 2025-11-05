import type { ExportNamedDeclaration } from 'estree'
import { speciferToString } from '../../../utils/ast/helpers'
import { RuleError } from '../../errors'
import type { Rule } from '../../types'

export class NoExportNamedDeclarationWithSourceError extends RuleError<ExportNamedDeclaration> {
  public explain() {
    return 'exports of the form `export { a } from "./file.js";` are not allowed.'
  }

  public elaborate() {
    const [imports, exps] = this.node.specifiers.reduce(
      ([ins, outs], spec) => [
        [...ins, spec.local.name],
        [...outs, speciferToString(spec)]
      ],
      [[], []] as [string[], string[]]
    )
    const importStr = `import { ${imports.join(', ')} } from "${this.node.source!.value}";`
    const exportStr = `export { ${exps.join(', ')} };`

    return `Import what you are trying to export, then export it again, like this:\n${importStr}\n${exportStr}`
  }
}

const noExportNamedDeclarationWithSource: Rule<ExportNamedDeclaration> = {
  name: 'no-export-named-declaration-with-source',
  checkers: {
    ExportNamedDeclaration(node) {
      if (node.source !== null) {
        return [new NoExportNamedDeclarationWithSourceError(node)]
      }
      return []
    }
  }
}

export default noExportNamedDeclarationWithSource
