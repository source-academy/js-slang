import { UNKNOWN_LOCATION } from '../../../constants'
import { ErrorSeverity, ErrorType, Rule, SourceError } from '../../../types'
import { isExportDeclarationWithSource } from '../../../utils/ast/typeGuards'
import type {
  ExportNamedDeclaration,
  ExportNamedDeclarationWithSource
} from '../../../utils/ast/types'

export class NoReexportDeclaration implements SourceError {
  public type = ErrorType.SYNTAX
  public severity: ErrorSeverity.ERROR

  constructor(public readonly node?: ExportNamedDeclarationWithSource) {}

  get location() {
    return this.node?.loc ?? UNKNOWN_LOCATION
  }

  public explain(): string {
    return "Export statements of the form export { x } from 'module' are not allowed"
  }

  public elaborate(): string {
    return this.explain()
  }
}

const noReexportDeclaration: Rule<ExportNamedDeclarationWithSource> = {
  name: 'no-reexport-declaration',
  checkers: {
    ExportNamedDeclaration(node: ExportNamedDeclaration) {
      if (isExportDeclarationWithSource(node)) {
        return [new NoReexportDeclaration(node)]
      }

      return []
    }
  }
}

export default noReexportDeclaration
