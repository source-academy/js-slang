import * as es from 'estree'

import { REQUIRE_PROVIDER_ID } from '../constants'
import createContext from '../createContext'
import { getRequireProvider } from '../modules/requireProvider'
import { parse } from '../parser/parser'
import * as stdList from '../stdlib/list'
import { Chapter, Variant } from '../types'
import * as create from '../utils/astCreator'
import { checkForInfiniteLoop } from './detect'
import { InfiniteLoopError } from './errors'
import {
  InfiniteLoopRuntimeFunctions as FunctionNames,
  InfiniteLoopRuntimeObjectNames,
  instrument
} from './instrument'
import * as st from './state'
import * as sym from './symbolic'

function checkTimeout(state: st.State) {
  if (state.hasTimedOut()) {
    throw new Error('timeout')
  }
}

/**
 * This function is run whenever a variable is being accessed.
 * If a variable has been added to state.variablesToReset, it will
 * be 'reset' (concretized and re-hybridized) here.
 */
function hybridize(originalValue: any, name: string, state: st.State) {
  if (typeof originalValue === 'function') {
    return originalValue
  }
  let value = originalValue
  if (state.variablesToReset.has(name)) {
    value = sym.deepConcretizeInplace(value)
  }
  return sym.hybridizeNamed(name, value)
}

/**
 * Function to keep track of assignment expressions.
 */
function saveVarIfHybrid(value: any, name: string, state: st.State) {
  state.variablesToReset.delete(name)
  if (sym.isHybrid(value)) {
    state.variablesModified.set(name, value)
  }
  return value
}

/**
 * Saves the boolean value if it is a hybrid, else set the
 * path to invalid.
 * Does not save in the path if the value is a boolean literal.
 */
function saveBoolIfHybrid(value: any, state: st.State) {
  if (sym.isHybrid(value) && value.type === 'value') {
    if (value.validity !== sym.Validity.Valid) {
      state.setInvalidPath()
      return sym.shallowConcretize(value)
    }
    if (value.symbolic.type !== 'Literal') {
      let theExpr: es.Expression = value.symbolic
      if (!value.concrete) {
        theExpr = value.negation ? value.negation : create.unaryExpression('!', theExpr)
      }
      state.savePath(theExpr)
    }
    return sym.shallowConcretize(value)
  } else {
    state.setInvalidPath()
    return value
  }
}

/**
 * If a function was passed as an argument we do not
 * check it for infinite loops. Wraps those functions
 * with a decorator that activates a flag in the state.
 */
function wrapArgIfFunction(arg: any, state: st.State) {
  if (typeof arg === 'function') {
    return (...args: any) => {
      state.functionWasPassedAsArgument = true
      return arg(...args)
    }
  }
  return arg
}

/**
 * For higher-order functions, we add the names of its parameters
 * that are functions to differentiate different combinations of
 * function invocations + parameters.
 *
 * e.g.
 * const f = x=>x;
 * const g = x=>x+1;
 * const h = f=>f(1);
 *
 * h(f) will have a different oracle name from h(g).
 */
function makeOracleName(name: string, args: [string, any][]) {
  let result = name
  for (const [n, v] of args) {
    if (typeof v === 'function') {
      result = `${result}_${n}:${v.name}`
    }
  }
  return result
}

function preFunction(name: string, args: [string, any][], state: st.State) {
  checkTimeout(state)
  // track functions which were passed as arguments in a different tracker
  const newName = state.functionWasPassedAsArgument ? '*' + name : makeOracleName(name, args)
  const [tracker, firstIteration] = state.enterFunction(newName)
  if (!firstIteration) {
    state.cleanUpVariables()
    state.saveArgsInTransition(args, tracker)
    if (!state.functionWasPassedAsArgument) {
      const previousIterations = tracker.slice(0, tracker.length - 1)
      checkForInfiniteLoopIfMeetsThreshold(previousIterations, state, name)
    }
  }
  tracker.push(state.newStackFrame(newName))

  // reset the flag
  state.functionWasPassedAsArgument = false
}

function returnFunction(value: any, state: st.State) {
  state.cleanUpVariables()
  if (!state.streamMode) state.returnLastFunction()
  return value
}

/**
 * Executed before the loop is entered to create a new iteration
 * tracker.
 */
function enterLoop(state: st.State) {
  state.loopStack.unshift([state.newStackFrame('loopRoot')])
}

// ignoreMe: hack to squeeze this inside the 'update' of for statements
function postLoop(state: st.State, ignoreMe?: any) {
  checkTimeout(state)
  const previousIterations = state.loopStack[0]
  checkForInfiniteLoopIfMeetsThreshold(
    previousIterations.slice(0, previousIterations.length - 1),
    state
  )
  state.cleanUpVariables()
  previousIterations.push(state.newStackFrame('loop'))
  return ignoreMe
}

/**
 * Always executed after a loop terminates, or breaks, to clean up
 * variables and pop the last iteration tracker.
 */
function exitLoop(state: st.State) {
  state.cleanUpVariables()
  state.exitLoop()
}

/**
 * If the number of iterations (given by the length
 * of stackPositions) is equal to a power of 2 times
 * the threshold, check these iterations for infinite loop.
 */
function checkForInfiniteLoopIfMeetsThreshold(
  stackPositions: number[],
  state: st.State,
  functionName?: string
) {
  let checkpoint = state.threshold
  while (checkpoint <= stackPositions.length) {
    if (stackPositions.length === checkpoint) {
      checkForInfiniteLoop(stackPositions, state, functionName)
    }
    checkpoint = checkpoint * 2
  }
}

