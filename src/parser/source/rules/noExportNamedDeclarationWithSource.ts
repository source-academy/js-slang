import type { ExportNamedDeclaration } from "estree";
import { UNKNOWN_LOCATION } from "../../../constants";
import { ErrorSeverity, ErrorType, type SourceError } from "../../../types";
import { type Rule } from '../../types';

export class NoExportNamedDeclarationWithSourceError implements SourceError {
  public type = ErrorType.SYNTAX
  public severity = ErrorSeverity.ERROR

  constructor(public node: ExportNamedDeclaration) {}

  get location() {
    return this.node.loc ?? UNKNOWN_LOCATION
  }

  public explain() {
    return 'exports of the form export { a } from "./file.js"; are not allowed.'
  }

  public elaborate() {
    return 'Import what you are trying to export, then export it again.'
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