import * as es from 'estree'

type Symbol = NumberSymbol | InequalitySymbol | FunctionSymbol | BranchSymbol | SequenceSymbol |
              UnusedSymbol | SkipSymbol | TerminateSymbol | BooleanSymbol

type BooleanSymbol = BooleanValueSymbol | InequalitySymbol | LogicalSymbol

export class NumberSymbol{
    type: "NumberSymbol" = 'NumberSymbol'
    name: string
    constant: number
    constructor(name:string, constant:number) {
        this.name = name
        this.constant = constant
    }
}

export class BooleanValueSymbol {
    // TODO how to use this
    type: "BooleanValueSymbol" = 'BooleanValueSymbol'
    name: string
    value: boolean
    constructor(name:string, value:boolean){
        this.name = name
        this.value = value
    }
}

export class LogicalSymbol {
    //TODO literals, and compound ineq
    //normal form??
    type: "LogicalSymbol" = 'LogicalSymbol'
    left: BooleanSymbol
    right: BooleanSymbol
    conjunction: boolean
    constructor(left:BooleanSymbol, right:BooleanSymbol, conjunction?: boolean){
        this.left = left
        this.right = right
        this.conjunction  = conjunction === undefined ? true : conjunction
    }
}

export class InequalitySymbol{
    type: "InequalitySymbol" = 'InequalitySymbol'
    name: string
    constant: number
    direction: number
    constructor(name:string, constant:number, direction:number) {
        this.name = name
        this.constant = constant
        this.direction = direction
    }
}

export class FunctionSymbol{
    type: "FunctionSymbol" = 'FunctionSymbol'
    name: string
    args: Array<Symbol>
    constructor(name:string, args:Array<Symbol>) {
        this.name = name
        this.args = args
    }
}
export class BranchSymbol{
    type: "BranchSymbol" = 'BranchSymbol'
    test: BooleanSymbol
    consequent: Symbol
    alternate: Symbol
    constructor(test:BooleanSymbol, consequent:Symbol, alternate:Symbol) {
        this.test = test
        this.consequent = consequent
        this.alternate = alternate
    }
}

export class SequenceSymbol{
    type: "SequenceSymbol" = 'SequenceSymbol'
    symbols: Array<Symbol>
    constructor(symbols: Array<Symbol>) {
        this.symbols = symbols
    }
}

export interface SkipSymbol{
    type: "SkipSymbol"
}

export interface TerminateSymbol{
    type: "TerminateSymbol"
}

export interface UnusedSymbol{
    type: "UnusedSymbol"
}
export const skipSymbol = {type: "SkipSymbol"} as SkipSymbol
export const terminateSymbol = {type: "TerminateSymbol"} as TerminateSymbol
export const unusedSymbol = {type: "UnusedSymbol"} as UnusedSymbol

export type SymbolicExecutable = es.Node | Symbol
  
function isSymbol(node: SymbolicExecutable): node is Symbol {
    return node.type.slice(-6) === 'Symbol'
}

function negateSymbol(sym: BooleanSymbol) : BooleanSymbol {
    if (sym.type === 'LogicalSymbol') {
        const new_lhs = negateSymbol(sym.left)
        const new_rhs = negateSymbol(sym.right)
        return new LogicalSymbol(new_lhs, new_rhs, !sym.conjunction) // de morgans
    } else if (sym.type === 'InequalitySymbol') {
        if(sym.direction === 0) {
            return new LogicalSymbol({...sym, direction:1},{...sym, direction:-1},false)
        } else {
            const new_const = sym.constant + sym.direction
            return new InequalitySymbol(sym.name,new_const,-sym.direction)
        }
    } else if (sym.type === 'BooleanValueSymbol') {
        return sym // TODO handle
    }
    return sym
}
function isBooleanSymbol(node: SymbolicExecutable): node is BooleanSymbol {
    return node.type === 'BooleanValueSymbol' ||
           node.type === 'LogicalExpression' ||
           node.type === 'InequalitySymbol'
}

