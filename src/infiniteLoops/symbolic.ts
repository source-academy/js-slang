import * as es from 'estree'

import * as create from '../utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'

// data structure for symbolic + hybrid values

export enum Validity {
  Valid,
  NoSmt,
  NoCycle
}

function isInvalid(status: Validity) {
  return status !== Validity.Valid
}

export type HybridValue = {
  type: 'value'
  concrete: any
  symbolic: es.Expression
  negation?: es.Expression
  validity: Validity
}

export type HybridArray = {
  type: 'array'
  concrete: any
  symbolic: es.Expression
  validity: Validity
}

export type Hybrid = HybridValue | HybridArray

export function hybridizeNamed(name: string, value: any): Hybrid {
  if (isHybrid(value) || value === undefined || typeof value === 'function') {
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

function isConcreteValue(value: any) {
  return !(isHybrid(value) || Array.isArray(value))
}

export const hybridValueConstructor = (
  concrete: any,
  symbolic: es.Expression,
  validity = Validity.Valid
) =>
  ({
    type: 'value',
    concrete: concrete,
    symbolic: symbolic,
    validity: validity
  } as HybridValue)

export function makeDummyHybrid(concrete: any): HybridValue {
  if (!isConcreteValue(concrete)) {
    return concrete
  }
  const val: HybridValue = {
    type: 'value',
    concrete: concrete,
    symbolic: create.literal(concrete),
    validity: Validity.Valid
  }
  return val
}

export function getBooleanResult(value: HybridValue) {
  if (value.concrete) {
    return value.symbolic
  }
  if (value.negation !== undefined) {
    return value.negation
  } else {
    return create.unaryExpression('!', value.symbolic)
  }
}

export const hybridArrayConstructor = (
  concrete: any,
  symbolic: es.Expression,
  listHeads = [] as HybridArray[]
) =>
  ({
    type: 'array',
    concrete: concrete,
    symbolic: symbolic,
    listHeads: listHeads,
    validity: Validity.Valid
  } as HybridArray)

function makeHybridArray(name: string, concrete: any[]): HybridArray {
  // note single quotes used in generated indentifiers: quick hack to avoid name clashes
  let count = 0
  const visited: any[][] = []
  function innerInplace(x: any[]) {
    visited.push(x)
    for (let i = 0; i < x.length; i++) {
      if (Array.isArray(x[i])) {
        let skip = false
        for (const v of visited) {
          if (x[i] === v) skip = true
        }
        if (!skip) innerInplace(x[i])
      } else if (
        x[i] !== null &&
        x[i] !== undefined &&
        x[i].symbolic === undefined &&
        typeof x[i] === 'number'
      ) {
        x[i] = hybridValueConstructor(x[i], create.identifier(`${name}'${count++}`))
      }
    }
  }
  innerInplace(concrete)
  // NOTE: below symbolic value won't be used in SMT
  return hybridArrayConstructor(concrete, create.identifier(`${name}'array`))
}

export function deepConcretizeInplace(value: any) {
  const seen = new WeakSet()
  function innerInplace(x: any[]) {
    seen.add(x)
    for (let i = 0; i < x.length; i++) {
      if (Array.isArray(x[i])) {
        if (!seen.has(x[i])) {
          innerInplace(x[i])
        }
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
    return hybridValueConstructor(
      evaluateBinaryExpression(op, shallowConcretize(lhs), shallowConcretize(rhs)),
      create.literal(false)
    )
  } else if (isHybrid(lhs) || isHybrid(rhs)) {
    const val = evaluateBinaryExpression(op, shallowConcretize(lhs), shallowConcretize(rhs))
    if (isInvalid(lhs.validity) || isInvalid(rhs.validity)) {
      const result = makeDummyHybrid(val)
      result.validity = Math.max(lhs.validity, rhs.validity)
      return result
    }
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
    if (op === '!==' || op === '===') {
      const concIsNumber = (x: any) => typeof shallowConcretize(x) === 'number'
      if (!(concIsNumber(lhs) && concIsNumber(rhs))) {
        res.validity = Validity.NoSmt
      }
    }
    return res
  } else {
    return evaluateBinaryExpression(op, lhs, rhs)
  }
}

/**
 * To provide more information to the SMT solver, whenever '!==' is encountered
 * comparing 2 numbers, we replace it with '>' or '<' accordingly.
 */
function neqRefine(lhs: any, rhs: any) {
  const op: es.BinaryOperator = shallowConcretize(lhs) < shallowConcretize(rhs) ? '<' : '>'
  return create.binaryExpression(op, getAST(lhs), getAST(rhs))
}

function getNegation(op: es.BinaryOperator, lhs: any, rhs: any) {
  const fromOp = ['>', '>=', '<', '<=', '!==']
  const toOp: es.BinaryOperator[] = ['<=', '<', '>=', '>', '===']
  const ix = fromOp.indexOf(op)
  if (ix > -1) {
    return create.binaryExpression(toOp[ix], getAST(lhs), getAST(rhs))
  }
  if (op === '===') {
    return neqRefine(lhs, rhs)
  }
  return undefined
}

export function evaluateHybridUnary(op: es.UnaryOperator, val: any) {
  if (isHybrid(val)) {
    const conc = evaluateUnaryExpression(op, shallowConcretize(val))
    if (isInvalid(val.validity)) {
      const result = makeDummyHybrid(val)
      result.validity = val.validity
      return result
    }
    if (val.symbolic.type === 'Literal') {
      const newSym = { ...val.symbolic, val: conc }
      return hybridValueConstructor(conc, newSym)
    } else if (op === '!' && val.type === 'value' && val.negation !== undefined) {
      const result = hybridValueConstructor(conc, val.negation)
      result.negation = val.symbolic
      return result
    } else {
      return hybridValueConstructor(conc, create.unaryExpression(op, getAST(val)))
    }
  } else {
    return evaluateUnaryExpression(op, val)
  }
}
