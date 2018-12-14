import * as es from 'estree'

import { Rule } from '../types'

import bracesAroundFor from './bracesAroundFor'
import bracesAroundIfElse from './bracesAroundIfElse'
import bracesAroundWhile from './bracesAroundWhile'
import forStatementMustHaveAllParts from './forStatementMustHaveAllParts'
import noAssignmentExpression from './noAssignmentExpression'
import noAssignReserved from './noAssignReserved'
import noDeclareMutable from './noDeclareMutable'
import noDeclareReserved from './noDeclareReserved'
import noDotAbbreviation from './noDotAbbreviation'
import noIfWithoutElse from './noIfWithoutElse'
import noImplicitDeclareUndefined from './noImplicitDeclareUndefined'
import noImplicitReturnUndefined from './noImplicitReturnUndefined'
import noNull from './noNull'
import noUnspecifiedLiteral from './noUnspecifiedLiteral'
import noUnspecifiedOperator from './noUnspecifiedOperator'
import noUpdateAssignment from './noUpdateAssignment'
import singleVariableDeclaration from './singleVariableDeclaration'

const rules: Array<Rule<es.Node>> = [
  bracesAroundIfElse,
  bracesAroundWhile,
  bracesAroundFor,
  singleVariableDeclaration,
  noIfWithoutElse,
  noImplicitDeclareUndefined,
  noImplicitReturnUndefined,
  noDeclareReserved,
  noAssignReserved,
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
