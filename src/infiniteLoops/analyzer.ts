import * as stype from './symTypes'
import * as es from 'estree'

/* if all callees = caller, no terminate symbol -> no base case
 * if caller function always calls itself no matter what -> no base case
 */
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

/* check if the function calls itself without swapping variables, i.e.
 * f(x,y) calls f(x+1,y+1) returns true, but
 * f(x,y) calls f(y,x) returns false
 */
function alignedArgs(f1: stype.FunctionSymbol, f2: stype.FunctionSymbol) {
  if (f1.args.length !== f2.args.length) return false
  for (let i = 0; i < f1.args.length; i++) {
    const a1 = f1.args[i]
    const a2 = f2.args[i]
    const sameNumber =
      a1.type === 'NumberSymbol' && a2.type === 'NumberSymbol' && a1.name === a2.name
    const hasSkip = a1.type === 'SkipSymbol' || a2.type === 'SkipSymbol'
    if (sameNumber || hasSkip) {
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

/* checks for countdown functions, see documentation
 * for more details
 */

function checkCountdown(tset: stype.TransitionSet): stype.InfiniteLoopChecker[] {
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
        if (idx !== -1 && callee.args.length > idx) {
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

/* call all the variables that appear in the condition of the transition
 * 'relevant variables'. If the function calls itself but does not change
 * any of the relevant variables, there will be an infinite loop.
 */

function checkStateChange(tset: stype.TransitionSet): stype.InfiniteLoopChecker[] {
  function sameArgs(f1: stype.FunctionSymbol, f2: stype.SSymbol, names: string[]) {
    if (f2.type !== 'FunctionSymbol' || f1.name !== f2.name || !alignedArgs(f1, f2)) return false
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
        // a1 & a2 are exactly the same
        continue
      }
      for (const name of names) {
        if (a1.type === 'NumberSymbol' && a1.name === name) return false
      }
    }
    return true
  }
  function getNames(sym: stype.BooleanSymbol | null): string[] {
    if (sym === null) return []
    if (sym.type === 'InequalitySymbol') {
      return [sym.name]
    } else {
      return getNames(sym.left).concat(getNames(sym.right))
    }
  }

  const checkers: stype.InfiniteLoopChecker[] = []
  for (const transitions of tset.values()) {
    for (const transition of transitions) {
      const cond = transition.condition
      const caller = transition.caller
      const callee = transition.callee
      if (
        cond &&
        cond.type !== 'SkipSymbol' &&
        callee.type === 'FunctionSymbol' &&
        sameArgs(caller, callee, getNames(cond))
      ) {
        const name = transition.caller.name
        const checker = stype.makeLoopChecker(
          name,
          'Check your recursive function calls.',
          cond,
          callee.loc
        )
        checkers.push(checker)
      }
    }
  }
  return checkers
}

export function getCheckers(tset: stype.TransitionSet) {
  const checkers1 = checkCountdown(tset)
  const checkers2 = checkBaseCase(tset)
  const checkers3 = checkStateChange(tset)
  return checkers1.concat(checkers2).concat(checkers3)
}
