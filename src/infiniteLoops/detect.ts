import { getOriginalName } from './instrument'
import * as st from './state'

// TODO change to obj + enum of errors etc
function reportInfiniteLoop(message: string) {
    throw new Error(message)
}

function messageHeader(itInfo: st.IterationsInfo, functionName: string | undefined) {
    const entityName = functionName? `function ${functionName}` : "loop"
    const positionString = itInfo[0]? `line ${itInfo[0][0]}, column ${itInfo[0][1]}` : 'unknown position'
    return `The ${entityName} at ${positionString} has encountered an infinite loop.`
}

export function checkForInfinite(stackPositions: number[], state: st.State, itInfo: st.IterationsInfo, functionName: string | undefined) {
    // TODO: check if this is correct
    if (state.mixedStack[stackPositions[0]][0].length === 0) {
        reportInfiniteLoop(messageHeader(itInfo, functionName) + "\nIt has no base case.")
    }
    // arbitrarily using same threshold
    const circular = checkForCycle(stackPositions.slice(stackPositions.length - state.threshold), state)
    if (circular) {
        reportInfiniteLoop(messageHeader(itInfo, functionName) + "\nIt has the infinite cycle: "+circular)
    } else {
        // TODO: SMT SOLVER

    }
}

function checkForCycle(stackPositions: number[], state: st.State) {
    // maybeConc because arrays may still contain hybrid stuff
    const maybeConc = stackPositions.map(i=>st.getMaybeConc(state.mixedStack[i]))
    const stringifyVar = ([name, val]:[string, any])=>`(${getOriginalName(name)}: ${stringifyCircular(val)})`
    const concStr = maybeConc.map(x=>x.map(stringifyVar).join(', '))
    return getCycle(concStr)?.join(' -> ')
}

function getCycle(temp: any[]){
    let last = temp[temp.length-1]
    let ix1 = temp.lastIndexOf(last, -2)
    if (ix1 === -1) return undefined
    let period = temp.length - ix1 -1
    let s1 = temp.slice(ix1 - period, ix1)
    let s2 = temp.slice(ix1, -1)
    if (s1.length != period) return undefined
    for (let i = 0; i < period; i++) {
        if (s1[i] != s2[i]) return undefined
    }
    return s1.concat(s1[0])
}

function stringifyCircular(x:any) {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#examples
    const getCircularReplacer = () => {
        const seen = new WeakSet();
        return (key:string, value:any) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "(CIRCULAR)";
            }
            seen.add(value);
          }
          return value;
        };
      };
      
    return JSON.stringify(x, getCircularReplacer());
}