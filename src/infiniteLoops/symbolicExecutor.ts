import * as es from 'estree'

// TODO find a better name
type SSymbol =
  | NumberSymbol
  | InequalitySymbol
  | FunctionSymbol
  | BranchSymbol
  | SequenceSymbol
  | UnusedSymbol
  | SkipSymbol
  | TerminateSymbol
  | BooleanSymbol
  | LiteralValueSymbol

type BooleanSymbol = BooleanValueSymbol | InequalitySymbol | LogicalSymbol

interface NumberSymbol {
  type: 'NumberSymbol'
  name: string
  constant: number
  isPositive: boolean
}

function makeNumberSymbol(name: string, constant: number, isPositive?: boolean) {
  return {
    type: 'NumberSymbol',
    name,
    constant,
    isPositive: isPositive === undefined ? true : isPositive
  } as NumberSymbol
}

interface LiteralValueSymbol {
  type: 'LiteralValueSymbol'
  value: number | boolean
}

function makeLiteralValueSymbol(value: number | boolean) {
  return { type: 'LiteralValueSymbol', value } as LiteralValueSymbol
}

interface BooleanValueSymbol {
  type: 'BooleanValueSymbol'
  name: string
  value: boolean
}
/*
function makeBooleanValueSymbol (name:string, value:boolean) {
    return {type: 'BooleanValueSymbol', name: name, value: value} as BooleanValueSymbol
}
*/

// here for convenience
interface LogicalSymbol {
  type: 'LogicalSymbol'
  left: BooleanSymbol
  right: BooleanSymbol
  conjunction: boolean
}
function makeLogicalSymbol(left: BooleanSymbol, right: BooleanSymbol, conjunction?: boolean) {
  return {
    type: 'LogicalSymbol',
    left,
    right,
    conjunction: conjunction === undefined ? true : conjunction
  } as LogicalSymbol
}

interface InequalitySymbol {
  type: 'InequalitySymbol'
  name: string
  constant: number
  direction: number
}

function makeInequalitySymbol(name: string, constant: number, direction: number) {
  return { type: 'InequalitySymbol', name, constant, direction } as InequalitySymbol
}

interface FunctionSymbol {
  type: 'FunctionSymbol'
  name: string
  args: SSymbol[]
}

function makeFunctionSymbol(name: string, args: SSymbol[]) {
  return { type: 'FunctionSymbol', name, args } as FunctionSymbol
}

interface BranchSymbol {
  type: 'BranchSymbol'
  test: BooleanSymbol
  consequent: SSymbol
  alternate: SSymbol
}

function makeBranchSymbol(test: BooleanSymbol, consequent: SSymbol, alternate: SSymbol) {
  return { type: 'BranchSymbol', test, consequent, alternate } as BranchSymbol
}

interface SequenceSymbol {
  type: 'SequenceSymbol'
  symbols: SSymbol[]
}

function makeSequenceSymbol(symbols: SSymbol[]) {
  return { type: 'SequenceSymbol', symbols } as SequenceSymbol
}

interface SkipSymbol {
  type: 'SkipSymbol'
}

interface TerminateSymbol {
  type: 'TerminateSymbol'
}

interface UnusedSymbol {
  type: 'UnusedSymbol'
}
const skipSymbol = { type: 'SkipSymbol' } as SkipSymbol
const terminateSymbol = { type: 'TerminateSymbol' } as TerminateSymbol
const unusedSymbol = { type: 'UnusedSymbol' } as UnusedSymbol

type SymbolicExecutable = es.Node | SSymbol

function isSymbol(node: SymbolicExecutable): node is SSymbol {
  return node.type.slice(-6) === 'Symbol'
}

