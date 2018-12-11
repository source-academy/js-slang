import * as es from 'estree'

import { Rule } from '../types'

import bracesAroundIfElse from './bracesAroundIfElse'
import bracesAroundWhile from './bracesAroundWhile'
import bracesAroundFor from './bracesAroundFor'
import noDeclareMutable from './noDeclareMutable'
import noDeclareReserved from './noDeclareReserved'
import noIfWithoutElse from './noIfWithoutElse'
import noImplicitDeclareUndefined from './noImplicitDeclareUndefined'
import noImplicitReturnUndefined from './noImplicitReturnUndefined'
import noUnspecifiedLiteral from './noUnspecifiedLiteral'
import noNull from './noNull'
import noUnspecifiedOperator from './noUnspecifiedOperator'
import singleVariableDeclaration from './singleVariableDeclaration'
import forStatementMustHaveAllParts from './forStatementMustHaveAllParts'
import noAssignmentExpression from './noAssignmentExpression'
import noUpdateAssignment from './noUpdateAssignment'
import noDotAbbreviation from './noDotAbbreviation'

const rules: Array<Rule<es.Node>> = [
  bracesAroundIfElse,
  bracesAroundWhile,
  bracesAroundFor,
  singleVariableDeclaration,
  noIfWithoutElse,
  noImplicitDeclareUndefined,
  noImplicitReturnUndefined,
  noDeclareReserved,
  noDeclareMutable,
  noUnspecifiedLiteral,
  noNull,
  forStatementMustHaveAllParts,
  noAssignmentExpression,
  noUpdateAssignment,
  noDotAbbreviation,
  noUnspecifiedOperator
]

export default rules
