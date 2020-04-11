import * as stype from './symTypes'
import * as es from 'estree'

function checkBaseCase(tset: stype.TransitionSet): stype.InfiniteLoopChecker[] {
  function makeChecker(name: string, loc: es.SourceLocation): stype.InfiniteLoopChecker {
    return stype.makeLoopChecker(name, 'Did you forget your base case?', null, loc)
  }
  function getName(sym: stype.FunctionSymbol | stype.TerminateSymbol) {
    return sym.type === 'TerminateSymbol' ? '*' : sym.name
  }

  const checkers: stype.InfiniteLoopChecker[] = []
  for (const [name, transitions] of tset.entries()) {
    const calleeNames = transitions.map(x => getName(x.callee))
    if (calleeNames.every(x => x === name)) {
      const loc = transitions[0].caller.loc
      checkers.push(makeChecker(name, loc))
    }
  }
  return checkers
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
            return stype.makeLoopChecker(
              caller.name,
              'Did you call a value that is outside the range of your function?',
              cond,
              callee.loc
            )
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
        if (transition.condition && transition.condition.type !== 'SkipSymbol') {
          const callee = transition.callee as stype.FunctionSymbol
          const checker = stype.makeLoopChecker(
            name,
            'Check your function calls.',
            transition.condition,
            callee.loc
          )
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
