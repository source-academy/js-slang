import * as es from 'estree'
import { InfiniteLoopData, Environment } from '../types'
import { updateCheckers, testFunction } from './analyzer'
import { symbolicExecute, getFirstCall } from './symbolicExecutor'
import { serialize } from './serializer'
import * as errors from '../errors/errors'
import * as stype from './symTypes'


function makeStore(firstCall: stype.FunctionSymbol, env: Environment): Map<string, stype.SSymbol>[] {
  const store = [new Map()]

  let environment: Environment | null = env
  while (environment) {
    const frame = environment.head
    const descriptors = Object.getOwnPropertyDescriptors(frame)
    for (let v in frame) {
      if (frame.hasOwnProperty(v) && typeof frame[v] === 'number' && !descriptors[v].writable) {
        store[0].set(v, stype.makeNumberSymbol(v, frame[v]))
      }
    }
    environment = (environment as Environment).tail
  }

  for (let v of firstCall.args) {
    if(v.type === 'NumberSymbol') {
      store[0].set(v.name, v)
    }
  }
  return store
}

export function infiniteLoopFunctionAnalysis(
  node: es.FunctionDeclaration,
  infiniteLoopDetection: InfiniteLoopData,
  env: Environment
) {
  const functionId = node.id as es.Identifier
  const firstCall = getFirstCall(node)
  const store = makeStore(firstCall, env)
  const symTree = symbolicExecute(node.body, store)
  const transition = serialize(firstCall, symTree)
  const tset = infiniteLoopDetection.transitionSet
  tset.set(functionId.name, transition)
  infiniteLoopDetection.checkers = updateCheckers(tset)
}

export function checkInfiniteLoop(node: es.CallExpression, args: any[], envs: Environment[]) {
  let environment: Environment | null = envs[0]
  if (node.callee.type === 'Identifier') {
    const name = node.callee.name
    while (environment) {
      const checkers = environment.infiniteLoopDetection.checkers
      const errorMessage = testFunction(name, args, checkers)
      if (errorMessage) {
        return new errors.InfiniteLoopError(node, errorMessage)
      }
      environment = environment.tail
    }
  }
  return undefined
}
