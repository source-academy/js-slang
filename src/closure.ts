/* tslint:disable:max-classes-per-file */
import { generate } from 'astring'
import * as es from 'estree'

import { apply } from './interpreter'
import { Context, Environment, Value } from './types'

const closureToJS = (value: Closure, context: Context, klass: string) => {
  function DummyClass(this: Closure) {
    const args: Value[] = Array.prototype.slice.call(arguments)
    const gen = apply(context, value, args, undefined, this)
    let it = gen.next()
    while (!it.done) {
      it = gen.next()
    }
    return it.value
  }
  Object.defineProperty(DummyClass, 'name', {
    value: klass
  })
  Object.setPrototypeOf(DummyClass, () => undefined)
  Object.defineProperty(DummyClass, 'Inherits', {
    value: (Parent: Value) => {
      DummyClass.prototype = Object.create(Parent.prototype)
      DummyClass.prototype.constructor = DummyClass
    }
  })
  DummyClass.toString = () => generate(value.originalNode)
  DummyClass.call = (thisArg: Value, ...args: Value[]): any => {
    return DummyClass.apply(thisArg, args)
  }
  return DummyClass
}

class Callable extends Function {
  constructor(f: any) {
    super()
    return Object.setPrototypeOf(f, new.target.prototype)
  }
}

/**
 * Models function value in the interpreter environment.
 */
export default class Closure extends Callable {
  public static makeFromArrowFunction(
    node: es.ArrowFunctionExpression,
    environment: Environment,
    context: Context
  ) {
    function isExpressionBody(body: es.BlockStatement | es.Expression): body is es.Expression {
      return body.type !== 'BlockStatement'
    }

    let closure = null
    if (isExpressionBody(node.body)) {
      closure = new Closure(
        {
          type: 'FunctionExpression',
          loc: node.loc,
          id: null,
          params: node.params,
          body: {
            type: 'BlockStatement',
            loc: node.body.loc,
            body: [
              {
                type: 'ReturnStatement',
                loc: node.body.loc,
                argument: node.body
              }
            ]
          } as es.BlockStatement
        } as es.FunctionExpression,
        environment,
        context
      )
    } else {
      closure = new Closure(
        {
          type: 'FunctionExpression',
          loc: node.loc,
          id: null,
          params: node.params,
          body: node.body
        } as es.FunctionExpression,
        environment,
        context
      )
    }

    // Set the closure's nod to point back at the original one
    closure.originalNode = node

    return closure
  }

  /** Keep track how many lambdas are created */
  private static lambdaCtr = 0

  /** Unique ID defined for anonymous closure */
  public functionName: string

  /** Fake closure function */
  // tslint:disable-next-line:ban-types
  public fun: Function

  /** The original node that created this Closure */
  public originalNode: es.Function

  constructor(
    public node: es.FunctionExpression,
    public environment: Environment,
    context: Context
  ) {
    super(function(this: any, ...args: any[]) {
      return funJS.apply(this, args)
    })
    this.originalNode = node
    if (this.node.id) {
      this.functionName = this.node.id.name
    } else {
      this.functionName = `Anonymous${++Closure.lambdaCtr}`
    }
    // TODO: Investigate how relevant this really is.
    // .fun seems to only be used in interpreter's NewExpression handler, which uses .fun.prototype.
    const funJS = closureToJS(this, context, this.functionName)
    this.fun = funJS
  }

  public toString(): string {
    return generate(this.originalNode)
  }
}
