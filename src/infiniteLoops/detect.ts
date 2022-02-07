import { generate } from 'astring'
import * as es from 'estree'

import { simple } from '../utils/walkers'
import { InfiniteLoopError, InfiniteLoopErrorType } from './errors'
import { getOriginalName } from './instrument'
import * as st from './state'
import { shallowConcretize } from './symbolic'

const runAltErgo: any = require('@joeychenofficial/alt-ergo-modified')

const options = {
  answers_with_loc: false,
  input_format: 'Native',
  interpretation: 1,
  unsat_core: true,
  verbose: false,
  sat_solver: 'Tableaux',
  file: 'smt-file'
}

/**
 * Checks if the program is stuck in an infinite loop.
 * @throws InfiniteLoopError if so.
 * @returns void otherwise.
 */
export function checkForInfiniteLoop(
  stackPositions: number[],
  state: st.State,
  functionName: string | undefined
) {
  const report = (message: string, type: InfiniteLoopErrorType) => {
    throw new InfiniteLoopError(functionName, state.streamMode, message, type)
  }
  if (hasNoBaseCase(stackPositions, state)) {
    report('It has no base case.', InfiniteLoopErrorType.NoBaseCase)
  }
  // arbitrarily using same threshold

  let circular
  try {
    circular = checkForCycle(stackPositions.slice(stackPositions.length - state.threshold), state)
  } catch (e) {
    circular = undefined
  }
  if (circular) {
    let message
    if (circular[0] === circular[1] && circular[0] === '') {
      message = 'None of the variables are being updated.'
    } else {
      message = 'It has the infinite cycle: ' + circular.join(' -> ') + '.'
    }
    report(message, InfiniteLoopErrorType.Cycle)
  } else {
    const code = codeToDispatch(stackPositions, state)
    const pass = runUntilValid(code)
    if (pass) {
      const message = 'In particular, ' + pass
      report(message, InfiniteLoopErrorType.FromSmt)
    }
  }
}

/**
 * If no if statement/conditional was encountered between iterations, there is no base case.
 */
function hasNoBaseCase(stackPositions: number[], state: st.State) {
  const thePaths = state.mixedStack.slice(stackPositions[0], stackPositions[1]).map(x => x.paths)
  return flatten(thePaths).length === 0
}

/**
 * @returns if a cycle was detected, string array describing the cycle. Otherwise returns undefined.
 */
function checkForCycle(stackPositions: number[], state: st.State): string[] | undefined {
  const hasInvalidTransition = stackPositions.some(x =>
    st.State.isNonDetTransition(state.mixedStack[x].transitions)
  )
  if (hasInvalidTransition) {
    return undefined
  }
  const transitions = stackPositions.map(i => state.mixedStack[i].transitions)
  const concStr = []
  for (const item of transitions) {
    const innerStr = []
    for (const transition of item) {
      if (typeof transition.value === 'function') {
        return
      }
      innerStr.push(`(${getOriginalName(transition.name)}: ${stringifyCircular(transition.value)})`)
    }
    concStr.push(innerStr.join(', '))
  }
  return getCycle(concStr)
}

function getCycle(temp: any[]) {
  const last = temp[temp.length - 1]
  const ix1 = temp.lastIndexOf(last, -2)
  if (ix1 === -1) return undefined
  const period = temp.length - ix1 - 1
  const s1 = temp.slice(ix1 - period, ix1)
  const s2 = temp.slice(ix1, -1)
  if (s1.length != period) return undefined
  for (let i = 0; i < period; i++) {
    if (s1[i] != s2[i]) return undefined
  }
  return s1.concat(s1[0])
}

function stringifyCircular(x: any) {
  // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#examples
  const getCircularReplacer = () => {
    const seen = new WeakSet()
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '(CIRCULAR)'
        }
        seen.add(value)
      }
      return shallowConcretize(value)
    }
  }
  return JSON.stringify(x, getCircularReplacer())
}

function runUntilValid(items: [string, () => string][]) {
  for (const [code, message] of items) {
    const out = runSMT(code)
    if (out.includes('Valid')) return message()
  }
  return undefined
}

function runSMT(code: string): string {
  try {
    const input = { content: [code] }
    const out = JSON.parse(runAltErgo(input, options))
    return out.results[0]
  } catch (e) {
    return e.toString()
  }
}

type IterationFrame = {
  name: string
  prevPaths: number[]
  nextPaths: number[]
  transition: st.Transition[]
}

function flatten<T>(arr: T[][]): T[] {
  return [].concat(...(arr as any[]))
}

