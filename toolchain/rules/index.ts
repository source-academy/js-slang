import * as es from 'estree'

import { Rule } from '../types'

import bracesAroundIfElse from './bracesAroundIfElse'
import bracesAroundWhile from './bracesAroundWhile'
import noIfWithoutElse from './noIfWithoutElse'
import singleVariableDeclaration from './singleVariableDeclaration'
import strictEquality from './strictEquality'
import noImplicitDeclareUndefined from './noImplicitDeclareUndefined'
import noImplicitReturnUndefined from './noImplicitReturnUndefined'
import noNonEmptyList from './noNonEmptyList'

const rules: Array<Rule<es.Node>> = [
  bracesAroundIfElse,
  bracesAroundWhile,
  singleVariableDeclaration,
  strictEquality,
  noIfWithoutElse,
  noImplicitDeclareUndefined,
  noImplicitReturnUndefined,
  noNonEmptyList
]

export default rules
