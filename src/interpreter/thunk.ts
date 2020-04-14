import * as es from 'estree'
import { Context, Value } from '../types'

export type EvaluateFunction = (node: es.Node, context: Context) => Generator<any>

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

export default class Thunk {
  public isEvaluated: boolean
  public result: Value
  public originalNode: es.Node
  public context: Context
  public evaluate: EvaluateFunction

  constructor(public node: es.Node, context: Context, evaluate: EvaluateFunction) {
    this.originalNode = node
    this.isEvaluated = false
    this.result = null
    this.context = getContextWithIndependentEnvironment(context)
    this.evaluate = evaluate
    // @ts-ignore
    this.inspect = (_depth: any, _opts: any) => this.toString()
    this.toString = () => '[Thunk <' + this.originalNode.type + '>]'
  }

  public *dethunk(): Value {
    if (!this.isEvaluated) {
      this.result = yield* this.evaluate(this.node, this.context)
      this.isEvaluated = true
    }
    return this.result instanceof Thunk ? this.result.dethunk() : this.result
  }
}

export function* dethunk(thunk: Thunk | Value): Value {
  return thunk instanceof Thunk ? yield* thunk.dethunk() : thunk
}

/**
 * deepDethunk is only needed for non-thunk-aware functions
 */
export function* deepDethunk(thunk: Thunk | Value): Value {
  const value = thunk instanceof Thunk ? yield* thunk.dethunk() : thunk
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = yield* deepDethunk(value[i])
    }
  }
  return value
}

export function isThunkAware(fun: Value): boolean {
  if (fun.hasOwnProperty('isThunkAware')) {
    return fun.isThunkAware
  }
  return false
}

type MakeThunkAwareResult = (...args: Value[]) => IterableIterator<Value>

export function makeThunkAware(fun: Value, thisContext?: Value): MakeThunkAwareResult {
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