function arrEquals<T>(a1: T[], a2: T[], cmp = (x: T, y: T) => x === y) {
  if (a1.length !== a2.length) return false
  for (let i = 0; i < a1.length; i++) {
    if (!cmp(a1[i], a2[i])) return false
  }
  return true
}

function iterationFrameEquals(t1: IterationFrame, t2: IterationFrame) {
  return (
    arrEquals(t1.prevPaths, t2.prevPaths) &&
    arrEquals(t1.nextPaths, t2.nextPaths) &&
    arrEquals(
      t1.transition,
      t2.transition,
      (x, y) => x.name === y.name && x.cachedSymbolicValue === y.cachedSymbolicValue
    ) &&
    t1.name === t2.name
  )
}

function codeToDispatch(stackPositions: number[], state: st.State) {
  const firstSeen = getFirstSeen(stackPositions, state)
  const closedCycles = getClosed(firstSeen)
  const toCheckNested = closedCycles.map(([from, to]) =>
    toSmtSyntax(firstSeen.slice(from, to + 1), state)
  )
  return flatten(toCheckNested)
}

/**
 * Get iteration frames from the stackPositions, ignoring duplicates.
 * Preserves order in which the iterations frames are first seen in stackPositions.
 */
function getFirstSeen(stackPositions: number[], state: st.State) {
  let firstSeen: IterationFrame[] = []
  for (let i = 1; i < stackPositions.length - 1; i++) {
    const prev = stackPositions[i - 1]
    const current = stackPositions[i]
    const next = stackPositions[i + 1]
    const prevPaths = state.mixedStack.slice(prev, current).map(x => x.paths)
    const nextPaths = state.mixedStack.slice(current, next).map(x => x.paths)
    const transitions = state.mixedStack.slice(prev, current).map(x => x.transitions)
    const hasInvalidPath = prevPaths.concat(nextPaths).some(st.State.isInvalidPath)
    const hasInvalidTransition = transitions.some(st.State.isInvalidTransition)
    if (hasInvalidPath || hasInvalidTransition) {
      // if any path or transition is invalid
      firstSeen = []
      continue
    }
    const frame: IterationFrame = {
      name: state.mixedStack[current].loc,
      prevPaths: flatten(prevPaths),
      nextPaths: flatten(nextPaths),
      transition: flatten(transitions)
    }
    let wasSeen = false
    for (const seen of firstSeen) {
      if (iterationFrameEquals(frame, seen)) {
        wasSeen = true
        break
      }
    }
    if (!wasSeen) {
      firstSeen.push(frame)
    }
  }
  return firstSeen
}

/**
 * Get closed sets of Iteration Frames where each iteration will
 * transition into another in the set.
 */
function getClosed(firstSeen: IterationFrame[]) {
  const indices: [number, number][] = []
  for (let i = 0; i < firstSeen.length; i++) {
    for (let j = 0; j <= i; j++) {
      if (arrEquals(firstSeen[i].nextPaths, firstSeen[j].prevPaths)) {
        // closed
        indices.push([j, i])
      }
    }
  }
  return indices
}

function joiner(content: string[][]) {
  const inner = (x: string[]) => `(${x.join(' and ')})`
  return content.map(inner).join(' or ')
}

function getIds(nodes: es.Expression[][]) {
  const result: es.Identifier[] = []
  for (const node of flatten(nodes)) {
    simple(node, {
      Identifier(node: es.Identifier) {
        result.push(node)
      }
    })
  }
  return [...new Set(result)]
}

function formatTransitionForMessage(transition: st.Transition, state: st.State) {
  // this will be run after ids are reverted to their original names
  const symbolic = state.idToStringCache[transition.cachedSymbolicValue]
  if (symbolic === 'undefined') {
    // set as a constant
    return `${getOriginalName(transition.name)}' = ${transition.value}`
  } else {
    const originalExpr = generate(state.idToExprCache[transition.cachedSymbolicValue])
    return `${getOriginalName(transition.name)}' = ${originalExpr}`
  }
}

/**
 * Creates a default error message using the pathExprs and transitions.
 * May destructively modify the transitions.
 */
