import * as sym from './symbolic'
import { generate } from 'astring'
import * as es from 'estree'
import { identifier } from '../utils/astCreator'

// Object + functions called during runtime to check for infinite loops
type CachedExpression = [number, es.Expression]
type Path = number[]
type Transition = [string, any, number][]
type Iteration = {
  paths: Path
  transitions: Transition
}
type IterationsTracker = number[]

export class State {
  variablesModified: Map<string, sym.Hybrid>
  variablesToReset: Set<string>
  expressionCache: [Map<string, CachedExpression>, string[]]
  mixedStack: Iteration[]
  stackPointer: number
  loopStack: IterationsTracker[]
  functionTrackers: Map<string, IterationsTracker>
  functionNameStack: string[]
  threshold: number
  streamThreshold: number
  startTime: number
  timeout: number
  streamMode: boolean
  streamLastFunction: string | undefined
  streamCounts: Map<string, number>
  lastLocation: es.SourceLocation | undefined
  constructor(timeout = 4000, threshold = 20, streamThreshold = threshold * 2) {
    // arbitrary defaults
    this.variablesModified = new Map()
    this.variablesToReset = new Set()
    this.expressionCache = [new Map(), []]
    this.mixedStack = [{ paths: [], transitions: [] }]
    this.stackPointer = 0
    this.loopStack = []
    this.functionTrackers = new Map()
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

  /**
   * Returns the names and values of transitions at the given location
   * in the stack. Note that the values may be arrays containing hybrid
   * values (hence the maybe).
   */
  public getMaybeConc(at: number) {
    return this.mixedStack[at].transitions.map(x => [x[0], x[1]])
  }
  public exitLoop() {
    this.stackPointer = this.loopStack[0][0] - 1
    this.loopStack.shift()
  }

  /**
   * Takes in an expression and returns its cached representation.
   */
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
    const currentPath = this.mixedStack[this.stackPointer].paths
    if (!State.isInvalidPath(currentPath)) {
      const id = this.toCached(expr)
      currentPath.push(id)
    }
  }
  /**
   * Sets the current path as invalid.
   */
  public setInvalidPath() {
    this.mixedStack[this.stackPointer].paths = [-1]
  }
  public saveTransition(name: string, value: sym.Hybrid) {
    const concrete = value.concrete
    const id = this.toCached(value.symbolic)
    this.mixedStack[this.stackPointer].transitions.push([name, concrete, id])
  }
  /**
   * Creates a new stack frame.
   * @returns pointer to the new stack frame.
   */
  public newStackFrame() {
    this.mixedStack.push({ paths: [], transitions: [] })
    return ++this.stackPointer
  }
  public getCachedString(id: number) {
    return this.expressionCache[1][id]
  }
  public getCachedExprFromString(str: string) {
    const val = this.expressionCache[0].get(str)
    return (val as [number, es.Expression])[1]
  }
  /**
   * Saves variables that were modified to the current transition.
   * Also adds the variable to this.variablesToReset.
   */
  public cleanUpVariables() {
    for (const [name, value] of this.variablesModified) {
      this.saveTransition(name, value)
      this.variablesToReset.add(name)
    }
  }
  /**
   * Records entering a function in the state.
   * @param name name of the function.
   * @returns [tracker, firstIteration] where firstIteration is true if this is the functions first iteration.
   */
  public enterFunction(name: string): [IterationsTracker, boolean] {
    this.functionNameStack.push(name)
    let tracker = this.functionTrackers.get(name)
    let firstIteration = false
    if (tracker === undefined) {
      tracker = []
      this.functionTrackers.set(name, tracker)
      firstIteration = true
    }
    firstIteration = tracker.length > 0
    return [tracker, firstIteration]
  }

  /**
   * Records in the state that the last function has returned.
   */
  public returnLastFunction() {
    const lastFunction = this.functionNameStack.pop()
    const tracker = this.functionTrackers.get(lastFunction as string) as IterationsTracker
    const lastPosn = tracker.pop()
    if (lastPosn !== undefined) {
      this.stackPointer = lastPosn - 1
    }
  }

  public hasTimedOut() {
    return Date.now() - this.startTime > this.timeout
  }
  /**
   * @returns the name of the last function in the stack.
   */
  public getLastFunction() {
    return this.functionNameStack[this.functionNameStack.length - 1]
  }
  /**
   * Saves args into the last transition in the tracker.
   */
  public saveArgsInTransition(args: any[], tracker: IterationsTracker) {
    const transitions: Transition = []
    for (const [name, val] of args) {
      if (sym.isHybrid(val)) {
        transitions.push([name, val.concrete, this.toCached(val.symbolic)])
      } else {
        transitions.push([name, val, this.toCached(identifier('undefined'))])
      }
      this.variablesToReset.add(name)
    }
    const prevPointer = tracker[tracker.length - 1]
    if (prevPointer > -1) {
      this.mixedStack[prevPointer].transitions.push(...transitions)
    }
  }
}
