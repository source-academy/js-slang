import * as create from '../utils/astCreator'
import * as es from 'estree'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as stdList from '../stdlib/list'

// data structure for symbolic + hybrid values

export interface HybridValue {
    type: 'value'
    concrete: any
    symbolic: es.Expression
    negation?: es.Expression
    invalid: boolean
}

export interface HybridArray {
    type: 'array'
    concrete: any
    symbolic: es.Expression
    listHeads: HybridArray[] // for set_tail stuff
    invalid: boolean
}

export type Hybrid = HybridValue | HybridArray

export function hybridizeNamed(name: string, value: any): Hybrid {
    if (isHybrid(value)) {
        return value
    } else if (Array.isArray(value)) {
        return makeHybridArray(name, value)
    } else {
        return hybridValueConstructor(value, create.identifier(name))
    }
}

export function isHybrid(value: any): value is Hybrid {
    return typeof value === 'object' && value !== null && value.hasOwnProperty('symbolic')
}

function isHybridArray(value: any): value is HybridArray {
    return isHybrid(value) && value.type === 'array'
}

function isConcreteValue(value: any) {
    return !(isHybrid(value) || Array.isArray(value))
}

const hybridValueConstructor = (concrete: any, symbolic: es.Expression, invalid = false) => ({
    type: 'value',
    concrete: concrete,
    symbolic: symbolic,
    invalid: invalid
    }) as HybridValue

export function makeDummyHybrid(concrete: any): HybridValue {
    if (!isConcreteValue(concrete)) {
        return concrete
    }
    const val : HybridValue = {
        type: 'value',
        concrete: concrete,
        symbolic: create.literal(concrete),
        invalid: false
        }
    return val
}

export function getBooleanResult(value: HybridValue) {
    if (value.concrete) return value.symbolic

    if (value.negation !== undefined) {
        return value.negation
    } else {
        return create.unaryExpression('!', value.symbolic)
    }
}

const hybridArrayConstructor = (concrete: any, symbolic: es.Expression, listHeads = [] as HybridArray[]) => ({ type: 'array',
    concrete: concrete,
    symbolic: symbolic,
    listHeads: listHeads,
    invalid: false
    }) as HybridArray

function makeHybridArray(name: string, concrete: any[]): HybridArray {
    // note single quotes used in generated indentifiers: quick hack to avoid name clashes
    let count = 0
    const visited: any[][] = []
    function innerInplace(x: any[]) {
        visited.push(x)
        for (let i=0; i<x.length; i++) {
            if (Array.isArray(x[i])) {
                let skip = false
                for (const v of visited) {
                    if (x[i]===v) skip = true
                }
                if (!skip) innerInplace(x[i])
            } else if (x[i] !== null && x[i] !== undefined && x[i].symbolic === undefined && typeof x[i] === 'number') {
                x[i] = hybridValueConstructor(x[i], create.identifier(`${name}'${count++}`))
            }
        }
    }
    innerInplace(concrete)
    return hybridArrayConstructor(concrete, create.identifier(`${name}'len`))
}

export function deepConcretizeInplace(value: any) {
    function innerInplace(x: any[]) {
        for (let i=0; i<x.length; i++) {
            if (Array.isArray(x[i])) {
                innerInplace(x[i])
            } else {
                x[i] = shallowConcretize(x[i])
            }
        }
    }
    if (Array.isArray(value)) {
        innerInplace(value)
        return value
    } else {
        return shallowConcretize(value)
    }
}

export function shallowConcretize(value: any) {
    if (isHybrid(value)) {
        return value.concrete
    } else {
        return value
    }
}

function getAST(v: any): es.Expression {
    if (isHybrid(v)) {
        return v.symbolic
    } else {
        return create.literal(v)
    }
}

