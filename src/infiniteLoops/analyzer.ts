import * as es from 'estree'
import * as stype from './symTypes'
import { Environment } from '../types';
import { serialize } from './serializer';
import { symbolicExecute } from './symbolicExecutor';

type Tset = Map<string, stype.Transition[]>

// TODO change checker to return string?
function checkBaseCase(tset: Tset): stype.infiniteLoopChecker[] {
  function makeChecker(name: string): stype.infiniteLoopChecker {
    return (name2: string, args: any[]): boolean => name === name2;
  }
  function getName(sym: stype.FunctionSymbol | stype.TerminateSymbol) {
    return sym.type === 'TerminateSymbol' ? '*' : sym.name
  }

  const checkers:stype.infiniteLoopChecker[] = [];
  for (const [name, transitions] of tset.entries()) {
    const calleeNames = transitions.map(x=>getName(x.callee))
    if (calleeNames.every(x=>x===name)) {
      checkers.push(makeChecker(name))
    }
  }
  return checkers;
}


function makeUnaryChecker(name1: string, constant: number, direction: number, idx: number): stype.infiniteLoopChecker {
  const test: {
    [num: string]: stype.infiniteLoopChecker;
  } = {
    '-1'(name2: string, args: any[]): boolean {
      return name1 === name2 && args.length === 1 && args[idx] < constant;
    },
    '1'(name2: string, args: any[]): boolean {
      return name1 === name2 && args.length === 1 && args[idx] > constant;
    },
    '0'(name2: string, args: any[]): boolean {
      return name1 === name2 && args.length === 1 && args[idx] === constant;
    }
  };
  return test[direction.toString()];
}

function alignedArgs(f1: stype.FunctionSymbol, f2: stype.FunctionSymbol) {
  for (let i=0;i<f1.args.length;i++) {
    const a1 = f1.args[i]
    const a2 = f2.args[i]
    if(a1.type === 'NumberSymbol' && a2.type === 'NumberSymbol' && a1.name === a2.name) {
      continue
    }
    return false
  }
  return true
}

function getArg(sym: stype.FunctionSymbol, name: string) {
  for (let i=0;i<sym.args.length;i++) {
    const x = sym.args[i]
    if (x.type === 'NumberSymbol' && x.name === name) {
      return i
    }
  }
  return -1;
}

function simpleCheck(tset: Tset): stype.infiniteLoopChecker[] {
  function check1(transition: stype.Transition) {
    const caller = transition.caller
    const callee = transition.callee
    if(callee.type === 'FunctionSymbol' && caller.name === callee.name && alignedArgs(caller,callee)) {
      const cond = transition.condition
      if(cond?.type === 'InequalitySymbol') {
        const idx = getArg(callee, cond.name)
        if (idx!==-1) {
          const arg = callee.args[idx] as stype.NumberSymbol
          if(arg?.isPositive && arg.constant*cond.direction > 0) {
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

function checkStateChange(tset: Tset): stype.infiniteLoopChecker[] {
  function sameArgs(f1: stype.FunctionSymbol, f2: stype.SSymbol) {
    if (f2.type !== 'FunctionSymbol') return false
    if (f1.name !== f2.name) return false
    for (let i=0;i<f1.args.length;i++) {
      const a1 = f1.args[i]
      const a2 = f2.args[i]
      if(a1.type === 'NumberSymbol' && a2.type === 'NumberSymbol' && a1.name === a2.name && a1.constant === a2.constant && a1.isPositive === a2.isPositive) {
        continue
      }
      return false
    }
    return true
  }
  function unpackSymbol(fun: stype.FunctionSymbol, cond: stype.BooleanSymbol) : number[][] {
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
    return (name2: string, args: any[]): boolean => {
      for(const check of checks) {
        if ( check[2] * args[check[0]] < check[1]) {
          continue
        }
        return false
      }
      return name === name2
    }
  }

  const checkers:stype.infiniteLoopChecker[] = [];
  for (const transitions of tset.values()) {
    for (const transition of transitions) {
      if(sameArgs(transition.caller,transition.callee)) {
        if(transition.condition && transition.condition.type !== 'SkipSymbol') {
          checkers.push(makeChecker(transition.caller, transition.condition))
        } else if (transition.condition === null) {
          const name = transition.caller.name
          checkers.push((name2: string, args: any[]): boolean => name===name2)
        }
      }
    }
  }
  return checkers
}

function getFirstCall(node: es.FunctionDeclaration): stype.FunctionSymbol {
  function doParam(param: es.Node) {
    if (param.type === 'Identifier') {
      return stype.makeNumberSymbol(param.name, 0);
    }
    return stype.unusedSymbol;
  }
  const id = node.id as es.Identifier;
  const args = node.params.map(doParam);
  return stype.makeFunctionSymbol(id.name, args);
}

export function toName(node: es.FunctionDeclaration, env: Environment) {
  const id = node.id as es.Identifier
  const firstCall = getFirstCall(node);
  const symTree = symbolicExecute(node.body, [new Map()], env)
  const transition = serialize(firstCall, symTree)
  const tset : Tset = new Map()
  tset.set(id.name, transition)

  const checkers1 = simpleCheck(tset)
  const checkers2 = checkBaseCase(tset)
  const checkers3 = checkStateChange(tset)

  return checkers1.concat(checkers2).concat(checkers3)
}

