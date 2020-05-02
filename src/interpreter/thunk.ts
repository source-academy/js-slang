import * as es from 'estree'
import { Context, Value } from '../types'
import { forceEvaluate } from './interpreter'

/**
 * Returns a copy of `context` where `context.runtime.environments` is shallow-copied.
 *
 * In lazy-evaluation mode, delayed evaluations are stored as a `Thunk`.
 * A `Thunk` contains a node and a context.
 * Because `context` is mutable, a mutation to the `context` outside a `Thunk` can mutate the context inside the `Thunk`.
 * This function is created to resolve that issue.
 */
function getContextWithIndependentEnvironment(context: Context): Context {
  const result = {
    ...context,
    runtime: {
      ...context.runtime,
      environments: [...context.runtime.environments]
    }
  }
  return result
}

/**
 * `Thunk` represents a delayed evaluation.
 */
export default class Thunk {
  public isEvaluated: boolean
  public result: Value
  public originalNode: es.Node
  public context: Context

  constructor(public node: es.Node, context: Context) {
    this.originalNode = node
    this.isEvaluated = false
    this.result = null
    this.context = getContextWithIndependentEnvironment(context)
    // @ts-ignore
    this.inspect = (_depth: any, _opts: any) => this.toString()
    this.toString = () => '[Thunk <' + this.originalNode.type + '>]'
  }

  /**
   * Dethunks the `Thunk` and returns the dethunked result.
   */
  public *dethunk(): Value {
    if (!this.isEvaluated) {
      this.result = yield* forceEvaluate(this.node, this.context)
      this.isEvaluated = true
    }
    return this.result instanceof Thunk ? this.result.dethunk() : this.result
  }
}

/**
 * Dethunks `value`.
 *
 * If `value` is not a `Thunk`, this function simply returns `value`.
 *
 * @param value the value to be dethunked
 * @returns the dethunked value
 */
export function* dethunk(value: Value): Value {
  return value instanceof Thunk ? yield* value.dethunk() : value
}

/**
 * Deep-dethunks `value`.
 *
 * `dethunk` only checks whether its argument is a `Thunk`, it does not check the content of the argument.
 * `deepDethunk` behaves the same as `dethunk`, except that if `value` is an array,
 * its elements will be deep-dethunked recursively.
 * @param value the value to be deep-dethunked
 * @returns the deep-dethunked value
 */
export function* deepDethunk(value: Value): Value {
  const result = value instanceof Thunk ? yield* value.dethunk() : value
  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; i++) {
      result[i] = yield* deepDethunk(result[i])
    }
  }
  return result
}

/**
 * Checks whether `fun` is thunk-aware.
 *
 * A function is thunk-aware if it can accept a `Thunk` as an argument.
 * Most of built-in functions are not thunk-aware.
 * To distinguish thunk-aware functions from non-thunk-aware functions,
 * all thunk-aware functions are required to have the property `isThunkAware`
 * to be set to `true`.
 * @param fun the function to be checked
 * @returns true if `fun` is thunk-aware, `false` otherwise
 */
export function isThunkAware(fun: Value): boolean {
  if (fun.hasOwnProperty('isThunkAware')) {
    return fun.isThunkAware
  }
  return false
}

type ThunkAwareFuntion = (...args: Value[]) => IterableIterator<Value>

/**
 * Returns the thunk-aware version of `fun`.
 */
export function makeThunkAware(fun: Value, thisContext?: Value): ThunkAwareFuntion {
  function* wrapper(...args: Value[]): IterableIterator<Value> {
    if (isThunkAware(fun)) {
      return yield* fun.apply(thisContext, args)
    }
    const dethunkedArgs = [...args]
    for (let i = 0; i < dethunkedArgs.length; i++) {
      dethunkedArgs[i] = yield* deepDethunk(dethunkedArgs[i])
    }
    return fun.apply(thisContext, dethunkedArgs)
  }
  wrapper.isThunkAware = true
  return wrapper
}