function errorMessageMaker(
  ids: es.Identifier[],
  pathExprs: es.Expression[][],
  transitions: st.Transition[][],
  state: st.State
) {
  return () => {
    const idsOfTransitions = getIds(
      transitions.map(x => x.map(t => state.idToExprCache[t.cachedSymbolicValue]))
    )
    ids = ids.concat(idsOfTransitions)
    ids.map(x => (x.name = getOriginalName(x.name)))
    const pathPart: string[][] = pathExprs.map(x => x.map(generate))
    const transitionPart = transitions.map(x => x.map(t => formatTransitionForMessage(t, state)))
    let result = ''
    for (let i = 0; i < transitionPart.length; i++) {
      if (i > 0) result += ' And in a subsequent iteration, '
      result += `when (${pathPart[i].join(' and ')}), `
      result += `the variables are updated (${transitionPart[i].join(', ')}).`
    }
    return result
  }
}

function smtTemplate(mode: string, decls: string, line1: string, line2: string, line3: string) {
  const str = `goal g_1:
    forall ${decls}:${mode}.
        ${line1} ->
        ${line2} ->
        ${line3}`
  return str.replace(/===/g, '=')
}

function formatTransition(transition: st.Transition, state: st.State) {
  const symbolic = state.idToStringCache[transition.cachedSymbolicValue]
  if (symbolic === 'undefined') {
    // set as a constant
    return `${transition.name}' = ${transition.value}`
  } else {
    return `${transition.name}' = ${symbolic}`
  }
}

/**
 * Substitutes path and transition expressions into a template to be executed
 * by the SMT solver.
 * @returns list of templated code.
 */
function toSmtSyntax(toInclude: IterationFrame[], state: st.State): [string, () => string][] {
  const pathStr = toInclude.map(x => x.prevPaths.map(i => state.idToStringCache[i]))
  const line1 = joiner(pathStr)
  const pathExprs = toInclude.map(x => x.prevPaths.map(i => state.idToExprCache[i]))
  const ids = getIds(pathExprs)
  // primify
  ids.map(x => (x.name = x.name + "'"))
  const line3 = joiner(pathExprs.map(x => x.map(generate)))
  // unprimify
  ids.map(x => (x.name = x.name.slice(0, -1)))

  const transitions = toInclude.map(x => x.transition.filter(t => typeof t.value === 'number'))
  const line2 = joiner(transitions.map(x => x.map(t => formatTransition(t, state))))
  const allNames = flatten(transitions.map(x => x.map(y => y.name))).concat(ids.map(x => x.name))
  const decls = [...new Set(allNames)].map(x => `${x},${x}'`).join(',')
  const [newLine1, newLine3] = addConstantsAndSigns(line1, line3, transitions, state)
  const message = errorMessageMaker(ids, pathExprs, transitions, state)
  const template1: [string, () => string] = [
    smtTemplate('int', decls, line1, line2, line3),
    message
  ]
  const template2: [string, () => string] = [
    smtTemplate('int', decls, newLine1, line2, newLine3),
    message
  ]
  return [template1, template2]
}

/**
 * Using information from transitions, add information on constants
 * and signs of variables into a new template for lines 1 and 3.
 * @returns line 1 and line 3
 */
function addConstantsAndSigns(
  line1: string,
  line3: string,
  transitions: st.Transition[][],
  state: st.State
) {
  type TransitionVariable = {
    isConstant: boolean
    value: number
  }
  const values = new Map<string, TransitionVariable[]>()
  for (const transition of flatten(transitions)) {
    let item = values.get(transition.name)
    const symbolicValue = state.idToStringCache[transition.cachedSymbolicValue]
    if (item === undefined) {
      item = []
      values.set(transition.name, item)
    }
    // if var is constant, then transition will be (name)=(name), e.g. "c=c"
    item.push({ isConstant: transition.name === symbolicValue, value: transition.value })
  }
  const consts = []
  const signs1 = []
  const signs3 = []
  for (const [name, item] of values.entries()) {
    if (item.every(x => x.isConstant)) {
      consts.push(`${name} = ${item[0].value}`)
    } else if (item.every(x => x.value > 0)) {
      signs1.push(`${name} > 0`)
      signs3.push(`${name}' > 0`)
    } else if (item.every(x => x.value < 0)) {
      signs1.push(`${name} < 0`)
      signs3.push(`${name}' > 0`)
    }
  }
  const innerJoiner = (x: string[]) => `(${x.join(' and ')})`
  let newLine1 = line1
  let newLine3 = line3
  if (signs1.length > 0) {
    newLine1 = `${line1} and ${innerJoiner(signs1)}`
    newLine3 = `${line3} and ${innerJoiner(signs3)}`
  }
  if (consts.length > 0) newLine1 = `${innerJoiner(consts)} -> ${newLine1}`
  return [newLine1, newLine3]
}
