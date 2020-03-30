import * as es from 'estree'
import * as stype from './symTypes'

function execBinarySymbol(
  node1: stype.SymbolicExecutable,
  node2: stype.SymbolicExecutable,
  op: string,
  flipped: boolean
): stype.SSymbol {
  type opFunction = (value: number, sym: stype.NumberSymbol, flipped: boolean) => stype.SSymbol
  // TODO big todo: check the math of below (esp flipped, >= after flip etc)
  const operators: { [nodeType: string]: opFunction } = {
    '+'(value: number, sym: stype.NumberSymbol, flip: boolean) {
      return { ...sym, constant: sym.constant + value }
    },
    '-'(value: number, sym: stype.NumberSymbol, flip: boolean) {
      if (flip) {
        return { ...sym, constant: value - sym.constant, isPositive: true }
      } else {
        return { ...sym, constant: sym.constant - value }
      }
    },
    '==='(value: number, sym: stype.NumberSymbol, flip: boolean) {
      return stype.makeInequalitySymbol(sym.name, value - sym.constant, 0)
    },
    '<'(value: number, sym: stype.NumberSymbol, flip: boolean) {
      if (sym.isPositive) {
        if (flip) {
          return stype.makeInequalitySymbol(sym.name, value - sym.constant, 1)
        } else {
          return stype.makeInequalitySymbol(sym.name, value - sym.constant, -1)
        }
      } else {
        const negated = stype.negateNumberSymbol(sym)
        return operators['>'](value, negated, flip)
      }
    },
    '>'(value: number, sym: stype.NumberSymbol, flip: boolean) {
      return operators['<'](value, sym, !flip)
    },
    '>='(value: number, sym: stype.NumberSymbol, flip: boolean) {
      return operators['>'](value - 1, sym, flip)
    },
    '<='(value: number, sym: stype.NumberSymbol, flip: boolean) {
      return operators['<'](value + 1, sym, flip)
    },
    '!=='(value: number, sym: stype.NumberSymbol, flip: boolean) {
      // TODO check this (inside branch test?) *change seq to boolean sym
      return stype.negateBooleanSymbol(
        operators['==='](value, sym, false) as stype.InequalitySymbol
      )
    }
  }
  if (node1.type === 'LiteralValueSymbol' && node2.type === 'NumberSymbol') {
    return execBinarySymbol(node2, node1, op, true)
  } else if (node2.type === 'LiteralValueSymbol' && node1.type === 'NumberSymbol') {
    const val = node2.value
    if (typeof val === 'number' && Number.isInteger(val)) {
      const toRun = operators[op]
      if (toRun !== undefined) {
        return toRun(val, node1 as stype.NumberSymbol, flipped)
      }
    }
  } else if (node1.type === 'FunctionSymbol') {
    if (node2.type === 'FunctionSymbol') {
      return stype.makeSequenceSymbol([node1, node2])
    } else {
      return node1
    }
  } else if (node2.type === 'FunctionSymbol') {
    return node2
  }
  return stype.skipSymbol
}

// TODO big refactor
function execLogicalSymbol(
  node1: stype.SymbolicExecutable,
  node2: stype.SymbolicExecutable,
  op: string
): stype.SSymbol {
  if (node1.type === 'LiteralValueSymbol') {
    if (node2.type === 'LiteralValueSymbol') {
      return stype.skipSymbol
    } else {
      return execLogicalSymbol(node2, node1, op)
    }
  } else if (stype.isBooleanSymbol(node1)) {
    if (node2.type === 'LiteralValueSymbol' && typeof node2.value === 'boolean') {
      const val = node2.value
      if ((val && op === '&&') || op === '||') {
        return node1
      }
    } else if (stype.isBooleanSymbol(node2)) {
      return stype.makeLogicalSymbol(node1, node2, op === '&&')
    }
  } else if (node1.type === 'FunctionSymbol') {
    if (node2.type === 'FunctionSymbol') {
      return stype.makeSequenceSymbol([node1, node2])
    } else {
      return node1
    }
  } else if (node2.type === 'FunctionSymbol') {
    return node2
  }
  return stype.skipSymbol
}

