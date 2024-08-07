import type { Rule } from '../../types'
import bracesAroundFor from './bracesAroundFor'
import bracesAroundIfElse from './bracesAroundIfElse'
import bracesAroundWhile from './bracesAroundWhile'
import forStatementMustHaveAllParts from './forStatementMustHaveAllParts'
import noDeclareMutable from './noDeclareMutable'
import noDotAbbreviation from './noDotAbbreviation'
import noEval from './noEval'
import noExportNamedDeclarationWithDefault from './noExportNamedDeclarationWithDefault'
import noExportNamedDeclarationWithSource from './noExportNamedDeclarationWithSource'
import noFunctionDeclarationWithoutIdentifier from './noFunctionDeclarationWithoutIdentifier'
import noHolesInArrays from './noHolesInArrays'
import noIfWithoutElse from './noIfWithoutElse'
import noImplicitReturnUndefined from './noImplicitReturnUndefined'
import noImportSpecifierWithDefault from './noImportSpecifierWithDefault'
import noNull from './noNull'
import noSpreadInArray from './noSpreadInArray'
import noTemplateExpression from './noTemplateExpression'
import noTypeofOperator from './noTypeofOperator'
import noUnspecifiedLiteral from './noUnspecifiedLiteral'
import noUnspecifiedOperator from './noUnspecifiedOperator'
import noVar from './noVar'
import singleVariableDeclaration from './singleVariableDeclaration'

const rules: Rule<any>[] = [
  bracesAroundFor,
  bracesAroundIfElse,
  bracesAroundWhile,
  forStatementMustHaveAllParts,
  noDeclareMutable,
  noDotAbbreviation,
  noExportNamedDeclarationWithDefault,
  noExportNamedDeclarationWithSource,
  noFunctionDeclarationWithoutIdentifier,
  noIfWithoutElse,
  noImportSpecifierWithDefault,
  noImplicitReturnUndefined,
  noNull,
  noUnspecifiedLiteral,
  noUnspecifiedOperator,
  noTypeofOperator,
  noVar,
  singleVariableDeclaration,
  noEval,
  noHolesInArrays,
  noTemplateExpression,
  noSpreadInArray
]

export default rules
