import { generate } from 'astring'
import * as es from 'estree'

import { identifier } from '../utils/astCreator'
import * as sym from './symbolic'

// Object + functions called during runtime to check for infinite loops

type Path = number[]
export type Transition = {
  name: string
  value: any
  cachedSymbolicValue: number
}
const makeTransition = (name: string, value: any, id: number) =>
  ({ name: name, value: value, cachedSymbolicValue: id } as Transition)
type FunctionStackFrame = {
  name: string
  transitions: Transition[]
}
const makeFunctionStackFrame = (name: string, transitions: Transition[]) =>
  ({ name: name, transitions: transitions } as FunctionStackFrame)
type Iteration = {
  loc: string
  paths: Path
  transitions: Transition[]
}
type IterationsTracker = number[]
const noSmtTransitionId = -1
const nonDetTransitionId = -2

export class State {
  variablesModified: Map<string, sym.Hybrid>
  variablesToReset: Set<string>
  stringToIdCache: Map<string, number>
  idToStringCache: string[]
  idToExprCache: es.Expression[]
  mixedStack: Iteration[]
  stackPointer: number
  loopStack: IterationsTracker[]
  functionTrackers: Map<string, IterationsTracker>
  functionStack: FunctionStackFrame[]
  threshold: number
  streamThreshold: number
  startTime: number
  timeout: number
  streamMode: boolean
  streamLastFunction: string | undefined
  streamCounts: Map<string, number>
  lastLocation: es.SourceLocation | undefined
  functionWasPassedAsArgument: boolean
  constructor(timeout = 4000, threshold = 20, streamThreshold = threshold * 2) {
    // arbitrary defaults
    this.variablesModified = new Map()
    this.variablesToReset = new Set()
    this.stringToIdCache = new Map()
    this.idToStringCache = []
    this.idToExprCache = []
    this.mixedStack = [{ loc: '(ROOT)', paths: [], transitions: [] }]
    this.stackPointer = 0
    this.loopStack = []
    this.functionTrackers = new Map()
    this.functionStack = []
    this.threshold = threshold
    this.streamThreshold = streamThreshold
    this.startTime = Date.now()
    this.timeout = timeout
    this.streamMode = false
    this.streamLastFunction = undefined
    this.streamCounts = new Map()
    this.functionWasPassedAsArgument = false
  }
  static isInvalidPath(path: Path) {
    return path.length === 1 && path[0] === -1
  }
  static isNonDetTransition(transition: Transition[]) {
    return transition.some(x => x.cachedSymbolicValue === nonDetTransitionId)
  }
  static isInvalidTransition(transition: Transition[]) {
    return (
      State.isNonDetTransition(transition) ||
      transition.some(x => x.cachedSymbolicValue === noSmtTransitionId)
    )
  }
  /**
   * Takes in an expression and returns its cached representation.
   */
  public toCached(expr: es.Expression) {
    const asString = generate(expr)
    const item = this.stringToIdCache.get(asString)
    if (item === undefined) {
      const id = this.stringToIdCache.size
      this.stringToIdCache.set(asString, id)
      this.idToExprCache[id] = expr
      this.idToStringCache[id] = asString
      return id
    } else {
      return item
    }
  }
  public popStackToStackPointer() {
    if (this.mixedStack.length !== this.stackPointer) {
      this.mixedStack = this.mixedStack.slice(0, this.stackPointer + 1)
    }
  }
  public exitLoop() {
    const tracker = this.loopStack[0]
    const lastPosn = tracker.pop()
    if (lastPosn !== undefined) {
      this.stackPointer = lastPosn - 1
    }
    this.loopStack.shift()
    this.popStackToStackPointer()
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
    let id
    if (value.validity === sym.Validity.Valid) {
      id = this.toCached(value.symbolic)
    } else if (value.validity === sym.Validity.NoSmt) {
      id = noSmtTransitionId
    } else {
      id = nonDetTransitionId
    }
    const transitions = this.mixedStack[this.stackPointer].transitions
    for (let i = 0; i < transitions.length; i++) {
      const transition = transitions[i]
      if (transition[0] === name) {
        transition[1] = concrete
        transition[2] = id
        return
      }
    }
    // no entry with the same name
    transitions.push(makeTransition(name, concrete, id))
  }
  /**
   * Creates a new stack frame.
   * @returns pointer to the new stack frame.
   */
  public newStackFrame(loc: string) {
    this.stackPointer++
    this.mixedStack.push({ loc: loc, paths: [], transitions: [] })
    return this.stackPointer
  }
  /**
   * Saves variables that were modified to the current transition.
   * Also adds the variable to this.variablesToReset. These variables
   * will be lazily reset (concretized and re-hybridized) in runtime.hybridize.
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
    const transitions = this.mixedStack[this.stackPointer].transitions
    this.functionStack.push(makeFunctionStackFrame(name, transitions))
    let tracker = this.functionTrackers.get(name)
    let firstIteration = false
    if (tracker === undefined) {
      tracker = []
      this.functionTrackers.set(name, tracker)
      firstIteration = true
    }
    firstIteration = tracker.length === 0
    return [tracker, firstIteration]
  }

  /**
   * Saves args into the last iteration's transition in the tracker.
   */
  public saveArgsInTransition(args: any[], tracker: IterationsTracker) {
    const transitions: Transition[] = []
    for (const [name, val] of args) {
      if (sym.isHybrid(val)) {
        if (val.validity === sym.Validity.Valid) {
          transitions.push(makeTransition(name, val.concrete, this.toCached(val.symbolic)))
        } else if (val.validity === sym.Validity.NoSmt) {
          transitions.push(makeTransition(name, val.concrete, noSmtTransitionId))
        } else {
          transitions.push(makeTransition(name, val.concrete, nonDetTransitionId))
        }
      } else {
        transitions.push(makeTransition(name, val, this.toCached(identifier('undefined'))))
      }
      this.variablesToReset.add(name)
    }
    const prevPointer = tracker[tracker.length - 1]
    if (prevPointer > -1) {
      this.mixedStack[prevPointer].transitions.push(...transitions)
    }
  }

  /**
   * Records in the state that the last function has returned.
   */
  public returnLastFunction() {
    const lastFunctionFrame = this.functionStack.pop() as FunctionStackFrame
    const tracker = this.functionTrackers.get(lastFunctionFrame.name) as IterationsTracker
    const lastPosn = tracker.pop()
    if (lastPosn !== undefined) {
      this.stackPointer = lastPosn - 1
    }
    this.popStackToStackPointer()
    this.mixedStack[this.stackPointer].transitions = lastFunctionFrame.transitions
    this.setInvalidPath()
  }

  public hasTimedOut() {
    return Date.now() - this.startTime > this.timeout
  }
  /**
   * @returns the name of the last function in the stack.
   */
  public getLastFunctionName() {
    return this.functionStack[this.functionStack.length - 1][0]
  }
}
