import * as es from 'estree'
import * as stype from './symTypes'
import { Environment } from '../types'

function execBinarySymbol(
  node1: stype.SymbolicExecutable,
  node2: stype.SymbolicExecutable,
  op: string,
  flipped: boolean
): stype.SSymbol {
  type opFunction = (value: number, sym: stype.NumberSymbol, flipped: boolean) => stype.SSymbol
  const operators: { [nodeType: string]: opFunction } = {
    '+'(value: number, sym: stype.NumberSymbol, flip: boolean) {
      return { ...sym, constant: sym.constant + value }
    },
    '-'(value: number, sym: stype.NumberSymbol, flip: boolean) {
      if (flip) {
        return { ...sym, constant: value - sym.constant, isPositive: !sym.isPositive }
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
    '<='(value: number, sym: stype.NumberSymbol, flip: boolean) {
      if (flip) {
        return operators['<'](value - 1, sym, flip)
      } else {
        return operators['<'](value + 1, sym, flip)
      }
    },
    '>='(value: number, sym: stype.NumberSymbol, flip: boolean) {
      return operators['<='](value, sym, !flip)
    },
    '!=='(value: number, sym: stype.NumberSymbol, flip: boolean) {
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

function makeStore(
  firstCall: stype.FunctionSymbol,
  env: Environment
): Map<string, stype.SSymbol>[] {
  const store = [new Map()]

  let environment: Environment | null = env
  while (environment) {
    const frame = environment.head
    const descriptors = Object.getOwnPropertyDescriptors(frame)
    for (const v in frame) {
      if (frame.hasOwnProperty(v) && typeof frame[v] === 'number' && !descriptors[v].writable) {
        store[0].set(v, stype.makeNumberSymbol(v, frame[v]))
      }
    }
    environment = (environment as Environment).tail
  }

  for (const v of firstCall.args) {
    if (v.type === 'NumberSymbol') {
      store[0].set(v.name, v)
    }
  }
  return store
}

type Executor = (node: es.Node, store: Map<string, stype.SSymbol>[]) => stype.SSymbol

export const nodeToSym: { [nodeType: string]: Executor } = {
  Literal(node: es.Literal, store: Map<string, stype.SSymbol>[]) {
    if (typeof node.value === 'number' || typeof node.value === 'boolean') {
      return stype.makeLiteralValueSymbol(node.value)
    }
    return stype.skipSymbol
  },
  Identifier(node: es.Identifier, store: Map<string, stype.SSymbol>[]) {
    const checkStore = getFromStore(node.name, store)
    if (checkStore) {
      return checkStore
    }
    return stype.skipSymbol
  },
  VariableDeclaration(node: es.VariableDeclaration, store: Map<string, stype.SSymbol>[]) {
    const declaration = node.declarations[0]
    const rhs = declaration.init
    const id = declaration.id as es.Identifier
    if (rhs) {
      const result = symEx(rhs, store)
      if (stype.isTerminal(result)) {
        store[0][id.name] = result
        return stype.unusedSymbol
      } else {
        store[0][id.name] = stype.unusedSymbol
        return result
      }
    }
    return stype.unusedSymbol
  },
  ExpressionStatement(node: es.ExpressionStatement, store: Map<string, stype.SSymbol>[]) {
    return symEx(node.expression, store)
  },
  IfStatement(
    node: es.IfStatement | es.ConditionalExpression,
    store: Map<string, stype.SSymbol>[]
  ) {
    const test = symEx(node.test, store)
    const consequent = symEx(node.consequent, store)
    const alternate = node.alternate ? symEx(node.alternate, store) : stype.unusedSymbol
    return stype.makeBranchSymbol(test, consequent, alternate)
  },
  ConditionalExpression(node: es.ConditionalExpression, store: Map<string, stype.SSymbol>[]) {
    return nodeToSym.IfStatement(node, store)
  },
  BlockStatement(node: es.BlockStatement, store: Map<string, stype.SSymbol>[]) {
    const newContext = [new Map()].concat(store)
    return stype.makeSequenceSymbol(node.body.map(x => symEx(x, newContext)))
  },
  BinaryExpression(node: es.BinaryExpression, store: Map<string, stype.SSymbol>[]) {
    const lhs = symEx(node.left, store)
    const rhs = symEx(node.right, store)
    return execBinarySymbol(lhs, rhs, node.operator, false)
  },
  UnaryExpression(node: es.UnaryExpression, store: Map<string, stype.SSymbol>[]) {
    const arg = symEx(node.argument, store)
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
  },
  LogicalExpression(node: es.LogicalExpression, store: Map<string, stype.SSymbol>[]) {
    const lhs = symEx(node.left, store)
    const rhs = symEx(node.right, store)
    return execLogicalSymbol(lhs, rhs, node.operator)
  },
  CallExpression(node: es.CallExpression, store: Map<string, stype.SSymbol>[]) {
    if (node.callee.type === 'Identifier') {
      return stype.makeFunctionSymbol(
        node.callee.name,
        node.arguments.map(x => symEx(x, store))
      )
    }
    return stype.skipSymbol
  },
  ReturnStatement(node: es.ReturnStatement, store: Map<string, stype.SSymbol>[]) {
    const arg = node.argument
    if (arg === undefined || arg === null || arg.type === 'Identifier' || arg.type === 'Literal') {
      return stype.terminateSymbol
    } else {
      const value = symEx(arg, store)
      if (value.type === 'BranchSymbol') {
        return returnConditional(value)
      }
      return value.type === 'SkipSymbol' || stype.isTerminal(value) ? stype.terminateSymbol : value
    }
  }
}

function returnConditional(sym: stype.BranchSymbol): stype.SSymbol {
  let consequent = stype.isTerminal(sym.consequent) ? stype.terminateSymbol : sym.consequent
  let alternate = stype.isTerminal(sym.alternate) ? stype.terminateSymbol : sym.alternate
  if (sym.consequent.type === 'BranchSymbol') {
    consequent = returnConditional(sym.consequent)
  }
  if (sym.alternate.type === 'BranchSymbol') {
    alternate = returnConditional(sym.alternate)
  }

  return stype.makeBranchSymbol(sym.test, consequent, alternate)
}

function symEx(node: stype.SymbolicExecutable, store: Map<string, stype.SSymbol>[]): stype.SSymbol {
  if (stype.isSymbol(node)) {
    return node as stype.SSymbol
  }
  const handler = nodeToSym[node.type]
  if (handler) {
    return handler(node, store)
  }
  return stype.skipSymbol
}

export function symbolicExecute(node: es.FunctionDeclaration, env: Environment) {
  const firstCall = getFirstCall(node)
  const store = makeStore(firstCall, env)
  return symEx(node.body, store)
}
