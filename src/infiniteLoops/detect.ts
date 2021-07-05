import { getOriginalName } from './instrument'
import { generate } from 'astring'
import * as st from './state'
import { simple } from '../utils/walkers'
import * as es from 'estree'
import { RuntimeSourceError } from '../errors/runtimeSourceError'

const runAltErgo: any = require('alt-ergo-modified')

const options = JSON.stringify({
  answers_with_loc: false,
  input_format: 'Native',
  interpretation: 1,
  unsat_core: true,
  verbose: false,
  sat_solver: 'Tableaux',
  file: 'smt-file'
})

enum InfiniteLoopErrorType {
  NoBaseCase,
  Cycle,
  FromSmt
}

export class InfiniteLoopReportingError extends RuntimeSourceError {
  public infiniteLoopType: InfiniteLoopErrorType
  public message: string
  public functionName: string | undefined
  public streamMode: boolean
  constructor(
    functionName: string | undefined,
    streamMode: boolean,
    message: string,
    infiniteLoopType: InfiniteLoopErrorType
  ) {
    super()
    this.message = message
    this.infiniteLoopType = infiniteLoopType
    this.functionName = functionName
    this.streamMode = streamMode
  }
  public explain() {
    const entityName = this.functionName ? `function ${getOriginalName(this.functionName)}` : 'loop'
    const header = this.streamMode
      ? `Forcing an infinite stream: ${entityName}.`
      : `The ${entityName} at has encountered an infinite loop.`
    return header + ' ' + this.message
  }
}

