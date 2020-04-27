import * as es from 'estree'

// TODO find a better name
export type SSymbol =
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
export type BooleanSymbol = InequalitySymbol | LogicalSymbol
export interface NumberSymbol {
  type: 'NumberSymbol'
  name: string
  constant: number
  isPositive: boolean
}
export function makeNumberSymbol(name: string, constant: number, isPositive?: boolean) {
  return {
    type: 'NumberSymbol',
    name,
    constant,
    isPositive: isPositive === undefined ? true : isPositive
  } as NumberSymbol
}
export interface LiteralValueSymbol {
  type: 'LiteralValueSymbol'
  value: number | boolean
}
export function makeLiteralValueSymbol(value: number | boolean) {
  return { type: 'LiteralValueSymbol', value } as LiteralValueSymbol
}
// here for convenience
export interface LogicalSymbol {
  type: 'LogicalSymbol'
  left: BooleanSymbol
  right: BooleanSymbol
  conjunction: boolean
}
export function makeLogicalSymbol(
  left: BooleanSymbol,
  right: BooleanSymbol,
  conjunction?: boolean
) {
  return {
    type: 'LogicalSymbol',
    left,
    right,
    conjunction: conjunction === undefined ? true : conjunction
  } as LogicalSymbol
}
export interface InequalitySymbol {
  type: 'InequalitySymbol'
  name: string
  constant: number
  direction: number
}
export function makeInequalitySymbol(name: string, constant: number, direction: number) {
  return { type: 'InequalitySymbol', name, constant, direction } as InequalitySymbol
}
export interface FunctionSymbol {
  type: 'FunctionSymbol'
  name: string
  args: SSymbol[]
  loc: es.SourceLocation
}
export function makeFunctionSymbol(name: string, args: SSymbol[], loc: es.SourceLocation) {
  return { type: 'FunctionSymbol', name, args, loc } as FunctionSymbol
}
export interface BranchSymbol {
  type: 'BranchSymbol'
  test: SSymbol
  consequent: SSymbol
  alternate: SSymbol
}
export function makeBranchSymbol(test: SSymbol, consequent: SSymbol, alternate: SSymbol) {
  return { type: 'BranchSymbol', test, consequent, alternate } as BranchSymbol
}
export interface SequenceSymbol {
  type: 'SequenceSymbol'
  symbols: SSymbol[]
}
export function makeSequenceSymbol(symbols: SSymbol[]) {
  return { type: 'SequenceSymbol', symbols } as SequenceSymbol
}
export interface SkipSymbol {
  type: 'SkipSymbol'
}
export interface TerminateSymbol {
  type: 'TerminateSymbol'
}
export interface UnusedSymbol {
  type: 'UnusedSymbol'
}
export const skipSymbol = { type: 'SkipSymbol' } as SkipSymbol
export const terminateSymbol = { type: 'TerminateSymbol' } as TerminateSymbol
export const unusedSymbol = { type: 'UnusedSymbol' } as UnusedSymbol
export type SymbolicExecutable = es.Node | SSymbol
export function isSymbol(node: SymbolicExecutable): node is SSymbol {
  return node.type.slice(-6) === 'Symbol'
}
export function negateBooleanSymbol(sym: BooleanSymbol): BooleanSymbol {
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
  }
  return sym
}
export function isBooleanSymbol(node: SymbolicExecutable): node is BooleanSymbol {
  return node.type === 'LogicalSymbol' || node.type === 'InequalitySymbol'
}
export function negateNumberSymbol(sym: NumberSymbol): NumberSymbol {
  return { ...sym, constant: -sym.constant, isPositive: !sym.isPositive }
}

export function isTerminal(node: SymbolicExecutable): boolean {
  if (node.type === 'BranchSymbol') {
    return isTerminal(node.consequent) && isTerminal(node.alternate)
  } else if (node.type === 'SequenceSymbol') {
    return node.symbols.every(isTerminal)
  }
  return node.type !== 'FunctionSymbol' && node.type !== 'SkipSymbol'
}

export function terminalOrSkip(node: SymbolicExecutable): boolean {
  return isTerminal(node) || node.type === 'SkipSymbol'
}

export interface Transition {
  caller: FunctionSymbol
  callee: FunctionSymbol | TerminateSymbol
  condition: BooleanSymbol | SkipSymbol | null
}

export function makeTransition(
  caller: FunctionSymbol,
  callee: FunctionSymbol | TerminateSymbol,
  condition: BooleanSymbol | SkipSymbol | null
) {
  return { caller, callee, condition } as Transition
}

export type TransitionSet = Map<string, Transition[]>

export interface InfiniteLoopChecker {
  functionName: string
  message: string
  condition: BooleanSymbol
  loc: es.SourceLocation
}

export function makeLoopChecker(
  functionName: string,
  message: string,
  condition: BooleanSymbol | null,
  loc: es.SourceLocation
) {
  return {
    functionName,
    message: 'Infinite recursion (or runtime error) detected. ' + message,
    condition,
    loc
  } as InfiniteLoopChecker
}
