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
import noUnspecifiedOperator from './noUnspecifiedOperator'
import singleVariableDeclaration from './singleVariableDeclaration'
import forStatementMustHaveAllParts from './forStatementMustHaveAllParts'
import noAssignmentExpression from './noAssignmentExpression'
import noUpdateAssignment from './noUpdateAssignment'

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
  forStatementMustHaveAllParts,
  noAssignmentExpression,
  noUpdateAssignment,
  noUnspecifiedOperator
]

export default rules
