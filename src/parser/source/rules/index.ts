import * as es from 'estree'

import { Rule } from '../../../types'
import bracesAroundFor from './bracesAroundFor'
import bracesAroundIfElse from './bracesAroundIfElse'
import bracesAroundWhile from './bracesAroundWhile'
import forStatementMustHaveAllParts from './forStatementMustHaveAllParts'
import noDeclareMutable from './noDeclareMutable'
import noDotAbbreviation from './noDotAbbreviation'
import noEval from './noEval'
import noExportNamedDeclarationWithDefault from './noExportNamedDeclarationWithDefault'
import noFunctionDeclarationWithoutIdentifier from './noFunctionDeclarationWithoutIdentifier'
import noHolesInArrays from './noHolesInArrays'
import noIfWithoutElse from './noIfWithoutElse'
import noImplicitDeclareUndefined from './noImplicitDeclareUndefined'
import noImplicitReturnUndefined from './noImplicitReturnUndefined'
import noImportSpecifierWithDefault from './noImportSpecifierWithDefault'
import noNull from './noNull'
import noSpreadInArray from './noSpreadInArray'
import noTemplateExpression from './noTemplateExpression'
import noTypeofOperator from './noTypeofOperator'
import noUnspecifiedLiteral from './noUnspecifiedLiteral'
import noUnspecifiedOperator from './noUnspecifiedOperator'
import noUpdateAssignment from './noUpdateAssignment'
import noVar from './noVar'
import singleVariableDeclaration from './singleVariableDeclaration'

const rules: Rule<es.Node>[] = [
  bracesAroundFor,
  bracesAroundIfElse,
  bracesAroundWhile,
  forStatementMustHaveAllParts,
  noDeclareMutable,
  noDotAbbreviation,
  noExportNamedDeclarationWithDefault,
  noFunctionDeclarationWithoutIdentifier,
  noIfWithoutElse,
  noImportSpecifierWithDefault,
  noImplicitDeclareUndefined,
  noImplicitReturnUndefined,
  noNull,
  noUnspecifiedLiteral,
  noUnspecifiedOperator,
  noTypeofOperator,
  noUpdateAssignment,
  noVar,
  singleVariableDeclaration,
  noEval,
  noHolesInArrays,
  noTemplateExpression,
  noSpreadInArray
]

export default rules