function negateBooleanSymbol(sym: BooleanSymbol): BooleanSymbol {
  if (sym.type === 'LogicalSymbol') {
    const newLhs = negateBooleanSymbol(sym.left)
    const newRhs = negateBooleanSymbol(sym.right)
    return makeLogicalSymbol(newLhs, newRhs, !sym.conjunction) // de morgans
  } else if (sym.type === 'InequalitySymbol') {
    if (sym.direction === 0) {
      return makeLogicalSymbol({ ...sym, direction: 1 }, { ...sym, direction: -1 }, false)
    } else {
      const newConst = sym.constant + sym.direction
      return makeInequalitySymbol(sym.name, newConst, -sym.direction)
    }
  } else if (sym.type === 'BooleanValueSymbol') {
    return sym // TODO handle
  }
  return sym
}
function isBooleanSymbol(node: SymbolicExecutable): node is BooleanSymbol {
  return (
    node.type === 'BooleanValueSymbol' ||
    node.type === 'LogicalSymbol' ||
    node.type === 'InequalitySymbol'
  )
}

function negateNumberSymbol(sym: NumberSymbol): NumberSymbol {
  return { ...sym, constant: -sym.constant, isPositive: true }
}

function execBinarySymbol(
  node1: SymbolicExecutable,
  node2: SymbolicExecutable,
  op: string,
  flipped: boolean
): SSymbol {
  type opFunction = (value: number, sym: NumberSymbol, flipped: boolean) => SSymbol
  // TODO big todo: check the math of below (esp flipped, >= after flip etc)
  const operators: { [nodeType: string]: opFunction } = {
    '+'(value: number, sym: NumberSymbol, flip: boolean) {
      return { ...sym, constant: sym.constant + value }
    },
    '-'(value: number, sym: NumberSymbol, flip: boolean) {
      if (flip) {
        return { ...sym, constant: value - sym.constant, isPositive: true }
      } else {
        return { ...sym, constant: sym.constant - value }
      }
    },
    '==='(value: number, sym: NumberSymbol, flip: boolean) {
      return makeInequalitySymbol(sym.name, value - sym.constant, 0)
    },
    '<'(value: number, sym: NumberSymbol, flip: boolean) {
      if (sym.isPositive) {
        if (flip) {
          return makeInequalitySymbol(sym.name, value - sym.constant, 1)
        } else {
          return makeInequalitySymbol(sym.name, value - sym.constant, -1)
        }
      } else {
        const negated = negateNumberSymbol(sym)
        return operators['>'](value, negated, flip)
      }
    },
    '>'(value: number, sym: NumberSymbol, flip: boolean) {
      return operators['<'](value, sym, !flip)
    },
    '>='(value: number, sym: NumberSymbol, flip: boolean) {
      return operators['>'](value - 1, sym, flip)
    },
    '<='(value: number, sym: NumberSymbol, flip: boolean) {
      return operators['<'](value + 1, sym, flip)
    },
    '!=='(value: number, sym: NumberSymbol, flip: boolean) {
      // TODO check this (inside branch test?) *change seq to boolean sym
      return negateBooleanSymbol(operators['==='](value, sym, false) as InequalitySymbol)
    }
  }
  if (node1.type === 'LiteralValueSymbol' && node2.type === 'NumberSymbol') {
    return execBinarySymbol(node2, node1, op, true)
  } else if (node2.type === 'LiteralValueSymbol' && node1.type === 'NumberSymbol') {
    const val = node2.value
    if (typeof val === 'number' && Number.isInteger(val)) {
      const toRun = operators[op]
      if (toRun !== undefined) {
        return toRun(val, node1 as NumberSymbol, flipped)
      }
    }
  } else if (node1.type === 'FunctionSymbol') {
    if (node2.type === 'FunctionSymbol') {
      return makeSequenceSymbol([node1, node2])
    } else {
      return node1
    }
  } else if (node2.type === 'FunctionSymbol') {
    return node2
  }
  return skipSymbol
}

// TODO big refactor
function execLogicalSymbol(
  node1: SymbolicExecutable,
  node2: SymbolicExecutable,
  op: string
): SSymbol {
  if (node1.type === 'LiteralValueSymbol') {
    if (node2.type === 'LiteralValueSymbol') {
      return skipSymbol
    } else {
      return execLogicalSymbol(node2, node1, op)
    }
  } else if (isBooleanSymbol(node1)) {
    if (node2.type === 'LiteralValueSymbol' && typeof node2.value === 'boolean') {
      const val = node2.value
      if ((val && op === '&&') || op === '||') {
        return node1
      }
    } else if (isBooleanSymbol(node2)) {
      return makeLogicalSymbol(node1, node2, op === '&&')
    }
  } else if (node1.type === 'FunctionSymbol') {
    if (node2.type === 'FunctionSymbol') {
      return makeSequenceSymbol([node1, node2])
    } else {
      return node1
    }
  } else if (node2.type === 'FunctionSymbol') {
    return node2
  }
  return skipSymbol
}