/**
 * Test if stream is infinite. May destructively change the program
 * environment. If it is not infinite, throw a timeout error.
 */
function testIfInfiniteStream(stream: any, state: st.State) {
  let next = stream
  for (let i = 0; i <= state.threshold; i++) {
    if (stdList.is_null(next)) {
      break
    } else {
      const nextTail = stdList.is_pair(next) ? next[1] : undefined
      if (typeof nextTail === 'function') {
        next = sym.shallowConcretize(nextTail())
      } else {
        break
      }
    }
  }
  throw new Error('timeout')
}

const builtinSpecialCases = {
  is_null(maybeHybrid: any, state?: st.State) {
    const xs = sym.shallowConcretize(maybeHybrid)
    const conc = stdList.is_null(xs)
    const theTail = stdList.is_pair(xs) ? xs[1] : undefined
    const isStream = typeof theTail === 'function'
    if (state && isStream) {
      const lastFunction = state.getLastFunctionName()
      if (state.streamMode === true && state.streamLastFunction === lastFunction) {
        // heuristic to make sure we are at the same is_null call
        testIfInfiniteStream(sym.shallowConcretize(theTail()), state)
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
    return
  },
  // mimic behaviour without printing
  display: (...x: any[]) => x[0],
  display_list: (...x: any[]) => x[0]
}

function returnInvalidIfNumeric(val: any, validity = sym.Validity.NoSmt) {
  if (typeof val === 'number') {
    const result = sym.makeDummyHybrid(val)
    result.validity = validity
    return result
  } else {
    return val
  }
}

function prepareBuiltins(oldBuiltins: Map<string, any>) {
  const nonDetFunctions = ['get_time', 'math_random']
  const newBuiltins = new Map<string, any>()
  for (const [name, fun] of oldBuiltins) {
    const specialCase = builtinSpecialCases[name]
    if (specialCase !== undefined) {
      newBuiltins.set(name, specialCase)
    } else {
      const functionValidity = nonDetFunctions.includes(name)
        ? sym.Validity.NoCycle
        : sym.Validity.NoSmt
      newBuiltins.set(name, (...args: any[]) => {
        const validityOfArgs = args.filter(sym.isHybrid).map(x => x.validity)
        const mostInvalid = Math.max(functionValidity, ...validityOfArgs)
        return returnInvalidIfNumeric(fun(...args.map(sym.shallowConcretize)), mostInvalid)
      })
    }
  }
  newBuiltins.set('undefined', undefined)
  return newBuiltins
}

function nothingFunction(..._args: any[]) {
  return nothingFunction
}

function trackLoc(loc: es.SourceLocation | undefined, state: st.State, ignoreMe?: () => any) {
  state.lastLocation = loc
  if (ignoreMe !== undefined) {
    return ignoreMe()
  }
}

const functions = {}
functions[FunctionNames.nothingFunction] = nothingFunction
functions[FunctionNames.concretize] = sym.shallowConcretize
functions[FunctionNames.hybridize] = hybridize
functions[FunctionNames.wrapArg] = wrapArgIfFunction
functions[FunctionNames.dummify] = sym.makeDummyHybrid
functions[FunctionNames.saveBool] = saveBoolIfHybrid
functions[FunctionNames.saveVar] = saveVarIfHybrid
functions[FunctionNames.preFunction] = preFunction
functions[FunctionNames.returnFunction] = returnFunction
functions[FunctionNames.postLoop] = postLoop
functions[FunctionNames.enterLoop] = enterLoop
functions[FunctionNames.exitLoop] = exitLoop
functions[FunctionNames.trackLoc] = trackLoc
functions[FunctionNames.evalB] = sym.evaluateHybridBinary
functions[FunctionNames.evalU] = sym.evaluateHybridUnary

/**
 * Tests the given program for infinite loops.
 * @param program Program to test.
 * @param previousProgramsStack Any code previously entered in the REPL & parsed into AST.
 * @returns SourceError if an infinite loop was detected, undefined otherwise.
 */
export async function testForInfiniteLoop(
  program: es.Program,
  previousProgramsStack: es.Program[]
) {
  const context = createContext(Chapter.SOURCE_4, Variant.DEFAULT, undefined, undefined)
  const prelude = parse(context.prelude as string, context) as es.Program
  context.prelude = null
  const previous: es.Program[] = [...previousProgramsStack, prelude]
  const newBuiltins = prepareBuiltins(context.nativeStorage.builtins)
  const { builtinsId, functionsId, stateId } = InfiniteLoopRuntimeObjectNames

  const instrumentedCode = await instrument(previous, program, newBuiltins.keys())
  const state = new st.State()

  const sandboxedRun = new Function(
    'code',
    functionsId,
    stateId,
    builtinsId,
    REQUIRE_PROVIDER_ID,
    // redeclare window so modules don't do anything funny like play sounds
    '{let window = {}; return eval(code)}'
  )

  try {
    await sandboxedRun(instrumentedCode, functions, state, newBuiltins, getRequireProvider(context))
  } catch (error) {
    if (error instanceof InfiniteLoopError) {
      if (state.lastLocation !== undefined) {
        error.location = state.lastLocation
      }
      return error
    }
    // Programs that exceed the maximum call stack size are okay as long as they terminate.
    if (error instanceof RangeError && error.message === 'Maximum call stack size exceeded') {
      return undefined
    }
    throw error
  }
  return undefined
}
