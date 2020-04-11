import * as es from 'estree'
import { Context, Environment } from '../types'
import { updateCheckers, testFunction } from './analyzer'
import { getFirstCall, symbolicExecute } from './symbolicExecutor'
import { serialize } from './serializer'
import * as errors from '../errors/errors'
import * as stype from './symTypes'
import Closure from '../interpreter/closure'

function getallCalls(symList: stype.Transition[]) {
  function unique(list:any[]) {
    return list.reduce((acc, d) => acc.includes(d) ? acc : acc.concat(d), []);
  }
  const calls : string[] = []
  for (let x of symList) {
    if(x.callee.type === 'FunctionSymbol') {
      calls.push(x.callee.name)
    }
  }
  return unique(calls)
}

function getClosure(name: string, env:Environment) : Closure | undefined {
  let environment: Environment | null = env
  while (environment) {
    const frame = environment.head
    for (const v in frame) {
      if (frame.hasOwnProperty(v) && frame[v] instanceof Closure) {
        return frame[v]
      }
    }
    environment = (environment as Environment).tail
  }
  return undefined
}

function helperTset(tset: stype.TransitionSet, name: string, env: Environment) : stype.TransitionSet {
  if(!tset.has(name)) {
    const closure = getClosure(name, env)
    if (closure instanceof Closure && closure.node.type==='FunctionDeclaration') {
      const node = closure.node
      const firstCall = getFirstCall(node)
      const symTree = symbolicExecute(node, env)
      const transition = serialize(firstCall, symTree)
      const calls = getallCalls(transition)
      tset.set(name, transition)
      for (let call of calls) {
        tset = helperTset(tset, call, env)
      }
    }
  }
  return tset
}


export function checkInfiniteLoop(node: es.CallExpression, args: any[], context: Context) {
  const env = context.runtime.environments[0]
  let tset = new Map()
  if (node.callee.type === 'Identifier') {
    const name = node.callee.name
    tset = helperTset(tset, name, env)
    const checkers = updateCheckers(tset)
    
    const errorMessage = testFunction(name, args, checkers)
    if (errorMessage) {
      return new errors.InfiniteLoopError(node, errorMessage)
    }
  }
  return undefined
}