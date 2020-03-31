import * as stype from './symTypes'

enum InfiniteLoopType {
  Terminates,
  NoBaseCase,
  NoStateChange,
  MLinearDiv
}

function testBaseCase(
  checker: stype.InfiniteLoopChecker,
  name: string,
  args: any[]
): InfiniteLoopType {
  return name === checker.functionName && checker.id === InfiniteLoopType.NoBaseCase
    ? InfiniteLoopType.NoBaseCase
    : InfiniteLoopType.Terminates
}

function checkBaseCase(tset: stype.TransitionSet): stype.InfiniteLoopChecker[] {
  function makeChecker(name: string): stype.InfiniteLoopChecker {
    const id: number = InfiniteLoopType.NoBaseCase
    return stype.makeLoopChecker(id, name, [])
  }
  function getName(sym: stype.FunctionSymbol | stype.TerminateSymbol) {
    return sym.type === 'TerminateSymbol' ? '*' : sym.name
  }

  const checkers: stype.InfiniteLoopChecker[] = []
  for (const [name, transitions] of tset.entries()) {
    const calleeNames = transitions.map(x => getName(x.callee))
    if (calleeNames.every(x => x === name)) {
      checkers.push(makeChecker(name))
    }
  }
  return checkers
}

function testMLinearDiv(
  checker: stype.InfiniteLoopChecker,
  name: string,
  args: any[]
): InfiniteLoopType {
  const constant = checker.checkerArgs[0]
  const direction = checker.checkerArgs[1]
  const idx = checker.checkerArgs[2]
  if (name === checker.functionName && args[idx]) {
    if (direction === -1 && args[idx] < constant) {
      return InfiniteLoopType.MLinearDiv
    } else if (direction === 0 && args[idx] === constant) {
      return InfiniteLoopType.MLinearDiv
    } else if (direction === 1 && args[idx] > constant) {
      return InfiniteLoopType.MLinearDiv
    }
  }
  return InfiniteLoopType.Terminates
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

function checkMLinearDiv(tset: stype.TransitionSet): stype.InfiniteLoopChecker[] {
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
            const checkerArgs = [arg.constant, cond.direction, idx]
            return stype.makeLoopChecker(InfiniteLoopType.MLinearDiv, caller.name, checkerArgs)
          }
        }
      }
    }
    return undefined
  }
  const checkers: stype.InfiniteLoopChecker[] = []
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

function unpackSymbol(fun: stype.FunctionSymbol, cond: stype.BooleanSymbol): number[][] {
  if (cond.type === 'InequalitySymbol') {
    const idx = getArg(fun, cond.name)
    return [[idx, cond.constant, cond.direction]]
  }
  const lhs = unpackSymbol(fun, cond.left)
  const rhs = unpackSymbol(fun, cond.right)
  return lhs.concat(rhs)
}

function testStateChange(
  checker: stype.InfiniteLoopChecker,
  name: string,
  args: any[]
): InfiniteLoopType {
  const fun = checker.checkerArgs[0]
  const sym = checker.checkerArgs[1]
  const checks = unpackSymbol(fun, sym)
  if (name === checker.functionName && sym !== null) {
    for (const check of checks) {
      const idx = check[0]
      const constant = check[1]
      const direction = check[2]
      if (direction === -1 && args[idx] < constant) {
        continue
      } else if (direction === 0 && args[idx] === constant) {
        continue
      } else if (direction === 1 && args[idx] > constant) {
        continue
      }
      return InfiniteLoopType.Terminates
    }
    return InfiniteLoopType.NoStateChange
  }
  return InfiniteLoopType.Terminates
}

function checkStateChange(tset: stype.TransitionSet): stype.InfiniteLoopChecker[] {
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

  const checkers: stype.InfiniteLoopChecker[] = []
  for (const transitions of tset.values()) {
    for (const transition of transitions) {
      if (sameArgs(transition.caller, transition.callee)) {
        const name = transition.caller.name
        const checkerArgs = [transition.caller, transition.condition]
        if (transition.condition && transition.condition.type !== 'SkipSymbol') {
          const checker = stype.makeLoopChecker(InfiniteLoopType.NoStateChange, name, checkerArgs)
          checkers.push(checker)
        }
      }
    }
  }
  return checkers
}

export function updateCheckers(tset: stype.TransitionSet) {
  const checkers1 = checkMLinearDiv(tset)
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

export function testFunction(name: string, args: any[], checkers: stype.InfiniteLoopChecker[]) {
  // quick fix to make the deployment work, TODO: make more robust
  const testers = [null, testBaseCase, testStateChange, testMLinearDiv]
  for (const checker of checkers) {
    const test = testers[checker.id]
    if (test) {
      const status = test(checker, name, args)
      if (status !== InfiniteLoopType.Terminates) {
        return getErrorMessage(status)
      }
    }
  }
  return undefined
}
