import { generate } from 'astring'
import * as es from 'estree'

import {
  currentEnvironment,
  hasReturnStatement,
  isBlockStatement,
  isStatementSequence,
  uniqueId
} from '../cse-machine/utils'
import { Context, Environment, StatementSequence, Value } from '../types'
import {
  blockArrowFunction,
  blockStatement,
  callExpression,
  identifier,
  literal,
  returnStatement
} from '../utils/ast/astCreator'
import { apply } from './interpreter'

const closureToJS = (value: Closure, context: Context, hasDeclaredName: boolean) => {
  function DummyClass(this: Closure) {
    const args: Value[] = [...arguments]
    const node = callExpression(
      // Use function name if there is one so environments that get created will have this name.
      // Else, treat the closure as a literal so it can get directly pushed into the stash next.
      hasDeclaredName ? identifier(value.functionName) : literal(value as any),
      args
    )
    return apply(context, node)
  }
  Object.defineProperty(DummyClass, 'name', {
    value: value.functionName
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
 * Models function value in the CSE machine.
 */
export default class Closure extends Callable {
  public static makeFromArrowFunction(
    node: es.ArrowFunctionExpression,
    environment: Environment,
    context: Context,
    dummyReturn?: boolean,
    predefined?: boolean
  ) {
    const functionBody: es.BlockStatement | StatementSequence =
      !isBlockStatement(node.body) && !isStatementSequence(node.body)
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
  public readonly id: string

  /** String representation of the closure */
  public functionName: string

  /** Fake closure function */
  public fun: Function

  /** Keeps track of whether the closure is a pre-defined function */
  public predefined: boolean

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
    this.id = uniqueId(context)
    currentEnvironment(context).heap.add(this)
    let hasDeclaredName = false
    if (this.node.type === 'FunctionDeclaration' && this.node.id !== null) {
      this.functionName = this.node.id.name
      hasDeclaredName = true
    } else {
      this.functionName =
        (this.node.params.length === 1 ? '' : '(') +
        this.node.params.map((o: es.Identifier) => o.name).join(', ') +
        (this.node.params.length === 1 ? '' : ')') +
        ' => ...'
    }
    const funJS = closureToJS(this, context, hasDeclaredName)
    this.fun = funJS
    this.predefined = isPredefined ?? false
  }

  public toString(): string {
    return generate(this.originalNode)
  }
}
