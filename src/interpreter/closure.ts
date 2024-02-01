/* tslint:disable:max-classes-per-file */
import { generate } from 'astring'
import * as es from 'estree'
import { uniqueId } from 'lodash'

import { hasReturnStatement, isBlockStatement } from '../cse-machine/utils'
import { Context, Environment, Value } from '../types'
import {
  blockArrowFunction,
  blockStatement,
  callExpression,
  identifier,
  returnStatement
} from '../utils/astCreator'
import { apply } from './interpreter'

const closureToJS = (value: Closure, context: Context, klass: string) => {
  function DummyClass(this: Closure) {
    const args: Value[] = Array.prototype.slice.call(arguments)
    const gen = apply(context, value, args, callExpression(identifier(klass), args), this)
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
    context: Context,
    dummyReturn?: boolean,
    predefined?: boolean
  ) {
    const functionBody: es.BlockStatement = !isBlockStatement(node.body)
      ? blockStatement([returnStatement(node.body, node.body.loc)], node.body.loc)
      : dummyReturn && !hasReturnStatement(node.body)
      ? blockStatement(
          [
            ...node.body.body,
            returnStatement(identifier('undefined', node.body.loc), node.body.loc)
          ],
          node.body.loc
        )
      : node.body

    const closure = new Closure(
      blockArrowFunction(node.params as es.Identifier[], functionBody, node.loc),
      environment,
      context,
      predefined
    )

    // Set the closure's node to point back at the original one
    closure.originalNode = node

    return closure
  }

  /** Unique ID defined for closure */
  public id: string

  /** String representation of the closure */
  public functionName: string

  /** Fake closure function */
  // tslint:disable-next-line:ban-types
  public fun: Function

  /** Keeps track of whether the closure is a pre-defined function */
  public preDefined?: boolean

  /** The original node that created this Closure */
  public originalNode: es.Function

  constructor(
    public node: es.Function,
    public environment: Environment,
    context: Context,
    isPredefined?: boolean
  ) {
    super(function (this: any, ...args: any[]) {
      return funJS.apply(this, args)
    })
    this.originalNode = node
    this.id = uniqueId()
    if (this.node.type === 'FunctionDeclaration' && this.node.id !== null) {
      this.functionName = this.node.id.name
    } else {
      this.functionName =
        (this.node.params.length === 1 ? '' : '(') +
        this.node.params.map((o: es.Identifier) => o.name).join(', ') +
        (this.node.params.length === 1 ? '' : ')') +
        ' => ...'
    }
    // TODO: Investigate how relevant this really is.
    // .fun seems to only be used in interpreter's NewExpression handler, which uses .fun.prototype.
    const funJS = closureToJS(this, context, this.functionName)
    this.fun = funJS
    this.preDefined = isPredefined == undefined ? undefined : isPredefined
  }

  public toString(): string {
    return generate(this.originalNode)
  }
}
