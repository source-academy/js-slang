import * as es from 'estree'
import { InfiniteLoopData, Environment } from '../types'
import { updateCheckers, testFunction } from './analyzer'
import { getFirstCall, symbolicExecute } from './symbolicExecutor'
import { serialize } from './serializer'
import * as errors from '../errors/errors'

export function infiniteLoopFunctionAnalysis(
  node: es.FunctionDeclaration,
  infiniteLoopDetection: InfiniteLoopData,
  env: Environment
) {
  const functionId = node.id as es.Identifier
  const firstCall = getFirstCall(node)
  const symTree = symbolicExecute(node, env)
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
      const tSet = environment.infiniteLoopDetection.transitionSet
      if (errorMessage) {
        return new errors.InfiniteLoopError(node, errorMessage)
      }
      if (tSet.has(name)) {
        break
      } else {
        environment = environment.tail
      }
    }
  }
  return undefined
}
