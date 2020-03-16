import * as es from 'estree'
import { InfiniteLoopData, Environment } from '../types'
import * as sym from './symbolicExecutor'
import * as errors from '../errors/errors'

function getVars(node: es.Node): string[] {
  // TODO handle more expr types?
  if (node.type === 'Identifier') {
    return [node.name]
  } else if (node.type === 'LogicalExpression' || node.type === 'BinaryExpression') {
    return getVars(node.left).concat(getVars(node.right))
  } else if (node.type === 'UnaryExpression') {
    return getVars(node.argument)
  } else if (node.type === 'ConditionalExpression') {
    return getVars(node.test).concat(getVars(node.consequent).concat(getVars(node.alternate)))
  }
  return []
}

function getRelevantVars(node: es.FunctionDeclaration) {
  // TODO handle var shadowing
  // If we want to include global variables, we will also have to change the return type and all functions using this
  type EdgeList = [string, string][]

  const body = node.body

  function hasReturnStatement(currentNode: es.Node) {
    // TODO
    return true
  }
  function scan(currentNode: es.Node): EdgeList {
    let edgeList: EdgeList = []
    if (currentNode.type === 'BlockStatement') {
      for (const nd of currentNode.body) {
        edgeList = edgeList.concat(scan(nd))
      }
    } else if (currentNode.type === 'IfStatement') {
      edgeList = scan(currentNode.consequent)
      let hasReturn: boolean = hasReturnStatement(currentNode.consequent)
      if (currentNode.alternate !== null && currentNode.alternate !== undefined) {
        edgeList.concat(scan(currentNode.alternate))
        hasReturn = hasReturn || hasReturnStatement(currentNode.alternate)
      }
      if (hasReturn) {
        for (const rhsName of getVars(currentNode.test)) {
          edgeList.push(['*', rhsName])
        }
      }
    } else if (currentNode.type === 'VariableDeclaration') {
      const declaration = currentNode.declarations[0]
      const id = declaration.id as es.Identifier
      const value = declaration.init as es.Expression
      for (const rhsName of getVars(value)) {
        edgeList.push([rhsName, id.name])
      }
    }
    return edgeList
  }
  const edges: EdgeList = scan(body)
  const adjList = new Map()

  for (const edge of edges) {
    const from = edge[0]
    const to = edge[1]
    if (adjList[from] === undefined) {
      adjList[from] = [to]
    } else {
      adjList[from] = adjList[from].concat(to)
    }
  }

  const dfsStack: string[] = ['*']
  const relVars: string[] = []
  while (dfsStack.length !== 0) {
    const visiting = dfsStack.pop()
    if (visiting !== undefined && adjList[visiting] !== undefined) {
      for (const toVisit of adjList[visiting]) {
        if (!relVars.includes(toVisit)) {
          relVars.push(toVisit)
          dfsStack.push(toVisit)
        }
      }
    }
  }

  const params = node.params.map((x: es.Identifier) => x.name)
  const relVarsIdx = []
  for (let i = 0; i < params.length; i++) {
    if (relVars.includes(params[i])) {
      relVarsIdx.push(i)
    }
  }
  return relVarsIdx
}

export function cycleDetection(states: string[]) {
  if (states.length < 1) return false
  let slow = 1
  let fast = 2
  while (states[fast] !== undefined && states[slow] !== states[fast]) {
    slow += 1
    fast += 2
  }
  return states[slow] === states[fast]
}

export function makeFunctionState(name: string, args: any[], relevantVars: number[]) {
  // TODO use a better representation, string equality is slow
  let state = name + '('
  for (const i of relevantVars) {
    state = state + args[i].value
  }
  return state + ')'
}

export function infiniteLoopStaticAnalysis(
  node: es.FunctionDeclaration,
  infiniteLoopDetection: InfiniteLoopData
) {
  const functionId = node.id as es.Identifier
  infiniteLoopDetection.relevantVars[functionId.name] = getRelevantVars(node)
  infiniteLoopDetection.checkers = sym.toName(node)
  // return context;
}

function getInfiniteLoopData(env: Environment, name: string) {
  // TODO rename
  let environment: Environment | null = env
  while (environment) {
    const relevantVars = environment.infiniteLoopDetection.relevantVars
    if (relevantVars[name]) {
      return relevantVars[name]
    } else {
      environment = environment.tail
    }
  }
  return undefined
}

export function testFunction(env: Environment, name: string, args: any[]) {
  // TODO rename
  let environment: Environment | null = env
  while (environment) {
    const checkers = environment.infiniteLoopDetection.checkers
    for (const checker of checkers) {
      // TODO fix this somehow
      if (checker(name, args)) {
        return true
      }
    }
    environment = environment.tail
  }
  return false
}

export function pushTailCallStack(environment: Environment, name: string, args: any[]) {
  const infiniteLoopDetection = environment.infiniteLoopDetection
  const relevantVars = getInfiniteLoopData(environment, name)
  const tailCallStack = infiniteLoopDetection.tailCallStack
  if (relevantVars) {
    tailCallStack.push(makeFunctionState(name, args, relevantVars))
  }
}

// TODO big refactoring
export function checkInfiniteLoop(node: es.CallExpression, args: any[], envs: Environment[]) {
  if (node.callee.type === 'Identifier') {
    const name = node.callee.name
    const relevantVars = getInfiniteLoopData(envs[0], name)
    if (relevantVars) {
      // temp: fix for functions that have not been analysed

      let states : string[] = envs[0].infiniteLoopDetection.tailCallStack
      if(states.length === 0) {
        const stacks: es.CallExpression[] = []
        for (const env of envs) {
          if (env.callExpression) {
            stacks.push(env.callExpression)
          }
        }
        states = stacks.map(x => makeFunctionState(name, x.arguments, relevantVars))
      }
      if (cycleDetection(states)) {
        return new errors.InfiniteLoopError1(node)
      } else {
        envs[0].infiniteLoopDetection.stackThreshold *= 2
      }
      if (testFunction(envs[0], name, args)) {
        return new errors.InfiniteLoopError2(node)
      }
    }
  }
  return undefined
}