function getFromStore(name: string, store: Map<string, stype.SSymbol>[]) {
  for (const st of store) {
    if (st.has(name)) {
      return st.get(name)
    }
  }
  return undefined
}

export function getFirstCall(node: es.FunctionDeclaration): stype.FunctionSymbol {
  function doParam(param: es.Node) {
    if (param.type === 'Identifier') {
      return stype.makeNumberSymbol(param.name, 0)
    }
    return stype.unusedSymbol
  }
  const id = node.id as es.Identifier
  const args = node.params.map(doParam)
  return stype.makeFunctionSymbol(id.name, args)
}

// TODO refactor?
export function symbolicExecute(
  node: stype.SymbolicExecutable,
  store: Map<string, stype.SSymbol>[]
): stype.SSymbol {
  // TODO maybe switch to switch instead of if
  if (stype.isSymbol(node)) {
    return node as stype.SSymbol
  } else if (node.type === 'Literal') {
    if (typeof node.value === 'number' || typeof node.value === 'boolean') {
      return stype.makeLiteralValueSymbol(node.value)
    }
  } else if (node.type === 'Identifier') {
    const checkStore = getFromStore(node.name, store)
    if (checkStore) {
      return checkStore
    } 
    return stype.skipSymbol
  } else if (node.type === 'VariableDeclaration') {
    const declaration = node.declarations[0]
    const rhs = declaration.init
    const id = declaration.id as es.Identifier
    if (rhs) {
      const result = symbolicExecute(rhs, store)
      if (stype.isTerminal(result)) {
        store[0][id.name] = result
        return stype.unusedSymbol
      } else {
        store[0][id.name] = stype.unusedSymbol
        return result
      }
    }
    return stype.unusedSymbol
  } else if (node.type === 'ExpressionStatement') {
    return symbolicExecute(node.expression, store)
  } else if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
    const test = symbolicExecute(node.test, store)
    const consequent = symbolicExecute(node.consequent, store)
    const alternate = node.alternate
      ? symbolicExecute(node.alternate, store)
      : stype.unusedSymbol
    return stype.makeBranchSymbol(test, consequent, alternate)
  } else if (node.type === 'BlockStatement') {
    const newContext = [new Map()].concat(store)
    return stype.makeSequenceSymbol(node.body.map(x => symbolicExecute(x, newContext)))
  } else if (node.type === 'BinaryExpression') {
    const lhs = symbolicExecute(node.left, store)
    const rhs = symbolicExecute(node.right, store)
    return execBinarySymbol(lhs, rhs, node.operator, false)
  } else if (node.type === 'UnaryExpression') {
    const arg = symbolicExecute(node.argument, store)
    if (node.operator === '!') {
      if (stype.isBooleanSymbol(arg)) {
        return stype.negateBooleanSymbol(arg)
      } else if (arg.type === 'LiteralValueSymbol') {
        return { ...arg, value: !arg.value }
      }
    } else if (node.operator === '-') {
      if (arg.type === 'NumberSymbol') {
        return stype.negateNumberSymbol(arg)
      } else if (arg.type === 'LiteralValueSymbol') {
        return { ...arg, value: -arg.value }
      }
    }
    return stype.skipSymbol
  } else if (node.type === 'LogicalExpression') {
    const lhs = symbolicExecute(node.left, store)
    const rhs = symbolicExecute(node.right, store)
    return execLogicalSymbol(lhs, rhs, node.operator)
  } else if (node.type === 'CallExpression') {
    if (node.callee.type === 'Identifier') {
      return stype.makeFunctionSymbol(
        node.callee.name,
        node.arguments.map(x => symbolicExecute(x, store))
      )
    }
  } else if (node.type === 'ReturnStatement') {
    const arg = node.argument
    if (arg === undefined || arg === null || arg.type === 'Identifier' || arg.type === 'Literal') {
      return stype.terminateSymbol
    } else {
      const value = symbolicExecute(arg, store) // TODO check: skip is term?
      return value.type === 'SkipSymbol' || value.type === 'BranchSymbol' || stype.isTerminal(value) ? stype.terminateSymbol : value
    }
  }
  return stype.skipSymbol
}
