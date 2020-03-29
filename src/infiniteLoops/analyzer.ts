import * as stype from './symTypes'

enum InfiniteLoopType {
  Terminates,
  NoBaseCase,
  NoStateChange,
  MLinearDiv
}

// TODO change checker to return string?
function checkBaseCase(tset: stype.TransitionSet): stype.infiniteLoopChecker[] {
  function makeChecker(name: string): stype.infiniteLoopChecker {
    return (name2: string, args: any[]): number =>
      name === name2 ? InfiniteLoopType.NoBaseCase : InfiniteLoopType.Terminates
  }
  function getName(sym: stype.FunctionSymbol | stype.TerminateSymbol) {
    return sym.type === 'TerminateSymbol' ? '*' : sym.name
  }

  const checkers: stype.infiniteLoopChecker[] = []
  for (const [name, transitions] of tset.entries()) {
    const calleeNames = transitions.map(x => getName(x.callee))
    if (calleeNames.every(x => x === name)) {
      checkers.push(makeChecker(name))
    }
  }
  return checkers
}

function makeUnaryChecker(
  name1: string,
  constant: number,
  direction: number,
  idx: number
): stype.infiniteLoopChecker {
  const test: {
    [num: string]: stype.infiniteLoopChecker
  } = {
    '-1'(name2: string, args: any[]): number {
      return name1 === name2 && args.length === 1 && args[idx] < constant
        ? InfiniteLoopType.MLinearDiv
        : InfiniteLoopType.Terminates
    },
    '1'(name2: string, args: any[]): number {
      return name1 === name2 && args.length === 1 && args[idx] > constant
        ? InfiniteLoopType.MLinearDiv
        : InfiniteLoopType.Terminates
    },
    '0'(name2: string, args: any[]): number {
      return name1 === name2 && args.length === 1 && args[idx] === constant
        ? InfiniteLoopType.MLinearDiv
        : InfiniteLoopType.Terminates
    }
  }
  return test[direction.toString()]
}

function alignedArgs(f1: stype.FunctionSymbol, f2: stype.FunctionSymbol) {
  for (let i = 0; i < f1.args.length; i++) {
    const a1 = f1.args[i]
    const a2 = f2.args[i]
    if (a1.type === 'NumberSymbol' && a2.type === 'NumberSymbol' && a1.name === a2.name) {
      continue
    }
    return false
  }
  return true
}

function getArg(sym: stype.FunctionSymbol, name: string) {
  for (let i = 0; i < sym.args.length; i++) {
    const x = sym.args[i]
    if (x.type === 'NumberSymbol' && x.name === name) {
      return i
    }
  }
  return -1
}

function simpleCheck(tset: stype.TransitionSet): stype.infiniteLoopChecker[] {
  function check1(transition: stype.Transition) {
    const caller = transition.caller
    const callee = transition.callee
    if (
      callee.type === 'FunctionSymbol' &&
      caller.name === callee.name &&
      alignedArgs(caller, callee)
    ) {
      const cond = transition.condition
      if (cond?.type === 'InequalitySymbol') {
        const idx = getArg(callee, cond.name)
        if (idx !== -1) {
          const arg = callee.args[idx] as stype.NumberSymbol
          if (arg?.isPositive && arg.constant * cond.direction > 0) {
            return makeUnaryChecker(caller.name, arg.constant, cond.direction, idx)
          }
        }
      }
    }
    return undefined
  }
  const checkers: stype.infiniteLoopChecker[] = []
  for (const transitions of tset.values()) {
    for (const transition of transitions) {
      const checker = check1(transition)
      if (checker) {
        checkers.push(checker)
      }
    }
  }
  return checkers
}

function checkStateChange(tset: stype.TransitionSet): stype.infiniteLoopChecker[] {
  function sameArgs(f1: stype.FunctionSymbol, f2: stype.SSymbol) {
    if (f2.type !== 'FunctionSymbol') return false
    if (f1.name !== f2.name) return false
    for (let i = 0; i < f1.args.length; i++) {
      const a1 = f1.args[i]
      const a2 = f2.args[i]
      if (
        a1.type === 'NumberSymbol' &&
        a2.type === 'NumberSymbol' &&
        a1.name === a2.name &&
        a1.constant === a2.constant &&
        a1.isPositive === a2.isPositive
      ) {
        continue
      }
      return false
    }
    return true
  }
  function unpackSymbol(fun: stype.FunctionSymbol, cond: stype.BooleanSymbol): number[][] {
    if (cond.type === 'InequalitySymbol') {
      const idx = getArg(fun, cond.name)
      return [[idx, cond.constant, cond.direction]]
    }
    const lhs = unpackSymbol(fun, cond.left)
    const rhs = unpackSymbol(fun, cond.right)
    return lhs.concat(rhs)
  }
  function makeChecker(fun: stype.FunctionSymbol, sym: stype.BooleanSymbol) {
    const checks = unpackSymbol(fun, sym)
    const name = fun.name
    return (name2: string, args: any[]): number => {
      for (const check of checks) {
        if (check[2] * args[check[0]] < check[1]) {
          continue
        }
        return InfiniteLoopType.Terminates
      }
      return name === name2 ? InfiniteLoopType.NoStateChange : InfiniteLoopType.Terminates
    }
  }

  const checkers: stype.infiniteLoopChecker[] = []
  for (const transitions of tset.values()) {
    for (const transition of transitions) {
      if (sameArgs(transition.caller, transition.callee)) {
        if (transition.condition && transition.condition.type !== 'SkipSymbol') {
          checkers.push(makeChecker(transition.caller, transition.condition))
        } else if (transition.condition === null) {
          const name = transition.caller.name
          const checker = (name2: string, args: any[]): number =>
            name === name2 ? InfiniteLoopType.MLinearDiv : InfiniteLoopType.Terminates
          checkers.push(checker)
        }
      }
    }
  }
  return checkers
}

export function updateCheckers(tset: stype.TransitionSet) {
  const checkers1 = simpleCheck(tset)
  const checkers2 = checkBaseCase(tset)
  const checkers3 = checkStateChange(tset)

  return checkers1.concat(checkers2).concat(checkers3)
}

function getErrorMessage(code: InfiniteLoopType) {
  if (code === InfiniteLoopType.NoBaseCase) {
    return ' Did you forget your base case?'
  } else if (code === InfiniteLoopType.NoStateChange) {
    return ' Check your function calls.'
  } else if (code === InfiniteLoopType.MLinearDiv) {
    return ' Did you call a value that is outside the range of your function?'
  }
  return undefined
}

export function testFunction(name: string, args: any[], checkers: stype.infiniteLoopChecker[]) {
  for (const checker of checkers) {
    const status = checker(name, args)
    if (status !== InfiniteLoopType.Terminates) {
      return getErrorMessage(status)
    }
  }
  return undefined
}
