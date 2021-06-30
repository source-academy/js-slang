import * as sym from './symbolic'
import * as create from '../utils/astCreator'
import { generate } from 'astring'
import * as es from 'estree'


// Object + functions called during runtime to check for infinite loops

type CacheId = number
type CachedExpression = [CacheId, es.Expression]

type Path = CacheId[]
type Transition = [string, any, CacheId][]
type Iteration = [Path, Transition]
type Positions = [number, number] | undefined
type IterationsInfo = [Positions, number[]] // TODO rename this

export interface State {
    variablesModified: Map<string, sym.Hybrid>
    variablesToReset: Set<string>
    expressionCache: [Map<string, CachedExpression>, string[]]
    mixedStack: Iteration[] // TODO: add a skip or sth
    stackPointer: number
    // Position, pointer to prev, pointer to each iteration of loop
    loopStack: IterationsInfo[]
    functionInfo: Map<string, IterationsInfo>
    lastFunction: string
    // TODO: threshold??
}

export const initState = () => ({
    variablesModified: new Map(),
    variablesToReset: new Set(),
    expressionCache: [new Map(), []],
    mixedStack: [[[],[]]],
    stackPointer: 0,
    loopStack: [],
    functionInfo: new Map(),
    lastFunction: ""
}) as State

function toCached(expr: es.Expression, state: State){
    // TODO undefined here as something something
    const asString = generate(expr)
    const [forward, backward] = state.expressionCache
    let item = forward.get(asString)
    if (item === undefined) {
        const id = forward.size
        forward.set(asString, [id, expr])
        backward[id] = asString
        return id
    } else {
        return item[0]
    }
}

function savePath(expr: es.Expression, state: State) {
    const id = toCached(expr, state)
    state.mixedStack[state.stackPointer][0].push(id)
}

function saveTransition(name: string, value: sym.Hybrid, state: State) {
    const concrete = value.concrete
    const id = toCached(value.symbolic, state)
    state.mixedStack[state.stackPointer][1].push([name, concrete, id])
}

function newStackFrame(state: State) {
    // put skipframes here. if current frame = frame behind it, change the behind one to skip (for resuming later)
    state.mixedStack.push([[],[]])
    return ++ state.stackPointer
}

function hybridize(name: string, originalValue: any, state: State) {
    let value = originalValue
    if (state.variablesToReset.has(name)) {
        value = sym.deepConcretizeInplace(value)
    }
    return sym.hybridizeNamed(name, value)
}

function saveVarIfHybrid(name: string, value: any, state: State) {
    state.variablesToReset.delete(name)
    if (sym.isHybrid(value)) {
        state.variablesModified.set(name, value)
    }
    return value
}

function saveBoolIfHybrid(value: any, state: State) {
    if (sym.isHybrid(value)) {
        savePath(value.symbolic, state)
        return sym.shallowConcretize(value)
    }
    return value
}

function cachedUndefined(state: State) {
    return toCached(create.identifier('undefined'), state)
}

function preFunction(name: string, positions: Positions, args: [string, any][], state: State) {
    let info = state.functionInfo.get(name)
    if (info === undefined) {
        info = [positions, []]
        state.functionInfo.set(name, info)
    } else {
        cleanUpVariables(state)
        const prevPointer = info[1][info[1].length - 1]
        const transitions: Transition = []
        for (const [name, val] of args) {
            if (sym.isHybrid(val)) {
                transitions.push([name, val.concrete, toCached(val.symbolic, state)])
            } else {
                transitions.push([name, val.concrete, cachedUndefined(state)])
            }
            state.variablesToReset.add(name)
        }
        state.mixedStack[prevPointer][1].push(...transitions)
    }
    if (meetsThreshold(info[1].length, state)) {
        dispatch(info[1])
    }
    info[1].push(newStackFrame(state))
    
}

function returnFunction(value: any, state: State) {
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

function enterLoop(positions: Positions, state: State) {
    state.loopStack.unshift([positions, [newStackFrame(state)]])
}

function postLoop(state: State, ignoreMe?: any) {
    // ignoreMe: hack to squeeze this in for statements
    const stackPositions = state.loopStack[0][1]
    if(meetsThreshold(stackPositions.length, state)) {
        dispatch(stackPositions)
    }
    cleanUpVariables(state)
    stackPositions.push(newStackFrame(state))
    return ignoreMe
}

function exitLoop(state: State) {
    cleanUpVariables(state)
    state.stackPointer = state.loopStack[0][1][0] - 1
    state.loopStack.shift()
}

function dispatch(stackPositions: number[]) {
    const withoutFirst = stackPositions.slice(1)
    return withoutFirst
}

function meetsThreshold(n: number, state: State) {
    return false
}

function cleanUpVariables(state: State) {
    for (const [name, value] of state.variablesModified) {
        saveTransition(name, value, state)
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