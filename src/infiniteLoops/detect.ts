import { getOriginalName } from './instrument'
import { generate } from 'astring'
import * as st from './state'
import { simple } from '../utils/walkers'
import * as es from 'estree'

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
        codeToDispatch(stackPositions, state)
    }
}


type Triple = [number[], number[], [string, any, number][]]

const flatten = (arr: any[][]) => [].concat.apply([], arr)

function arrEquals<T>(a1:T[], a2:T[], cmp=(x:T,y:T)=>(x===y)) {
    if (a1.length !== a2.length) return false
    for (let i = 0; i < a1.length; i++) {
        if (!cmp(a1[i],a2[i])) return false
    }
    return true
}

function tripleEquals(t1: Triple, t2: Triple) {
    return arrEquals(t1[0], t2[0]) && arrEquals(t1[1], t2[1])
            && arrEquals(t1[2], t2[2], (x,y)=> x[0] === y[0] && x[2] === y[2])
}

function codeToDispatch(stackPositions: number[], state: st.State) { // TODO: name
    const firstSeen = getFirstSeen(stackPositions, state)
    const closedCycles = getClosed(firstSeen)
    const toCheckNested = closedCycles.map(([from, to]) => toSmtSyntax(firstSeen.slice(from, to + 1), state))
    return flatten(toCheckNested)
}

function getFirstSeen(stackPositions: number[], state: st.State) {
    const firstSeen: Triple[] = []
    let prev = state.mixedStack[stackPositions[0]]
    // TODO: check if this approach is sound
    for (const pos of stackPositions.slice(1)) {
        const next = state.mixedStack[pos]
        const triple: Triple = [prev[0], next[0], prev[1]]
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
    const inner = (x: string[]) => `(${x.join(" and ")})`
    return content.map(inner).join(" or ")
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
    return [... new Set(result)]
}

function getConstantsAndSigns(line1: string, line3: string, transitions: [string, number, string][][]) {
    const values = new Map<string, [boolean, number][]>()
    for (const [name, val, next] of flatten(transitions)) {
        let item = values.get(name)
        if (item===undefined) {
            item = []
            values.set(name, item)
        }
        item.push([name === next, val])
    }
    const consts = []
    const signs1 = []
    const signs3 = []
    for (const [name, item] of values.entries()) {
        if (item.every(x=>x[0])) {
            consts.push(`${name} = ${item[0][1]}`)
        } else if (item.every(x=>x[1] > 0)) {
            signs1.push(`${name} > 0`)
            signs3.push(`${name}' > 0`)
        } else if (item.every(x=>x[1] < 0)) {
            signs1.push(`${name} < 0`)
            signs3.push(`${name}' > 0`)
        }
    }
    const innerJoiner = (x:string[]) =>`(${x.join(" and ")})`
    let newLine1 = line1
    let newLine3 = line3
    if (signs1.length > 0) {
        newLine1 = `${line1} and ${innerJoiner(signs1)}`
        newLine3 = `${line3} and ${innerJoiner(signs3)}`
    }
    if (consts.length > 0) newLine1 = `${innerJoiner(consts)} -> ${line1}`
    return [newLine1, newLine3]
}

function smtTemplate(mode: string, decls: string, line1:string, line2: string, line3: string) {
    return `goal g_1:
    forall ${decls}:${mode}.
        ${line1} ->
        ${line2} ->
        ${line3}`
}

function toSmtSyntax(toInclude: Triple[], state: st.State): string[] {
    const getStr = (x: number) => state.expressionCache[1][x]
    const getExpr = (str: string) => {
        const val = state.expressionCache[0].get(str)
        return (val as [number, es.Expression])[1]
    }
    const pathStr = toInclude.map(x=>x[0].map(getStr))
    const line1 = joiner(pathStr)
    const pathExprs = pathStr.map(x=>x.map(getExpr))
    const ids = getIds(pathExprs)
    // primify
    ids.map(x=>x.name = x.name + "'")
    const line3 = joiner(pathExprs.map(x=>x.map(generate)))
    // unprimify
    ids.map(x=>x.name = x.name.slice(0, -1))

    const transitions = toInclude.map(x=>x[2].map(([n,v,ix])=>[n,v,getStr(ix)]))
                                 .map(x=>x.filter(y=>typeof y[1] === 'number') as [string, number, string][])
    const line2 = joiner(transitions.map(x=>x.map(([n,_,s]) => `${n}' = ${s}`)))
    const allNames = flatten(transitions.map(x=>x.map(y=>y[0]))).concat(ids.map(x=>x.name))
    const decls = [...new Set(allNames)].map(x=>`${x},${x}'`).join(',')
    const [newLine1, newLine3] = getConstantsAndSigns(line1, line2, transitions)
    const template1 = smtTemplate("int", decls, line1, line2, line3)
    const template2 = smtTemplate("int", decls, newLine1, line2, newLine3)
    return [template1, template2]
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