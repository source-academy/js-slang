import * as es from 'estree'
import { Context } from '../types'
import * as sym from './symbolicExecutor'

function getVars(node: es.Node): Array<string> {
    // TODO handle more expr types?
    if(node.type === 'Identifier') {
        return [node.name]
    } else if(node.type === 'LogicalExpression' || node.type === 'BinaryExpression') {
        return getVars(node.left).concat(getVars(node.right))
    } else if(node.type === 'UnaryExpression') {
        return getVars(node.argument)
    } else if(node.type === 'ConditionalExpression') {
        return getVars(node.test).concat(
                getVars(node.consequent).concat(
                    getVars(node.alternate)
                ))
    }
    return []
}

function getRelevantVars(node: es.FunctionDeclaration) {
    // TODO handle var shadowing
    // If we want to include global variables, we will also have to change the return type and all functions using this
    type EdgeList = Array<[string,string]>

    const body = node.body

    function hasReturnStatement(node: es.Node) {
        //TODO
        return true;
    }
    function scan(node: es.Node) : EdgeList {
        let edges:  EdgeList = []
        if(node.type === 'BlockStatement') {
            for (let nd of node.body) {
                edges = edges.concat(scan(nd))
            }
        } else if (node.type === 'IfStatement') {
            edges = scan(node.consequent)
            let hasReturn: Boolean = hasReturnStatement(node.consequent)
            if (node.alternate !== null && node.alternate !== undefined) {
                edges.concat(scan(node.alternate))
                hasReturn = hasReturn || hasReturnStatement(node.alternate)
            }
            if (hasReturn) {
                for (let rhsName of getVars(node.test)) {
                    edges.push(['*', rhsName])
                }
            }
        } else if (node.type === 'VariableDeclaration') {
            const declaration = node.declarations[0]
            const id = declaration.id as es.Identifier
            const value = declaration.init as es.Expression
            for (let rhsName of getVars(value)) {
                edges.push([rhsName, id.name])
            }
        }
        return edges
    }
    let edges:  EdgeList = scan(body);
    let adjList = new Map()

    for (let edge of edges) {
        const from = edge[0]
        const to = edge[1]
        if (adjList[from] === undefined) {
            adjList[from] = [to]
        } else {
            adjList[from] = adjList[from].concat(to)
        }
    }

    let dfsStack: Array<string> = ['*'];
    let relVars: Array<string> = [];
    while (dfsStack.length !== 0) {
        const visiting = dfsStack.pop()
        if(visiting !== undefined && adjList[visiting] !== undefined){
            for (let toVisit of adjList[visiting]) {
                if (!relVars.includes(toVisit)) {
                    relVars.push(toVisit)
                    dfsStack.push(toVisit)
                }
            }
        }
    }

    const params = node.params.map( (x:es.Identifier) => x.name)
    let relVarsIdx = []
    for (let i = 0; i<params.length; i++){
        if(relVars.includes(params[i])) {
            relVarsIdx.push(i)
        }
    }
    return relVarsIdx;
}

export function cycleDetection(states: Array<string>) {
    let slow = 1
    let fast = 2
    while (states[fast]!==undefined && states[slow]!==states[fast]) {
        slow += 1
        fast += 2
    }
    return states[slow]===states[fast]
}

export function makeFunctionState(name: string, args: Array<any>, relevantVars: Array<number>) {
    // TODO use a better representation, string equality is slow
    let state = name + "("
    for (let i of relevantVars) {
        state = state + (args[i].value)
    }
    return state + ")"
}

export function infiniteLoopStaticAnalysis(node: es.FunctionDeclaration, context:Context) {
    const functionId = node.id as es.Identifier
    context.infiniteLoopDetection.relevantVars[functionId.name] = getRelevantVars(node)
    context.infiniteLoopDetection.checkers = sym.toName(node)
    //return context;
}
