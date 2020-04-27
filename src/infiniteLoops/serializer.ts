import * as stype from './symTypes'

/* simplify conjunctions for easy analysis, e.g.
 * (x<5 && x<10) --> (x<10)
 */
function collapseConjunction(node: stype.BooleanSymbol): stype.BooleanSymbol {
  if (node.type === 'LogicalSymbol' && node.conjunction) {
    const left = node.left
    const right = node.right
    if (
      left.type === 'InequalitySymbol' &&
      right.type === 'InequalitySymbol' &&
      left.direction === right.direction &&
      left.name === right.name
    ) {
      const direction = left.direction
      const name = left.name
      if (left.direction < 0) {
        return stype.makeInequalitySymbol(name, Math.min(left.constant, right.constant), direction)
      } else if (left.direction > 0) {
        return stype.makeInequalitySymbol(name, Math.max(left.constant, right.constant), direction)
      }
    } else {
      return { ...node, left: collapseConjunction(left), right: collapseConjunction(right) }
    }
  }
  return node
}

/* simplify expression to DNF, i.e. sum of products.
 * store each product as an element in a list
 */

function seperateDisjunctions(node: stype.BooleanSymbol): stype.BooleanSymbol[] {
  if (node.type === 'LogicalSymbol') {
    const splitLeft = seperateDisjunctions(node.left)
    const splitRight = seperateDisjunctions(node.right)
    if (node.conjunction) {
      const res = []
      for (const left of splitLeft) {
        for (const right of splitRight) {
          res.push(stype.makeLogicalSymbol(left, right, true))
        }
      }
      return res
    } else {
      return splitLeft.concat(splitRight)
    }
  }
  return [node]
}
export function processLogical(node: stype.BooleanSymbol) {
  return seperateDisjunctions(node).map(collapseConjunction)
}

/* for nested functions, we want to make another transition, i.e.
 * f(x) {g(h(x));} -> f calls g, f calls h.
 * TODO: need to reconsider nested calls. Uncommenting the lines
 *       below will include nested calls, but will cause trouble
 *       with NoBaseCase detection. Possibly add a flag in the
 *       T-set for nested calls? Can be put on hold for now
 *       since we don't handle nested calls at all.
 */
function flattenFun(node: stype.FunctionSymbol): stype.FunctionSymbol[] {
  const newArgs = []
  // let nestedCalls: stype.FunctionSymbol[] = []
  for (const arg of node.args) {
    if (arg.type === 'FunctionSymbol') {
      newArgs.push(stype.skipSymbol)
      // nestedCalls = nestedCalls.concat(flattenFun(arg))
    } else {
      newArgs.push(arg)
    }
  }
  // nestedCalls.unshift({ ...node, args: newArgs })
  return [{ ...node, args: newArgs }]
}

/* creates a transition for each functionSymbol in the symbol tree
 * refer to the documentation for more info
 */
function unTree(node: stype.SSymbol): stype.SSymbol[][] {
  if (stype.isTerminal(node)) {
    return [[stype.terminateSymbol]]
  } else if (node.type === 'SequenceSymbol') {
    let result: stype.SSymbol[][] = []
    const temp = node.symbols.map(unTree)
    for (const subList of temp) {
      result = result.concat(subList)
    }
    if (result.length === 0) {
      return [[stype.terminateSymbol]]
    }
    return result
  } else if (node.type === 'BranchSymbol') {
    const consTail = unTree(node.consequent)
    const altTail = unTree(node.alternate)
    let result: stype.SSymbol[][] = []
    if (stype.isBooleanSymbol(node.test)) {
      for (const sym of processLogical(node.test)) {
        result = result.concat(consTail.map(x => [sym as stype.SSymbol].concat(x)))
      }
      for (const sym of processLogical(stype.negateBooleanSymbol(node.test))) {
        result = result.concat(altTail.map(x => [sym as stype.SSymbol].concat(x)))
      }
    } else {
      result = result.concat(consTail.map(x => [stype.skipSymbol as stype.SSymbol].concat(x)))
      result = result.concat(altTail.map(x => [stype.skipSymbol as stype.SSymbol].concat(x)))
    }
    return result
  } else if (node.type === 'FunctionSymbol') {
    return [flattenFun(node)]
  }
  return []
}

export function serialize(
  firstCall: stype.FunctionSymbol,
  node: stype.SSymbol
): stype.Transition[] {
  const result: stype.Transition[] = []
  const symLists = unTree(node)

  for (const sList of symLists) {
    let cond = null
    for (const sym of sList) {
      if (stype.isBooleanSymbol(sym)) {
        if (cond === null) {
          cond = sym
        } else if (stype.isBooleanSymbol(cond)) {
          cond = stype.makeLogicalSymbol(cond, sym, true)
        } // if cond = skip, don't change cond
      } else if (sym.type === 'FunctionSymbol' || sym.type === 'TerminateSymbol') {
        result.push(stype.makeTransition(firstCall, sym, cond))
      } else if (sym.type === 'SkipSymbol') {
        cond = stype.skipSymbol
      }
    }
  }
  return result
}
