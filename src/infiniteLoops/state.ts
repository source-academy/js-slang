import * as sym from './symbolic';
import { generate } from 'astring';
import * as es from 'estree';

// Object + functions called during runtime to check for infinite loops
type CacheId = number;
type CachedExpression = [CacheId, es.Expression];
type Path = CacheId[];
export type Transition = [string, any, CacheId][];
type Iteration = [Path, Transition];
export type Positions = [number, number] | undefined;
export type IterationsInfo = [Positions, number[]]; // TODO rename this


export interface State {
    variablesModified: Map<string, sym.Hybrid>;
    variablesToReset: Set<string>;
    expressionCache: [Map<string, CachedExpression>, string[]];
    mixedStack: Iteration[]; // TODO: add a skip or sth
    stackPointer: number;
    // Position, pointer to prev, pointer to each iteration of loop
    loopStack: IterationsInfo[];
    functionInfo: Map<string, IterationsInfo>;
    lastFunction: string;
    threshold: number;
}

export const initState = () => ({
    variablesModified: new Map(),
    variablesToReset: new Set(),
    expressionCache: [new Map(), []],
    mixedStack: [[[], []]],
    stackPointer: 0,
    loopStack: [],
    functionInfo: new Map(),
    lastFunction: "",
    threshold: 20 // arbitrary?
}) as State;
export function toCached(expr: es.Expression, state: State) {
    // TODO undefined here as something something
    const asString = generate(expr);
    const [forward, backward] = state.expressionCache;
    let item = forward.get(asString);
    if (item === undefined) {
        const id = forward.size;
        forward.set(asString, [id, expr]);
        backward[id] = asString;
        return id;
    } else {
        return item[0];
    }
}
export function savePath(expr: es.Expression, state: State) {
    const id = toCached(expr, state);
    state.mixedStack[state.stackPointer][0].push(id);
}
export function saveTransition(name: string, value: sym.Hybrid, state: State) {
    const concrete = value.concrete;
    const id = toCached(value.symbolic, state);
    state.mixedStack[state.stackPointer][1].push([name, concrete, id]);
}
export function newStackFrame(state: State) {
    // put skipframes here. if current frame = frame behind it, change the behind one to skip (for resuming later)
    state.mixedStack.push([[], []]);
    return ++state.stackPointer;
}

export function getMaybeConc(iteration: Iteration) {
    return iteration[1].map(x=>[x[0], x[1]])
}