import * as t from './types'
import { Scope } from './types'

import { Context, Type } from '../types'

import * as create from '../utils/typeAstCreator'

function numberXnumberRnumber() {
  // const num = new t.Number()
  const num = new t.Float()
  return new t.Function([num, num], num)
}

function numberXnumberRfloat() {
  // const num = new t.Number()
  const num = new t.Float()
  return new t.Function([num, num], new t.Float())
}

function comparableXcomparableRcomparable() {
  const comparable = new t.Comparable()
  return new t.Function([comparable, comparable], comparable)
}

function comparableXcomparableRBool() {
  const comparable = new t.Comparable()
  return new t.Function([comparable, comparable], new t.Bool())
}

export const UNARY_MINUS_OPERATOR = 'unary-'

/**
 * Creates an initial environment that contains types for primitive operators.
 * @returns The initial environment.
 */
export function createEnv(context: Context): t.Environment {
  const env = new Scope(false)

  // logical operators
  let type = new t.Var()
  env.set('||', new t.Function([new t.Bool(), type], type))
  type = new t.Var()
  env.set('&&', new t.Function([new t.Bool(), type], type))

  // unary operators
  env.set('!', new t.Function([new t.Bool()], new t.Bool()))
  env.set(UNARY_MINUS_OPERATOR, new t.Function([new t.Float()], new t.Float()))

  // binary operators
  env.set('+', comparableXcomparableRcomparable())
  env.set('-', numberXnumberRnumber())
  env.set('*', numberXnumberRnumber())
  env.set('/', numberXnumberRfloat())
  env.set('%', numberXnumberRnumber())

  env.set('===', comparableXcomparableRBool())
  env.set('!==', comparableXcomparableRBool())
  env.set('<', comparableXcomparableRBool())
  env.set('<=', comparableXcomparableRBool())
  env.set('>', comparableXcomparableRBool())
  env.set('>=', comparableXcomparableRBool())

  let headType = new t.Var()
  let tailType = new t.Var()
  env.set('pair', new t.Function([headType, tailType], new t.Pair(headType, tailType)))
  headType = new t.Var()
  tailType = new t.Var()
  env.set('tail', new t.Function([new t.Pair(headType, tailType)], tailType))
  headType = new t.Var()
  tailType = new t.Var()
  env.set('head', new t.Function([new t.Pair(headType, tailType)], headType))
  type = new t.Var()
  env.set('is_null', new t.Function([new t.Pair(type, new t.List(type))], new t.Bool()))
  env.set('is_pair', new t.Function([new t.Var()], new t.Bool()))

  env.set('display', new t.Var())
  env.set('stringify', new t.Function([new t.Var()], new t.String()))
  return [env, null]
}

export function toJson(nativeType: t.Type): Type {
  const mappings: Map<string, string> = new Map()
  const counterMap: Map<string, number> = new Map([
    ['T', 1],
    ['Number', 1],
    ['Addable', 1]
  ])
  function createName(longName: string, description: string): Type {
    let name = mappings?.get(longName)
    if (name === undefined) {
      const n = counterMap.get(description)!
      name = description + n
      counterMap.set(description, n + 1)
      // tslint:disable-next-line:no-console
      mappings.set(longName, name)
    }
    return create.variable(name)
  }
  function helper(type: t.Type): Type {
    if (type instanceof t.InternalError) {
      // we short circuit immediately, this is untypable!
      throw new t.InternalError()
    } else if (type instanceof t.String) {
      return create.primitive('string')
    } else if (type instanceof t.Integer) {
      return create.primitive('integer')
    } else if (type instanceof t.Float) {
      return create.primitive('number')
    } else if (type instanceof t.Bool) {
      return create.primitive('boolean')
    } else if (type instanceof t.Undefined) {
      return create.primitive('undefined')
    } else if (type instanceof t.Function) {
      return create.fn(type.argTypes.map(helper), helper(type.retType))
    } else if (type instanceof t.Var && type.instance !== null) {
      return helper(type.instance)
    } else if (type instanceof t.List) {
      return create.list(helper(type.types[0]))
    } else if (type instanceof t.Pair) {
      const head = helper(type.types[0])
      const tail = helper(type.types[1])
      if (tail.kind === 'list' && JSON.stringify(tail.elementType) === JSON.stringify(head)) {
        return tail
      }
      return create.pair(head, tail)
    } else if (type instanceof t.Number) {
      return createName(type.name, 'Number')
    } else if (type instanceof t.Comparable) {
      return createName(type.name, 'Addable')
    } else if (type instanceof t.Var) {
      return createName(type.name, 'T')
    }
    throw Error('Unknown type!')
  }
  return helper(nativeType)
}

export function clone<T>(object: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(object)), object)
}

/**
 * Unchains variables until it gets to a type or a variable without an instance. Unused.
 * @param type  The type to be pruned.
 * @returns The pruned type.
 */
export function prune(type: t.Type): t.Type {
  if (type instanceof t.Var && type.instance) {
    type.instance = prune(type.instance)
    return type.instance
  }
  return type
}
