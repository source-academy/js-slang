import * as es from 'estree'
import { InfiniteLoopData, Environment } from '../types'
import { updateCheckers, testFunction } from './analyzer'
import { symbolicExecute, getFirstCall } from './symbolicExecutor'
import { serialize } from './serializer'
import * as errors from '../errors/errors'


export function infiniteLoopFunctionAnalysis(
  node: es.FunctionDeclaration,
  infiniteLoopDetection: InfiniteLoopData,
  env: Environment
) {
  const functionId = node.id as es.Identifier
  const symTree = symbolicExecute(node.body, [new Map()], env)
  const firstCall = getFirstCall(node)
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
