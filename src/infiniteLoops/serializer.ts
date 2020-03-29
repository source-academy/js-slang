import * as stype from './symTypes'

import { isTerminal } from './symbolicExecutor'
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
function seperateDisjunctions(node: stype.BooleanSymbol): stype.BooleanSymbol[] {
  // TODO also check the math
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
function processLogical(node: stype.BooleanSymbol) {
  return seperateDisjunctions(node).map(collapseConjunction)
}
export function serialize(node: stype.SSymbol): stype.SSymbol[][] {
  if (isTerminal(node)) {
    return [[stype.terminateSymbol]]
  } else if (node.type === 'SequenceSymbol') {
    let result: stype.SSymbol[][] = []
    const temp = node.symbols.map(serialize)
    for (const subList of temp) {
      result = result.concat(subList)
    }
    return result
  } else if (node.type === 'BranchSymbol') {
    const consTail = serialize(node.consequent)
    const altTail = serialize(node.alternate)
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
    return [[node]]
  }
  return []
}
