import { generate } from 'astring'
import type es from 'estree'

import {
  currentEnvironment,
  currentTransformers,
  hasReturnStatement,
  isBlockStatement,
  isStatementSequence,
  uniqueId
} from '../cse-machine/utils'
import type { Context, Environment, StatementSequence, Value } from '../types'
import * as ast from '../utils/ast/astCreator'
import { envInstr } from './instrCreator'
import { Control, Stash, Transformers, generateCSEMachineStateStream } from './interpreter'

const closureToJS = (value: Closure, context: Context) => {
  function DummyClass(this: Closure) {
    const args: Value[] = [...arguments]
    const node = ast.callExpression(
      ast.literal(value as any, value.node.loc),
      args.map(arg => ast.primitive(arg))
    )
    // Create a new CSE Machine with the same context as the current one, but with
    // the control reset to only contain the call expression, and the stash emptied.
    const newContext: Context = {
      ...context,
      runtime: {
        ...context.runtime,
        // Only environments are intended to be mutated by the new CSE Machine, the
        // rest of the runtime properties should stay the same
        nodes: [...context.runtime.nodes],
        breakpointSteps: [...context.runtime.breakpointSteps],
        changepointSteps: [...context.runtime.changepointSteps],
        debuggerOn: false
      }
    }
    newContext.runtime.control = new Control()
    // Also need the env instruction to return back to the current environment at the end.
    // The call expression won't create one as there is only one item in the control.
    newContext.runtime.control.push(
      envInstr(currentEnvironment(context), currentTransformers(context), node),
      node
    )
    newContext.runtime.stash = new Stash()
    newContext.runtime.transformers = context.runtime.transformers
    const gen = generateCSEMachineStateStream(
      newContext,
      newContext.runtime.control,
      newContext.runtime.stash,
      -1,
      -1
    )
    // Run the new CSE Machine fully to obtain the result in the stash
    for (const _ of gen) {
    }
    // Also don't forget to update object count in original context
    context.runtime.objectCount = newContext.runtime.objectCount
    return newContext.runtime.stash.peek()
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
    transformers: Transformers,
    context: Context,
    dummyReturn?: boolean,
    predefined?: boolean
  ) {
    const functionBody: es.BlockStatement | StatementSequence =
      !isBlockStatement(node.body) && !isStatementSequence(node.body)
        ? ast.blockStatement([ast.returnStatement(node.body, node.body.loc)], node.body.loc)
        : dummyReturn && !hasReturnStatement(node.body)
          ? ast.blockStatement(
              [
                ...node.body.body,
                ast.returnStatement(ast.identifier('undefined', node.body.loc), node.body.loc)
              ],
              node.body.loc
            )
          : node.body

    const closure = new Closure(
      ast.blockArrowFunction(node.params as es.Identifier[], functionBody, node.loc),
      environment,
      transformers,
      context,
      predefined
    )

    // Set the closure's node to point back at the original one
    closure.originalNode = node

    return closure
  }

  /** Unique ID defined for closure */
  public readonly id: string

  /** Name of the constant declaration that the closure is assigned to */
  public declaredName?: string

  /** String representation of the closure, e.g. `x => ...` */
  public functionName: string

  /** Fake closure function */
  public fun: Function

  /** Keeps track of whether the closure is a pre-defined function */
  public predefined: boolean

  /** The original node that created this Closure */
  public originalNode: es.ArrowFunctionExpression

  constructor(
    public node: es.ArrowFunctionExpression,
    public environment: Environment,
    public transformers: Transformers,
    context: Context,
    isPredefined?: boolean
  ) {
    super(function (this: any, ...args: any[]) {
      return funJS.apply(this, args)
    })
    this.originalNode = node
    this.id = uniqueId(context)
    currentEnvironment(context).heap.add(this)
    const params = this.node.params.map((o: es.Identifier | es.RestElement) =>
      o.type === 'RestElement' ? '...' + (o.argument as es.Identifier).name : o.name
    )
    this.functionName = params.join(', ')
    if (params.length !== 1 || params[0].startsWith('...')) {
      this.functionName = '(' + this.functionName + ')'
    }
    this.functionName += ' => ...'
    const funJS = closureToJS(this, context)
    this.fun = funJS
    this.predefined = isPredefined ?? false
  }

  public toString(): string {
    return generate(this.originalNode)
  }
}