function execBinarySymbol(node1: SymbolicExecutable, node2: SymbolicExecutable, op: string, flipped: boolean) : Symbol {
    type opFunction = (value:number, sym: NumberSymbol, flipped: boolean) => Symbol
    //TODO big todo: check the math of below (esp flipped, >= after flip etc)
    //TODO check if 1-x makes sense here
    const operators: { [nodeType: string]: opFunction } = {
        '+': function(value:number, sym: NumberSymbol, flipped: boolean){
            return {...sym, constant: sym.constant + value}
        },
        '-': function(value:number, sym: NumberSymbol, flipped: boolean){
            if (flipped) {
                return {...sym, constant:  value - sym.constant}
            } else {
                return {...sym, constant: sym.constant - value}
            }
        },
        '===': function(value:number, sym: NumberSymbol, flipped: boolean){
            return new InequalitySymbol(sym.name, value-sym.constant, 0)
        },
        '<': function(value:number, sym: NumberSymbol, flipped: boolean){
            if(flipped) {
                return new InequalitySymbol(sym.name, value-sym.constant, 1)
            } else {
                return new InequalitySymbol(sym.name, value-sym.constant, -1)
            }
        },
        '>': function(value:number, sym: NumberSymbol, flipped: boolean){
            return operators['<'](value, sym, !flipped)
        },
        '>=': function(value:number, sym: NumberSymbol, flipped: boolean){
            return operators['>'](value-1, sym, flipped)
        },
        '<=': function(value:number, sym: NumberSymbol, flipped: boolean){
            return operators['<'](value+1, sym, flipped)
        },
        '!==': function(value:number, sym: NumberSymbol, flipped: boolean){ // TODO check this (inside branch test?) *change seq to boolean sym
            return negateSymbol(operators['==='](value, sym, false) as InequalitySymbol)
        },
    }
    if(node1.type === 'Literal' &&  node2.type === 'NumberSymbol') {
        return execBinarySymbol(node2, node1, op, true)
    } else if (node2.type === 'Literal' && node1.type === 'NumberSymbol') {
        const val = node2.value
        if(typeof val === 'number' && Number.isInteger(val)){
            const result = operators[op](val, node1 as NumberSymbol, flipped)
            return  result ? result : skipSymbol
        }
    } else if (node1.type === 'FunctionSymbol') {
        if (node2.type === 'FunctionSymbol') {
            return new SequenceSymbol([node1, node2])
        } else {
            return node1
        }
    } else if (node2.type === 'FunctionSymbol') {
        return node2
    }
    return skipSymbol
}

function irreducible(node: SymbolicExecutable) {
    return isSymbol(node) || node.type === 'Literal'
}

function getFromEnv(name: string, context: Array<Map<string, Symbol> >) {
    for(let env of context) {
        if (env[name]) {
            return env[name]
        }
    }
    return undefined
}

function isTerminal(node: SymbolicExecutable) : boolean {
    if (node.type === 'BranchSymbol') {
        return isTerminal(node.consequent) && isTerminal(node.alternate)
    } else if (node.type === 'SequenceSymbol') {
        return node.symbols.every(isTerminal) //check
    }
    return node.type !== 'FunctionSymbol' && node.type !== 'SkipSymbol'
}

function symbolicExecute(node: SymbolicExecutable, context: Array<Map<string, Symbol> >): Symbol {
    // TODO maybe switch to switch instead of if
    if (isSymbol(node)) {
        return node as Symbol; //???
    } else if(node.type === 'Identifier') {
        const checkEnv = getFromEnv(node.name, context)
        if (checkEnv) {
            return checkEnv
        }
        return new NumberSymbol(node.name,0);
    } else if (node.type === 'VariableDeclaration') {
        // environment something again
        // TODO hoising business? (need?)
        // TODO if rhs calls fn
        const declaration = node.declarations[0]
        const rhs = declaration.init
        const id = declaration.id as es.Identifier
        if(rhs) {
            context[0][id.name] = symbolicExecute(rhs, context)
        }
        return unusedSymbol
    } else if (node.type === 'ExpressionStatement') {
        return symbolicExecute(node.expression, context)
    } else if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
        // TODO if cond expr value is used
        const test = symbolicExecute(node.test, context)
        const consequent = symbolicExecute(node.consequent, context)
        const alternate = node.alternate? symbolicExecute(node.alternate, context) : unusedSymbol
        if (isBooleanSymbol(test)) {
            return new BranchSymbol(test, consequent, alternate)
        }
        return skipSymbol
    } else if (node.type === 'BlockStatement') {
        const newContext = [new Map].concat(context)
        return new SequenceSymbol(node.body.map((x=>symbolicExecute(x, newContext))))
    } else if (node.type === 'BinaryExpression') {
        const lhs = irreducible(node.left) ? node.left : symbolicExecute(node.left, context)
        const rhs = irreducible(node.right) ? node.right : symbolicExecute(node.right, context)
        return execBinarySymbol(lhs, rhs, node.operator, false)
    } else if (node.type === 'UnaryExpression') {
        //TODO
        return skipSymbol
    } else if (node.type === 'LogicalExpression') {
        //not yet
        return skipSymbol
    } else if (node.type === 'CallExpression') {
        if(node.callee.type === 'Identifier') {
            return new FunctionSymbol(node.callee.name, node.arguments.map((x=>symbolicExecute(x, context))))
        }
    } else if (node.type === 'ReturnStatement') {
        const arg = node.argument
        if (arg === undefined || arg === null || arg.type ==='Identifier') {
            return terminateSymbol
        } else {
            const value = symbolicExecute(arg, context)
            return isTerminal(value) ? terminateSymbol : value
        }
        
    }
    return skipSymbol
}

