import type { ExportNamedDeclaration } from 'estree'
import { Chapter} from '../../../types'
import { type Rule, RuleError } from '../../types'

export class NoExportNamedDeclarationWithSourceError extends RuleError<ExportNamedDeclaration> {
  explain() {
    return 'Export declarations cannot reexport from another module!'
  }
  elaborate() {
    return 'You cannot use exports of the form \'export {} from "module";\''
  }
}

const noExportNamedDeclarationWithSource: Rule<ExportNamedDeclaration> = {
  name: 'no-export-named-declaration-with-source',
  checkers: {
    ExportNamedDeclaration(node) {
      return node.source ? [new NoExportNamedDeclarationWithSourceError(node)] : []
    }
  },
  disableFromChapter: Chapter.LIBRARY_PARSER,
  testSnippets: [
    [
      'export { heart } from "rune";',
      'Line 1: Export declarations cannot reexport from another module!'
    ],
    [
      'export { heart } from "./a.js";',
      'Line 1: Export declarations cannot reexport from another module!'
    ],
    ['const heart = 0;\nexport { heart };', undefined]
  ]
}

export default noExportNamedDeclarationWithSource
