import * as es from 'estree'

import { Rule } from '../types'

import bracesAroundIfElse from './bracesAroundIfElse'
import bracesAroundWhile from './bracesAroundWhile'
import noBlockArrowFunction from './noBlockArrowFunction'
import noDeclareMutable from './noDeclareMutable'
import noDeclareReserved from './noDeclareReserved'
import noIfWithoutElse from './noIfWithoutElse'
import noImplicitDeclareUndefined from './noImplicitDeclareUndefined'
import noImplicitReturnUndefined from './noImplicitReturnUndefined'
import noNonEmptyList from './noNonEmptyList'
import noUnspecifiedLiteral from './noUnspecifiedLiteral'
import noUnspecifiedOperator from './noUnspecifiedOperator'
import singleVariableDeclaration from './singleVariableDeclaration'
import noAssignmentExpression from './noAssignmentExpression'
import noUpdateAssignment from './noUpdateAssignment'

const rules: Array<Rule<es.Node>> = [
  bracesAroundIfElse,
  bracesAroundWhile,
  singleVariableDeclaration,
  noIfWithoutElse,
  noImplicitDeclareUndefined,
  noImplicitReturnUndefined,
  noNonEmptyList,
  noBlockArrowFunction,
  noDeclareReserved,
  noDeclareMutable,
  noUnspecifiedLiteral,
  noAssignmentExpression,
  noUpdateAssignment,
  noUnspecifiedOperator
]

export default rules