function getFromEnv(name: string, context: Map<string, SSymbol>[]) {
  for (const env of context) {
    if (env[name]) {
      return env[name]
    }
  }
  return undefined
}

function isTerminal(node: SymbolicExecutable): boolean {
  if (node.type === 'BranchSymbol') {
    return isTerminal(node.consequent) && isTerminal(node.alternate)
  } else if (node.type === 'SequenceSymbol') {
    return node.symbols.every(isTerminal) // check
  }
  return node.type !== 'FunctionSymbol' && node.type !== 'SkipSymbol'
}

// TODO refactor?
function symbolicExecute(node: SymbolicExecutable, context: Map<string, SSymbol>[]): SSymbol {
  // TODO maybe switch to switch instead of if
  if (isSymbol(node)) {
    return node as SSymbol // ???
  } else if (node.type === 'Literal') {
    if (typeof node.value === 'number' || typeof node.value === 'boolean') {
      return makeLiteralValueSymbol(node.value)
    }
  } else if (node.type === 'Identifier') {
    const checkEnv = getFromEnv(node.name, context)
    if (checkEnv) {
      return checkEnv
    }
    return makeNumberSymbol(node.name, 0)
  } else if (node.type === 'VariableDeclaration') {
    // environment something again
    // TODO hoising business? (need?)
    // TODO if rhs calls fn
    const declaration = node.declarations[0]
    const rhs = declaration.init
    const id = declaration.id as es.Identifier
    if (rhs) {
      context[0][id.name] = symbolicExecute(rhs, context)
    }
    return unusedSymbol
  } else if (node.type === 'ExpressionStatement') {
    return symbolicExecute(node.expression, context)
  } else if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
    // TODO if cond expr value is used
    const test = symbolicExecute(node.test, context)
    const consequent = symbolicExecute(node.consequent, context)
    const alternate = node.alternate ? symbolicExecute(node.alternate, context) : unusedSymbol
    if (isBooleanSymbol(test)) {
      return makeBranchSymbol(test, consequent, alternate)
    }
    return skipSymbol
  } else if (node.type === 'BlockStatement') {
    const newContext = [new Map()].concat(context)
    return makeSequenceSymbol(node.body.map(x => symbolicExecute(x, newContext)))
  } else if (node.type === 'BinaryExpression') {
    const lhs = symbolicExecute(node.left, context)
    const rhs = symbolicExecute(node.right, context)
    return execBinarySymbol(lhs, rhs, node.operator, false)
  } else if (node.type === 'UnaryExpression') {
    const arg = symbolicExecute(node.argument, context)
    if (node.operator === '!') {
      if (isBooleanSymbol(arg)) {
        return negateBooleanSymbol(arg)
      } else if (arg.type === 'LiteralValueSymbol') {
        return { ...arg, value: !arg.value }
      }
    } else if (node.operator === '-') {
      if (arg.type === 'NumberSymbol') {
        return negateNumberSymbol(arg)
      } else if (arg.type === 'LiteralValueSymbol') {
        return { ...arg, value: -arg.value }
      }
    }
    return skipSymbol
  } else if (node.type === 'LogicalExpression') {
    const lhs = symbolicExecute(node.left, context)
    const rhs = symbolicExecute(node.right, context)
    return execLogicalSymbol(lhs, rhs, node.operator)
  } else if (node.type === 'CallExpression') {
    if (node.callee.type === 'Identifier') {
      return makeFunctionSymbol(
        node.callee.name,
        node.arguments.map(x => symbolicExecute(x, context))
      )
    }
  } else if (node.type === 'ReturnStatement') {
    const arg = node.argument
    if (arg === undefined || arg === null || arg.type === 'Identifier' || arg.type === 'Literal') {
      return terminateSymbol
    } else {
      const value = symbolicExecute(arg, context)
      return isTerminal(value) ? terminateSymbol : value
    }
  }
  return skipSymbol
}

