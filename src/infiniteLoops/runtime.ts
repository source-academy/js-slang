import * as sym from './symbolic'
import * as st from './state' // TODO rename/import directly?
// Object + functions called during runtime to check for infinite loops

function hybridizeIfModeNotConcrete(name: string, value: any, state: st.State) {
    // do the reset of vars here? (lazy) | EDIT: flag for reset in postloop etc -> cleanup here
    if (state.mode === st.Mode.Concrete) {
        return value
    } else {
        return sym.hybridizeNamed(name, value)
    }
}

function saveBoolIfModeNotConcrete(value: any, state: st.State) {
    if (state.mode === st.Mode.Concrete && sym.isHybrid(value)) {
        // TODO ADD TO PATH
    }
    return value
}

function saveVarIfModeNotConcrete(name: string, value: any, state: st.State) {
    if (state.mode === st.Mode.Concrete && sym.isHybrid(value)) {
        // TODO ADD TO PATH
    }
    return value
}

function preFunction(name: string, positions: [number, number] | undefined, args: [string, any][], state: st.State) {
    // TODO: change modes etc and add to transitions + varnames + dispatch
}

function returnFunction(state: st.State) {
    // TODO: change modes etc and add to transitions + varnames + dispatch
    // TODO: remember to reset vars (also in loops)
}

function preLoop(positions: [number, number] | undefined, state: st.State) {
    // TODO things + dispatch
}

function postLoop(state: st.State) {
    
}

function breakLoop(state: st.State) {
    
}

function exitLoop(state: st.State) {
    
}

// V SIMPLE SOLUTION TO PATH THINGY: just generate->string and cache the strings (1 for each expr).
// do for both path + transition symbolic. transition concrete only adds linear space
// then store ^ in a stack, push/pop as reqd


export const functions = {
    hybridize: hybridizeIfModeNotConcrete,
    saveBool: saveBoolIfModeNotConcrete,
    saveVar: saveVarIfModeNotConcrete,
    preFunction: preFunction,
    returnFunction: returnFunction,
    preLoop: preLoop,
    postLoop: postLoop,
    breakLoop: breakLoop,
    exitLoop: exitLoop,
    concretize: sym.deepConcretizeInplace,
    evalB: sym.evaluateHybridBinary,
    evalU: sym.evaluateHybridUnary,
}