export function checkForInfinite(
  stackPositions: number[],
  state: st.State,
  functionName: string | undefined
) {
  const report = (message: string, type: InfiniteLoopErrorType) => {
    throw new InfiniteLoopReportingError(functionName, state.streamMode, message, type)
  }
  if (state.mixedStack[stackPositions[0]].paths.length === 0) {
    report('It has no base case', InfiniteLoopErrorType.NoBaseCase)
  }
  // arbitrarily using same threshold
  let circular
  try {
    circular = checkForCycle(stackPositions.slice(stackPositions.length - state.threshold), state)
  } catch (e) {
    circular = false
  }
  if (circular) {
    const message = 'It has the infinite cycle: ' + circular
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

function runUntilValid(items: [string, () => string][]) {
  for (const [code, message] of items) {
    const out = runSMT(code)
    if (out.includes('Valid')) return message()
  }
  return undefined
}

function runSMT(code: string): string {
  try {
    const input = JSON.stringify({ content: [code] })
    const out = JSON.parse(runAltErgo(input, options))
    return out.results[0]
  } catch (e) {
    return e.toString()
  }
}

type Triple = [number[], number[], [string, any, number][]]

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

function tripleEquals(t1: Triple, t2: Triple) {
  return (
    arrEquals(t1[0], t2[0]) &&
    arrEquals(t1[1], t2[1]) &&
    arrEquals(t1[2], t2[2], (x, y) => x[0] === y[0] && x[2] === y[2])
  )
}

function codeToDispatch(stackPositions: number[], state: st.State) {
  const firstSeen = getFirstSeen(stackPositions, state)
  const withoutInvalids = removeInvalid(firstSeen)
  const closedCycles = getClosed(withoutInvalids)
  const toCheckNested = closedCycles.map(([from, to]) =>
    toSmtSyntax(firstSeen.slice(from, to + 1), state)
  )
  return flatten(toCheckNested)
}

function getFirstSeen(stackPositions: number[], state: st.State) {
  const firstSeen: Triple[] = []
  let prev = state.mixedStack[stackPositions[0]]
  for (const pos of stackPositions.slice(1)) {
    const next = state.mixedStack[pos]
    const triple: Triple = [prev.paths, next.paths, prev.transitions]
    prev = next
    let wasSeen = false
    for (const seen of firstSeen) {
      if (tripleEquals(triple, seen)) {
        wasSeen = true
        break
      }
    }
    if (!wasSeen) {
      firstSeen.push(triple)
    }
  }
  return firstSeen
}

function removeInvalid(firstSeen: Triple[]) {
  let cutFrom = 0
  for (let i = firstSeen.length - 1; i >= 0; i--) {
    if (st.State.isInvalidPath(firstSeen[i][0]) || st.State.isInvalidPath(firstSeen[i][1])) {
      cutFrom = i + 1
      break
    }
  }
  return firstSeen.slice(cutFrom)
}

function getClosed(firstSeen: Triple[]) {
  const indices: [number, number][] = []
  for (let i = 0; i < firstSeen.length; i++) {
    for (let j = 0; j <= i; j++) {
      if (arrEquals(firstSeen[i][1], firstSeen[j][0])) {
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

function getConstantsAndSigns(
  line1: string,
  line3: string,
  transitions: [string, number, string][][]
) {
  const values = new Map<string, [boolean, number][]>()
  for (const [name, val, next] of flatten(transitions)) {
    let item = values.get(name)
    if (item === undefined) {
      item = []
      values.set(name, item)
    }
    item.push([name === next, val])
  }
  const consts = []
  const signs1 = []
  const signs3 = []
  for (const [name, item] of values.entries()) {
    if (item.every(x => x[0])) {
      consts.push(`${name} = ${item[0][1]}`)
    } else if (item.every(x => x[1] > 0)) {
      signs1.push(`${name} > 0`)
      signs3.push(`${name}' > 0`)
    } else if (item.every(x => x[1] < 0)) {
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
  if (consts.length > 0) newLine1 = `${innerJoiner(consts)} -> ${line1}`
  return [newLine1, newLine3]
}

function smtTemplate(mode: string, decls: string, line1: string, line2: string, line3: string) {
  const str = `goal g_1:
    forall ${decls}:${mode}.
        ${line1} ->
        ${line2} ->
        ${line3}`
  return str.replace(/===/g, '=')
}

function errorMessageMaker(
  ids: es.Identifier[],
  pathExprs: es.Expression[][],
  transitions: [string, number, string][][],
  state: st.State
) {
  const getOriginalExpr = (s: string) => generate(state.getCachedExprFromString(s))
  return () => {
    const idsOfTransitions = getIds(
      transitions.map(x => x.map(y => state.getCachedExprFromString(y[2])))
    )
    ids = ids.concat(idsOfTransitions)
    ids.map(x => (x.name = getOriginalName(x.name)))
    const pathPart: string[][] = pathExprs.map(x => x.map(generate))
    const transitionPart = transitions.map(x =>
      x.map(([n, v, s]) =>
        s === 'undefined'
          ? `${getOriginalName(n)} <- ${v}`
          : `${getOriginalName(n)} <- ${getOriginalExpr(s)}`
      )
    )
    let result = ''
    for (let i = 0; i < transitionPart.length; i++) {
      if (i > 0) result += ' And in a subsequent iteration, '
      result += `when (${pathPart[i].join(' and ')}), the variables are updated (${transitionPart[
        i
      ].join(', ')}).`
    }
    return result
  }
}

function toSmtSyntax(toInclude: Triple[], state: st.State): [string, () => string][] {
  const pathStr = toInclude.map(x => x[0].map(i => state.getCachedString(i)))
  const line1 = joiner(pathStr)
  const pathExprs = pathStr.map(x => x.map(str => state.getCachedExprFromString(str)))
  const ids = getIds(pathExprs)
  // primify
  ids.map(x => (x.name = x.name + "'"))
  const line3 = joiner(pathExprs.map(x => x.map(generate)))
  // unprimify
  ids.map(x => (x.name = x.name.slice(0, -1)))

  const transitions = toInclude
    .map(x => x[2].map(([n, v, ix]) => [n, v, state.getCachedString(ix)]))
    .map(x => x.filter(y => typeof y[1] === 'number') as [string, number, string][])
  const line2 = joiner(
    transitions.map(x =>
      x.map(([n, v, s]) => (s === 'undefined' ? `${n}' = ${v}` : `${n}' = ${s}`))
    )
  )
  const allNames = flatten(transitions.map(x => x.map(y => y[0]))).concat(ids.map(x => x.name))
  const decls = [...new Set(allNames)].map(x => `${x},${x}'`).join(',')
  const [newLine1, newLine3] = getConstantsAndSigns(line1, line2, transitions)
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

function checkForCycle(stackPositions: number[], state: st.State) {
  // maybeConc because arrays may still contain hybrid stuff
  const maybeConc = stackPositions.map(i => state.getMaybeConc(i))
  const concStr = []
  for (const item of maybeConc) {
    const innerStr = []
    for (const [name, val] of item) {
      if (typeof val === 'function') {
        return
      }
      innerStr.push(`(${getOriginalName(name)}: ${stringifyCircular(val)})`)
    }
    concStr.push(innerStr.join(', '))
  }
  return getCycle(concStr)?.join(' -> ')
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
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#examples
  const getCircularReplacer = () => {
    const seen = new WeakSet()
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '(CIRCULAR)'
        }
        seen.add(value)
      }
      return value
    }
  }

  return JSON.stringify(x, getCircularReplacer())
}