function seperateDisjunctions(node:BooleanSymbol) : Array<BooleanSymbol> {
    //TODO also check the math
    if (node.type === 'LogicalSymbol' && !node.conjunction){
        return seperateDisjunctions(node.left).concat(seperateDisjunctions(node.right))
    }
    return [node]
}

function serialize(node: Symbol) : Symbol[][] {
    if (isTerminal(node)) {
        return [[terminateSymbol]]
    } else if (node.type === 'SequenceSymbol') {
        let result : Symbol[][] = []
        const temp = node.symbols.map(serialize)
        for (let subList of temp) {
            result = result.concat(subList)
        }
        return result
    } else if (node.type === 'BranchSymbol') {
        const consTail = serialize(node.consequent)
        const altTail = serialize(node.alternate)
        let result : Symbol[][] = []
        for (let sym of seperateDisjunctions(node.test)) {
            result = result.concat(consTail.map(x=>[sym as Symbol].concat(x)))
        }

        for (let sym of seperateDisjunctions(negateSymbol(node.test))) {
            result = result.concat(altTail.map(x=>[sym as Symbol].concat(x)))
        }
        return result
    } else if (node.type === 'FunctionSymbol'){
        return [[node]]
    }
    return []
}
export type infiniteLoopChecker = (name:string, args: any[]) => boolean

function makeUnaryChecker (name1:string, constant:number, direction:number) : infiniteLoopChecker {
    //need to check length?
    function checker(name2:string, args: any[]) : boolean {
        if(direction<0) {
            //console.log(`${name1}(${args[0]}), ${args[0]} < ${constant}`)
            return name1 === name2 && args[0] < constant && args.length === 1
        } else if (direction>0) {
            //console.log(`${name1}(${args[0]}), ${args[0]} > ${constant}`)
            return name1 === name2 && args[0] > constant && args.length === 1
        }
        //console.log(`${name1}(${args[0]}), ${args[0]} === ${constant}`)
        return name1 === name2 && args[0] === constant && args.length === 1
    }
    return checker
}
function simpleCheck(symLists: Symbol[]) : infiniteLoopChecker | undefined {
    if(symLists.length === 3 &&
       symLists[0].type === 'FunctionSymbol' &&
       symLists[1].type === 'InequalitySymbol' &&
       symLists[2].type === 'FunctionSymbol' &&
       symLists[0].name === symLists[0].name &&
       symLists[0].args.length === 1
      ) { //TODO make more general
        const to = symLists[2].args[0]
        const direction = symLists[1].direction
        if (to.type === 'NumberSymbol' && to.constant*direction > 0) {
            return makeUnaryChecker(symLists[0].name, symLists[1].constant, direction)
        }
    }
    return undefined
}

function getFirstCall(node: es.FunctionDeclaration) : Symbol {
    function doParam(param: es.Node){
        if (param.type === 'Identifier') {
            return new NumberSymbol(param.name, 0)
        }
        return unusedSymbol
    }
    const id = node.id as es.Identifier
    const args = node.params.map(doParam)
    return new FunctionSymbol(id.name, args)
}

export function toName(node: es.FunctionDeclaration) {
    const firstCall = getFirstCall(node)
    const symTree = symbolicExecute(node.body, [new Map()])
    const symLists = serialize(symTree).map(x=>[firstCall].concat(x))
    return symLists.map(simpleCheck).filter(x=>x!==undefined) as Array<infiniteLoopChecker>
}