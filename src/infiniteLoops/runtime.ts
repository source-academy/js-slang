import * as sym from './symbolic'
import * as create from '../utils/astCreator'
import * as st from './state'
import { checkForInfinite } from './detect'

function hybridize(name: string, originalValue: any, state: st.State) {
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
    if (sym.isHybrid(value)) {
        st.savePath(value.symbolic, state)
        return sym.shallowConcretize(value)
    }
    return value
}

function cachedUndefined(state: st.State) {
    return st.toCached(create.identifier('undefined'), state)
}

function preFunction(name: string, positions: st.Positions, args: [string, any][], state: st.State) {
    let info = state.functionInfo.get(name)
    if (info === undefined) {
        info = [positions, []]
        state.functionInfo.set(name, info)
    } else {
        cleanUpVariables(state)
        const prevPointer = info[1][info[1].length - 1]
        const transitions: st.Transition = []
        for (const [name, val] of args) {
            if (sym.isHybrid(val)) {
                transitions.push([name, val.concrete, st.toCached(val.symbolic, state)])
            } else {
                transitions.push([name, val.concrete, cachedUndefined(state)])
            }
            state.variablesToReset.add(name)
        }
        state.mixedStack[prevPointer][1].push(...transitions)
        dispatchIfMeetsThreshold(info[1].slice(0, info[1].length-1), state, info, name)
    }
    info[1].push(st.newStackFrame(state))
    
}

function returnFunction(value: any, state: st.State) {
    let info = state.functionInfo.get(state.lastFunction)
    cleanUpVariables(state)
    // both should always happen but
    if (info !== undefined) {
        const lastPosn = info[1].pop()
        if (lastPosn !== undefined) {
            state.stackPointer = lastPosn - 1
        }
    }
    return value
}

function enterLoop(positions: st.Positions, state: st.State) {
    state.loopStack.unshift([positions, [st.newStackFrame(state)]])
}

function postLoop(state: st.State, ignoreMe?: any) {
    // ignoreMe: hack to squeeze this in for statements
    const stackPositions = state.loopStack[0][1]
    dispatchIfMeetsThreshold(stackPositions.slice(1), state, state.loopStack[0])
    cleanUpVariables(state)
    stackPositions.push(st.newStackFrame(state))
    return ignoreMe
}

function exitLoop(state: st.State) {
    cleanUpVariables(state)
    state.stackPointer = state.loopStack[0][1][0] - 1
    state.loopStack.shift()
}

function dispatchIfMeetsThreshold(stackPositions: number[], state: st.State, info: st.IterationsInfo, functionName?: string) {
    let checkpoint = state.threshold
    while (checkpoint <= stackPositions.length) {
        if (stackPositions.length === checkpoint) {
            checkForInfinite(stackPositions, state, info, functionName)
        }
        checkpoint = checkpoint * 2
    }
}

function cleanUpVariables(state: st.State) {
    for (const [name, value] of state.variablesModified) {
        st.saveTransition(name, value, state)
        state.variablesToReset.add(name)
    }
}

export const functions = {
    hybridize: hybridize,
    saveBool: saveBoolIfHybrid,
    saveVar: saveVarIfHybrid,
    preFunction: preFunction,
    returnFunction: returnFunction,
    postLoop: postLoop,
    enterLoop: enterLoop,
    exitLoop: exitLoop,
    evalB: sym.evaluateHybridBinary,
    evalU: sym.evaluateHybridUnary,
}