function collapseConjunction(node: BooleanSymbol): BooleanSymbol {
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
        return makeInequalitySymbol(name, Math.min(left.constant, right.constant), direction)
      } else if (left.direction > 0) {
        return makeInequalitySymbol(name, Math.max(left.constant, right.constant), direction)
      }
    } else {
      return { ...node, left: collapseConjunction(left), right: collapseConjunction(right) }
    }
  }
  return node
}

function seperateDisjunctions(node: BooleanSymbol): BooleanSymbol[] {
  // TODO also check the math
  if (node.type === 'LogicalSymbol') {
    const splitLeft = seperateDisjunctions(node.left)
    const splitRight = seperateDisjunctions(node.right)
    if (node.conjunction) {
      const res = []
      for (const left of splitLeft) {
        for (const right of splitRight) {
          res.push(makeLogicalSymbol(left, right, true))
        }
      }
      return res
    } else {
      return splitLeft.concat(splitRight)
    }
  }
  return [node]
}

function processLogical(node: BooleanSymbol) {
  return seperateDisjunctions(node).map(collapseConjunction)
}

function serialize(node: SSymbol): SSymbol[][] {
  if (isTerminal(node)) {
    return [[terminateSymbol]]
  } else if (node.type === 'SequenceSymbol') {
    let result: SSymbol[][] = []
    const temp = node.symbols.map(serialize)
    for (const subList of temp) {
      result = result.concat(subList)
    }
    return result
  } else if (node.type === 'BranchSymbol') {
    const consTail = serialize(node.consequent)
    const altTail = serialize(node.alternate)
    let result: SSymbol[][] = []
    for (const sym of processLogical(node.test)) {
      result = result.concat(consTail.map(x => [sym as SSymbol].concat(x)))
    }

    for (const sym of processLogical(negateBooleanSymbol(node.test))) {
      result = result.concat(altTail.map(x => [sym as SSymbol].concat(x)))
    }
    return result
  } else if (node.type === 'FunctionSymbol') {
    return [[node]]
  }
  return []
}
export type infiniteLoopChecker = (name: string, args: any[]) => boolean

function makeUnaryChecker(name1: string, constant: number, direction: number): infiniteLoopChecker {
  const test: { [num: string]: infiniteLoopChecker } = {
    '-1'(name2: string, args: any[]): boolean {
      return name1 === name2 && args.length === 1 && args[0] < constant
    },
    '1'(name2: string, args: any[]): boolean {
      return name1 === name2 && args.length === 1 && args[0] > constant
    },
    '0'(name2: string, args: any[]): boolean {
      return name1 === name2 && args.length === 1 && args[0] === constant
    }
  }
  return test[direction.toString()]
}

function simpleCheck(symLists: SSymbol[]): infiniteLoopChecker | undefined {
  if (
    symLists.length === 3 &&
    symLists[0].type === 'FunctionSymbol' &&
    symLists[1].type === 'InequalitySymbol' &&
    symLists[2].type === 'FunctionSymbol' &&
    symLists[0].name === symLists[0].name &&
    symLists[0].args.length === 1
  ) {
    // TODO make more general
    const to = symLists[2].args[0]
    const direction = symLists[1].direction
    if (to.type === 'NumberSymbol' && to.constant * direction > 0) {
      return makeUnaryChecker(symLists[0].name, symLists[1].constant, direction)
    }
  }
  return undefined
}

function getFirstCall(node: es.FunctionDeclaration): SSymbol {
  function doParam(param: es.Node) {
    if (param.type === 'Identifier') {
      return makeNumberSymbol(param.name, 0)
    }
    return unusedSymbol
  }
  const id = node.id as es.Identifier
  const args = node.params.map(doParam)
  return makeFunctionSymbol(id.name, args)
}

export function toName(node: es.FunctionDeclaration) {
  const firstCall = getFirstCall(node)
  const symTree = symbolicExecute(node.body, [new Map()])
  const symLists = serialize(symTree).map(x => [firstCall].concat(x))

  return symLists.map(simpleCheck).filter(x => x !== undefined) as infiniteLoopChecker[]
}
