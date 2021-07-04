import * as sym from './symbolic'
import * as create from '../utils/astCreator'
import * as st from './state'
import * as es from 'estree'
import * as stdList from '../stdlib/list'
import { checkForInfinite, InfiniteLoopReportingError } from './detect'
import { instrument } from './instrument'
import { parse } from '../parser/parser'
import { createContext } from '../index'

function checkTimeout(state: st.State) {
  if (state.hasTimedOut()) {
    InfiniteLoopReportingError.timeout()
  }
}

function hybridize(name: string, originalValue: any, state: st.State) {
  if (typeof originalValue === 'function') {
    return originalValue
  }
  let value = originalValue
  if (state.variablesToReset.has(name)) {
    value = sym.deepConcretizeInplace(value)
  }
  return sym.hybridizeNamed(name, value)
}

function saveVarIfHybrid(name: string, value: any, state: st.State) {
  state.variablesToReset.delete(name)
  if (sym.isHybrid(value)) {
    state.variablesModified.set(name, value)
  }
  return value
}

function saveBoolIfHybrid(value: any, state: st.State) {
  if (sym.isHybrid(value) && value.type === 'value') {
    if (value.invalid) {
      state.setInvalidPath()
      return sym.shallowConcretize(value)
    }
    let theExpr = value.symbolic
    if (!value.concrete) {
      theExpr = value.negation ? value.negation : create.unaryExpression('!', theExpr)
    }
    state.savePath(theExpr)
    return sym.shallowConcretize(value)
  } else {
    state.setInvalidPath()
    return value
  }
}

function cachedUndefined(state: st.State) {
  return state.toCached(create.identifier('undefined'))
}

function preFunction(name: string, line: number, args: [string, any][], state: st.State) {
  // TODO: big cleanup, 'hide' st.Transition in some function there
  // feature not bug: don't put line numbers for calls so student has to trace the code themselves
  checkTimeout(state)
  state.functionNameStack.push(name)
  let info = state.functionInfo.get(name)
  if (info === undefined) {
    info = [line, []]
    state.functionInfo.set(name, info)
  } else {
    state.cleanUpVariables()
    const transitions: st.Transition = []
    for (const [name, val] of args) {
      if (sym.isHybrid(val)) {
        transitions.push([name, val.concrete, state.toCached(val.symbolic)])
      } else {
        transitions.push([name, val, cachedUndefined(state)])
      }
      state.variablesToReset.add(name)
    }
    const prevPointer = info[1][info[1].length - 1]
    if (prevPointer > -1) {
      state.mixedStack[prevPointer][1].push(...transitions)
      dispatchIfMeetsThreshold(info[1].slice(0, info[1].length - 1), state, info, name)
    }
  }
  info[1].push(state.newStackFrame())
}

function returnFunction(value: any, state: st.State) {
  state.cleanUpVariables()
  if (!state.streamMode) state.returnLastFunction()
  return value
}

function enterLoop(line: number, state: st.State) {
  state.loopStack.unshift([line, [state.newStackFrame()]])
}

function postLoop(state: st.State, ignoreMe?: any) {
  // ignoreMe: hack to squeeze this inside the 'update' of for statements
  checkTimeout(state)
  const stackPositions = state.loopStack[0][1]
  dispatchIfMeetsThreshold(stackPositions.slice(1), state, state.loopStack[0])
  state.cleanUpVariables()
  stackPositions.push(state.newStackFrame())
  return ignoreMe
}

function exitLoop(state: st.State) {
  state.cleanUpVariables()
  state.exitLoop()
}

function dispatchIfMeetsThreshold(
  stackPositions: number[],
  state: st.State,
  info: st.IterationsInfo,
  functionName?: string
) {
  let checkpoint = state.threshold
  while (checkpoint <= stackPositions.length) {
    if (stackPositions.length === checkpoint) {
      checkForInfinite(stackPositions, state, info, functionName)
    }
    checkpoint = checkpoint * 2
  }
}

const builtinSpecialCases = {
  is_null(maybeHybrid: any, state?: st.State) {
    const xs = sym.shallowConcretize(maybeHybrid)
    const conc = stdList.is_null(xs)
    const theTail = stdList.is_pair(xs) ? xs[1] : undefined
    const isStream = typeof theTail === 'function'
    if (state && isStream) {
      const lastFunction = state.functionNameStack[state.functionNameStack.length - 1]
      if (state.streamMode === true && state.streamLastFunction === lastFunction) {
        let next = theTail()
        for (let i = 0; i < state.threshold; i++) {
          if (stdList.is_null(next)) {
            break
          } else {
            const nextTail = stdList.is_pair(next) ? next[1] : undefined
            next = nextTail()
          }
        }
        return InfiniteLoopReportingError.timeout()
      } else {
        let count = state.streamCounts.get(lastFunction)
        if (count === undefined) {
          count = 1
        }
        if (count > state.streamThreshold) {
          state.streamMode = true
          state.streamLastFunction = lastFunction
        }
        state.streamCounts.set(lastFunction, count + 1)
      }
    } else {
      return conc
    }
  },
  display: nothingFunction
}

function prepareBuiltins(oldBuiltins: Map<string, any>) {
  const newBuiltins = new Map<string, any>()
  for (const [name, fun] of oldBuiltins) {
    const specialCase = builtinSpecialCases[name]
    if (specialCase !== undefined) {
      newBuiltins.set(name, specialCase)
    } else {
      newBuiltins.set(name, (...args: any[]) => fun(...args.map(sym.shallowConcretize)))
    }
  }
  return newBuiltins
}

function nothingFunction(...args: any[]) {
  return nothingFunction
}

const functions = {
  nothingFunction: nothingFunction,
  hybridize: hybridize,
  saveBool: saveBoolIfHybrid,
  saveVar: saveVarIfHybrid,
  preFunction: preFunction,
  returnFunction: returnFunction,
  postLoop: postLoop,
  enterLoop: enterLoop,
  exitLoop: exitLoop,
  evalB: sym.evaluateHybridBinary,
  evalU: sym.evaluateHybridUnary
}

export function testForInfiniteLoop(code: string, previousCodeStack: string[]) {
  const startTime = Date.now()
  const context = createContext(4, 'default', undefined, undefined)
  const prelude = parse(context.prelude as string, context) as es.Program
  const previous: es.Program[] = []
  context.prelude = null
  for (const code of previousCodeStack) {
    const ast = parse(code, context)
    if (ast !== undefined) previous.push(ast)
  }
  previous.push(prelude)
  const program = parse(code, context)
  if (program === undefined) return
  const newBuiltins = prepareBuiltins(context.nativeStorage.builtins)
  const [instrumentedCode, functionsId, stateId, builtinsId] = instrument(
    previous,
    program,
    newBuiltins.keys()
  )

  const state = new st.State()

  const sandboxedRun = new Function(
    'code',
    functionsId,
    stateId,
    builtinsId,
    `
        return eval(code)
        `
  )

  try {
    sandboxedRun(instrumentedCode, functions, state, newBuiltins)
  } catch (e) {
    console.log(e)
    if (e instanceof InfiniteLoopReportingError) {
      return [e.message, e.type, Date.now() - startTime]
    }
  }
  return undefined
}