export function evaluateHybridBinary(op: es.BinaryOperator, lhs: any, rhs: any) {
    if (Array.isArray(shallowConcretize(lhs)) || Array.isArray(shallowConcretize(rhs))) {
        return hybridValueConstructor(evaluateBinaryExpression(op, shallowConcretize(lhs), shallowConcretize(rhs)), create.literal(false))
    } else if (isHybrid(lhs) || isHybrid(rhs)) {
        const val = evaluateBinaryExpression(op, shallowConcretize(lhs), shallowConcretize(rhs))
        let res
        if (op === '!==') {
            res = hybridValueConstructor(val, neqRefine(lhs, rhs))
        } else {
            res = hybridValueConstructor(val, create.binaryExpression(op, getAST(lhs), getAST(rhs)))
        }
        const neg = getNegation(op, lhs, rhs)
        if (neg !== undefined) {
            res.negation = neg
        }
        return res
    } else {
        return evaluateBinaryExpression(op, lhs, rhs)
    }
}

function neqRefine(lhs: any, rhs: any) {
    let op: es.BinaryOperator = shallowConcretize(lhs) < shallowConcretize(rhs) ? '<' : '>'
    return create.binaryExpression(op, getAST(lhs), getAST(rhs))
}

function getNegation(op: es.BinaryOperator, lhs: any, rhs: any){
    const fromOp = ['>', '>=', '<', '<=', '!==']
    const toOp : es.BinaryOperator[] = ['<=', '<', '>=', '>', '===']
    const ix = fromOp.indexOf(op)
    if (ix>-1) {
        return create.binaryExpression(toOp[ix], getAST(lhs), getAST(rhs))
    }
    if (op === '===') {
        return neqRefine(lhs, rhs)
    }
    return undefined
}

export function evaluateHybridUnary(op: es.UnaryOperator, val: any) {
    if (isHybrid(val)) {
        return hybridValueConstructor(evaluateUnaryExpression(op, shallowConcretize(val)), getAST(val))
    } else {
        return evaluateUnaryExpression(op, val)
    }
}

export const stdlibReplace = {
    tail: function(value: any) {
        const conc = shallowConcretize(value)
        const concResult = stdList.tail(conc)
        if (!isHybridArray(value)) {
            return concResult
        }

        const newExpr = create.binaryExpression('-', value.symbolic, create.literal(1))
        const newHeads = value.listHeads.concat([value])
        return hybridArrayConstructor(concResult, newExpr, newHeads)
    },
    pair: function(head: any, tail: any) {
        const concHead = shallowConcretize(head)
        const concTail = shallowConcretize(tail)
        const concResult = stdList.pair(concHead, concTail)
        if (!isHybridArray(tail)) {
            return concResult
        }

        const newExpr = create.binaryExpression('+', tail.symbolic, create.literal(1))
        const newHeads = tail.listHeads
        const newHybrid = hybridArrayConstructor(concResult, newExpr, newHeads)
        tail.listHeads.push(newHybrid)
        return newHybrid
    },
    // TODO: add some kind of wrapper for this for stream mode
    is_null: function(value: any) {
        const conc = shallowConcretize(value)
        const concResult = stdList.is_null(conc)
        if (!isHybridArray(value)) {
            return concResult
        }
        if (value.invalid) {
            const result = hybridValueConstructor(concResult, create.literal(concResult))
            result.invalid = true
            return result
        } else {
            const newExpr = create.binaryExpression('===', value.symbolic, create.literal(0))
            const negation = create.binaryExpression('>', value.symbolic, create.literal(0))
            const result = hybridValueConstructor(concResult, newExpr)
            result.negation = negation
            return 
        }
    },
    set_tail: function(original: any, newTail: any) {
        const concHead = shallowConcretize(original)
        const concTail = shallowConcretize(newTail)
        stdList.set_tail(concHead, concTail)
        if (isHybridArray(original)) {
            for (const item of [original].concat(original.listHeads)) {
                item.invalid = true
            }
        }
    },
}