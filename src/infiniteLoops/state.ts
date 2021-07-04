import * as sym from './symbolic'
import { generate } from 'astring'
import * as es from 'estree'

// Object + functions called during runtime to check for infinite loops
type CacheId = number
type CachedExpression = [CacheId, es.Expression]
type Path = CacheId[]
export type Transition = [string, any, CacheId][]
type Iteration = [Path, Transition]
export type IterationsInfo = [number, number[]] // TODO rename this

export class State {
  variablesModified: Map<string, sym.Hybrid>
  variablesToReset: Set<string>
  expressionCache: [Map<string, CachedExpression>, string[]]
  mixedStack: Iteration[] // TODO: add a skip or sth
  stackPointer: number
  // Position, pointer to prev, pointer to each iteration of loop
  loopStack: IterationsInfo[]
  functionInfo: Map<string, IterationsInfo>
  functionNameStack: string[]
  threshold: number
  streamThreshold: number
  startTime: number
  timeout: number
  streamMode: boolean
  streamLastFunction: string | undefined
  streamCounts: Map<string, number>
  constructor(timeout = 4000, threshold = 20, streamThreshold = threshold * 2) {
    // arbitrary defaults
    this.variablesModified = new Map()
    this.variablesToReset = new Set()
    this.expressionCache = [new Map(), []]
    this.mixedStack = [[[], []]]
    this.stackPointer = 0
    this.loopStack = []
    this.functionInfo = new Map()
    this.functionNameStack = []
    this.threshold = threshold
    this.streamThreshold = streamThreshold
    this.startTime = Date.now()
    this.timeout = timeout
    this.streamMode = false
    this.streamLastFunction = undefined
    this.streamCounts = new Map()
  }
  static isInvalidPath(path: Path) {
    return path.length === 1 && path[0] === -1
  }

  public getMaybeConc(at: number) {
    return this.mixedStack[at][1].map(x => [x[0], x[1]])
  }
  public exitLoop() {
    this.stackPointer = this.loopStack[0][1][0] - 1
    this.loopStack.shift()
  }
  public toCached(expr: es.Expression) {
    const asString = generate(expr)
    const [forward, backward] = this.expressionCache
    const item = forward.get(asString)
    if (item === undefined) {
      const id = forward.size
      forward.set(asString, [id, expr])
      backward[id] = asString
      return id
    } else {
      return item[0]
    }
  }
  public savePath(expr: es.Expression) {
    const currentPath = this.mixedStack[this.stackPointer][0]
    if (!State.isInvalidPath(currentPath)) {
      const id = this.toCached(expr)
      currentPath.push(id)
    }
  }
  public setInvalidPath() {
    this.mixedStack[this.stackPointer][0] = [-1]
  }
  public saveTransition(name: string, value: sym.Hybrid) {
    const concrete = value.concrete
    const id = this.toCached(value.symbolic)
    this.mixedStack[this.stackPointer][1].push([name, concrete, id])
  }
  public newStackFrame() {
    // put skipframes here. if current frame = frame behind it, change the behind one to skip (for resuming later)
    this.mixedStack.push([[], []])
    return ++this.stackPointer
  }
  public getCachedString(id: number) {
    return this.expressionCache[1][id]
  }
  public getCachedExprFromString(str: string) {
    const val = this.expressionCache[0].get(str)
    return (val as [number, es.Expression])[1]
  }
  public cleanUpVariables() {
    for (const [name, value] of this.variablesModified) {
      this.saveTransition(name, value)
      this.variablesToReset.add(name)
    }
  }
  public returnLastFunction() {
    const lastFunction = this.functionNameStack.pop()
    const info = this.functionInfo.get(lastFunction as string) as IterationsInfo
    const lastPosn = info[1].pop()
    if (lastPosn !== undefined) {
      this.stackPointer = lastPosn - 1
    }
  }
  public hasTimedOut() {
    return Date.now() - this.startTime > this.timeout
  }
}
