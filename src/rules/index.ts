import * as es from 'estree'

import { Rule } from '../types'

import bracesAroundFor from './bracesAroundFor'
import bracesAroundIfElse from './bracesAroundIfElse'
import bracesAroundWhile from './bracesAroundWhile'
import forStatementMustHaveAllParts from './forStatementMustHaveAllParts'
import noAssignmentExpression from './noAssignmentExpression'
import noDeclareMutable from './noDeclareMutable'
import noDotAbbreviation from './noDotAbbreviation'
import noEval from './noEval'
import noIfWithoutElse from './noIfWithoutElse'
import noImplicitDeclareUndefined from './noImplicitDeclareUndefined'
import noImplicitReturnUndefined from './noImplicitReturnUndefined'
import noNull from './noNull'
import noUnspecifiedLiteral from './noUnspecifiedLiteral'
import noUnspecifiedOperator from './noUnspecifiedOperator'
import noUpdateAssignment from './noUpdateAssignment'
import singleVariableDeclaration from './singleVariableDeclaration'

const rules: Array<Rule<es.Node>> = [
  bracesAroundFor,
  bracesAroundIfElse,
  bracesAroundWhile,
  forStatementMustHaveAllParts,
  noAssignmentExpression,
  noDeclareMutable,
  noDotAbbreviation,
  noIfWithoutElse,
  noImplicitDeclareUndefined,
  noImplicitReturnUndefined,
  noNull,
  noUnspecifiedLiteral,
  noUnspecifiedOperator,
  noUpdateAssignment,
  singleVariableDeclaration,
  noEval
]

export default rules
