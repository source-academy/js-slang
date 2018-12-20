/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import Closure from './closure'
import * as constants from './constants'
import * as errors from './interpreter-errors'
import { Context, Environment, ErrorSeverity, Frame, SourceError, Value } from './types'
import { createNode } from './utils/node'
import * as rttc from './utils/rttc'

class BreakValue {}

class ContinueValue {}

class ReturnValue {
  constructor(public value: Value) {}
}

class TailCallReturnValue {
  constructor(public callee: Closure, public args: Value[], public node: es.CallExpression) {}
}

const createFrame = (
  closure: Closure,
  args: Value[],
  callExpression?: es.CallExpression
): Frame => {
  const frame: Frame = {
    name: closure.functionName, // TODO: Change this
    parent: closure.frame,
    environment: {}
  }
  if (callExpression) {
    frame.callExpression = {
      ...callExpression,
      arguments: args.map(a => createNode(a) as es.Expression)
    }
  }
  closure.node.params.forEach((param, index) => {
    const ident = param as es.Identifier
    frame.environment[ident.name] = args[index]
  })
  return frame
}

const createBlockFrame = (
  context: Context,
  name = 'blockFrame',
  environment: Environment = {}
): Frame => {
  return {
    name,
    parent: currentFrame(context),
    environment,
    thisContext: context
  }
}

const handleError = (context: Context, error: SourceError) => {
  context.errors.push(error)
  if (error.severity === ErrorSeverity.ERROR) {
    const globalFrame = context.runtime.frames[context.runtime.frames.length - 1]
    context.runtime.frames = [globalFrame]
    throw error
  } else {
    return context
  }
}

const handleRuntimeError = (context: Context, error: errors.RuntimeSourceError): never => {
  context.errors.push(error)
  const globalFrame = context.runtime.frames[context.runtime.frames.length - 1]
  context.runtime.frames = [globalFrame]
  throw error
}

const HOISTED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement hoisting')

function hoistIdentifier(context: Context, name: string, node: es.Node) {
  const frame = currentFrame(context)
  if (frame.environment.hasOwnProperty(name)) {
    handleRuntimeError(context, new errors.VariableRedeclaration(node, name))
  }
  frame.environment[name] = HOISTED_BUT_NOT_YET_ASSIGNED
  return frame
}

function hoistVariableDeclarations(context: Context, node: es.VariableDeclaration) {
  for (const declaration of node.declarations) {
    hoistIdentifier(context, (declaration.id as es.Identifier).name, node)
  }
}

function hoistFunctionsAndVariableDeclarationsIdentifiers(
  context: Context,
  node: es.BlockStatement
) {
  for (const statement of node.body) {
    switch (statement.type) {
      case 'VariableDeclaration':
        hoistVariableDeclarations(context, statement)
        break
      case 'FunctionDeclaration':
        hoistIdentifier(context, (statement.id as es.Identifier).name, node)
        break
    }
  }
}

function defineVariable(context: Context, name: string, value: Value, constant = false) {
  const frame = context.runtime.frames[0]

  if (frame.environment[name] !== HOISTED_BUT_NOT_YET_ASSIGNED) {
    handleRuntimeError(context, new errors.VariableRedeclaration(context.runtime.nodes[0]!, name))
  }

  Object.defineProperty(frame.environment, name, {
    value,
    writable: !constant,
    enumerable: true
  })

  return frame
}

function* visit(context: Context, node: es.Node) {
  context.runtime.nodes.unshift(node)
  yield context
}

function* leave(context: Context) {
  context.runtime.nodes.shift()
  yield context
}

const currentFrame = (context: Context) => context.runtime.frames[0]
const replaceFrame = (context: Context, frame: Frame) => (context.runtime.frames[0] = frame)
const popFrame = (context: Context) => context.runtime.frames.shift()
const pushFrame = (context: Context, frame: Frame) => context.runtime.frames.unshift(frame)

const getVariable = (context: Context, name: string) => {
  let frame: Frame | null = context.runtime.frames[0]
  while (frame) {
    if (frame.environment.hasOwnProperty(name)) {
      if (frame.environment[name] === HOISTED_BUT_NOT_YET_ASSIGNED) {
        handleRuntimeError(context, new errors.UnassignedVariable(name, context.runtime.nodes[0]))
      } else {
        return frame.environment[name]
      }
    } else {
      frame = frame.parent
    }
  }
  handleRuntimeError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
}

const setVariable = (context: Context, name: string, value: any) => {
  let frame: Frame | null = context.runtime.frames[0]
  while (frame) {
    if (frame.environment.hasOwnProperty(name)) {
      if (frame.environment[name] === HOISTED_BUT_NOT_YET_ASSIGNED) {
        break
      }
      const descriptors = Object.getOwnPropertyDescriptors(frame.environment)
      if (descriptors[name].writable) {
        frame.environment[name] = value
        return
      }
      handleRuntimeError(context, new errors.ConstAssignment(context.runtime.nodes[0]!, name))
    } else {
      frame = frame.parent
    }
  }
  handleRuntimeError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
}

const checkNumberOfArguments = (
  context: Context,
  callee: Closure,
  args: Value[],
  exp: es.CallExpression
) => {
  if (callee.node.params.length !== args.length) {
    handleRuntimeError(
      context,
      new errors.InvalidNumberOfArguments(exp, callee.node.params.length, args.length)
    )
  }
}

function* getArgs(context: Context, call: es.CallExpression) {
  const args = []
  for (const arg of call.arguments) {
    args.push(yield* evaluate(arg, context))
  }
  return args
}

function transformLogicalExpression(node: es.LogicalExpression): es.ConditionalExpression {
  if (node.operator === '&&') {
    return {
      type: 'ConditionalExpression',
      test: node.left,
      consequent: node.right,
      alternate: createNode(false)
    } as es.ConditionalExpression
  } else {
    return {
      type: 'ConditionalExpression',
      test: node.left,
      consequent: createNode(true),
      alternate: node.right
    } as es.ConditionalExpression
  }
}

function* reduceIf(node: es.IfStatement | es.ConditionalExpression, context: Context) {
  const test = yield* evaluate(node.test, context)

  const error = rttc.checkIfStatement(context, test)
  if (error) {
    handleError(context, error)
    return undefined
  }

  return test ? node.consequent : node.alternate
}

export type Evaluator<T extends es.Node> = (node: T, context: Context) => IterableIterator<Value>

/**
 * WARNING: Do not use object literal shorthands, e.g.
 *   {
 *     *Literal(node: es.Literal, ...) {...},
 *     *ThisExpression(node: es.ThisExpression, ..._ {...},
 *     ...
 *   }
 * They do not minify well, raising uncaught syntax errors in production.
 * See: https://github.com/webpack/webpack/issues/7566
 */
export const evaluators: { [nodeType: string]: Evaluator<es.Node> } = {
  /** Simple Values */

  *Literal(node: es.Literal, context: Context) {
    return node.value
  },

  *ThisExpression(node: es.ThisExpression, context: Context) {
    return context.runtime.frames[0].thisContext
  },

  *ArrayExpression(node: es.ArrayExpression, context: Context) {
    const res = []
    for (const n of node.elements) {
      res.push(yield* evaluate(n, context))
    }
    return res
  },

  *FunctionExpression(node: es.FunctionExpression, context: Context) {
    return new Closure(node, currentFrame(context), context)
  },

  *ArrowFunctionExpression(node: es.ArrowFunctionExpression, context: Context) {
    return Closure.makeFromArrowFunction(node, currentFrame(context), context)
  },

  *Identifier(node: es.Identifier, context: Context) {
    return getVariable(context, node.name)
  },

  *CallExpression(node: es.CallExpression, context: Context) {
    const callee = yield* evaluate(node.callee, context)
    const args = yield* getArgs(context, node)
    let thisContext
    if (node.callee.type === 'MemberExpression') {
      thisContext = yield* evaluate(node.callee.object, context)
    }
    const result = yield* apply(context, callee, args, node, thisContext)
    return result
  },

  *NewExpression(node: es.NewExpression, context: Context) {
    const callee = yield* evaluate(node.callee, context)
    const args = []
    for (const arg of node.arguments) {
      args.push(yield* evaluate(arg, context))
    }
    const obj: Value = {}
    if (callee instanceof Closure) {
      obj.__proto__ = callee.fun.prototype
      callee.fun.apply(obj, args)
    } else {
      obj.__proto__ = callee.prototype
      callee.apply(obj, args)
    }
    return obj
  },

  *UnaryExpression(node: es.UnaryExpression, context: Context) {
    const value = yield* evaluate(node.argument, context)

    const error = rttc.checkUnaryExpression(context, node.operator, value)
    if (error) {
      handleError(context, error)
      return undefined
    }

    if (node.operator === '!') {
      return !value
    } else if (node.operator === '-') {
      return -value
    } else {
      return +value
    }
  },

  *BinaryExpression(node: es.BinaryExpression, context: Context) {
    const left = yield* evaluate(node.left, context)
    const right = yield* evaluate(node.right, context)

    const error = rttc.checkBinaryExpression(context, node.operator, left, right)
    if (error) {
      handleError(context, error)
      return undefined
    }
    let result
    switch (node.operator) {
      case '+':
        result = left + right
        break
      case '-':
        result = left - right
        break
      case '*':
        result = left * right
        break
      case '/':
        result = left / right
        break
      case '%':
        result = left % right
        break
      case '===':
        result = left === right
        break
      case '!==':
        result = left !== right
        break
      case '<=':
        result = left <= right
        break
      case '<':
        result = left < right
        break
      case '>':
        result = left > right
        break
      case '>=':
        result = left >= right
        break
      default:
        result = undefined
    }
    return result
  },

  *ConditionalExpression(node: es.ConditionalExpression, context: Context) {
    return yield* this.IfStatement(node, context)
  },

  *LogicalExpression(node: es.LogicalExpression, context: Context) {
    return yield* this.ConditionalExpression(transformLogicalExpression(node), context)
  },

  *VariableDeclaration(node: es.VariableDeclaration, context: Context) {
    const declaration = node.declarations[0]
    const constant = node.kind === 'const'
    const id = declaration.id as es.Identifier
    const value = yield* evaluate(declaration.init!, context)
    defineVariable(context, id.name, value, constant)
    return undefined
  },

  *ContinueStatement(node: es.ContinueStatement, context: Context) {
    return new ContinueValue()
  },

  *BreakStatement(node: es.BreakStatement, context: Context) {
    return new BreakValue()
  },

  *ForStatement(node: es.ForStatement, context: Context) {
    // Create a new block scope for the loop variables
    const loopFrame = createBlockFrame(context, 'forLoopFrame')
    pushFrame(context, loopFrame)

    const initNode = node.init!
    const testNode = node.test!
    const updateNode = node.update!
    if (initNode.type === 'VariableDeclaration') {
      hoistVariableDeclarations(context, initNode)
    }
    yield* evaluate(initNode, context)

    let value
    while (yield* evaluate(testNode, context)) {
      // create block context and shallow copy loop frame environment
      // see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
      // and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
      // We copy this as a const to avoid ES6 funkiness when mutating loop vars
      // https://github.com/source-academy/js-slang/issues/65#issuecomment-425618227
      const frame = createBlockFrame(context, 'forBlockFrame')
      pushFrame(context, frame)
      for (const name in loopFrame.environment) {
        if (loopFrame.environment.hasOwnProperty(name)) {
          hoistIdentifier(context, name, node)
          defineVariable(context, name, loopFrame.environment[name], true)
        }
      }

      value = yield* evaluate(node.body, context)

      // Remove block context
      popFrame(context)
      if (value instanceof ContinueValue) {
        value = undefined
      }
      if (value instanceof BreakValue) {
        value = undefined
        break
      }
      if (value instanceof ReturnValue || value instanceof TailCallReturnValue) {
        break
      }

      yield* evaluate(updateNode, context)
    }

    popFrame(context)

    return value
  },

  *MemberExpression(node: es.MemberExpression, context: Context) {
    let obj = yield* evaluate(node.object, context)
    if (obj instanceof Closure) {
      obj = obj.fun
    }
    let prop
    if (node.computed) {
      prop = yield* evaluate(node.property, context)
    } else {
      prop = (node.property as es.Identifier).name
    }
    if (
      obj !== null &&
      obj !== undefined &&
      typeof obj[prop] !== 'undefined' &&
      !obj.hasOwnProperty(prop)
    ) {
      handleRuntimeError(context, new errors.GetInheritedPropertyError(node, obj, prop))
    }
    try {
      return obj[prop]
    } catch {
      handleRuntimeError(context, new errors.GetPropertyError(node, obj, prop))
    }
  },

  *AssignmentExpression(node: es.AssignmentExpression, context: Context) {
    if (node.left.type === 'MemberExpression') {
      const left = node.left
      const obj = yield* evaluate(left.object, context)
      let prop
      if (left.computed) {
        prop = yield* evaluate(left.property, context)
      } else {
        prop = (left.property as es.Identifier).name
      }
      const val = yield* evaluate(node.right, context)
      try {
        obj[prop] = val
      } catch {
        handleRuntimeError(context, new errors.SetPropertyError(node, obj, prop))
      }
      return val
    }
    const id = node.left as es.Identifier
    // Make sure it exist
    const value = yield* evaluate(node.right, context)
    setVariable(context, id.name, value)
    return value
  },

  *FunctionDeclaration(node: es.FunctionDeclaration, context: Context) {
    const id = node.id as es.Identifier
    // tslint:disable-next-line:no-any
    const closure = new Closure(node as any, currentFrame(context), context)
    defineVariable(context, id.name, closure, true)
    return undefined
  },

  *IfStatement(node: es.IfStatement | es.ConditionalExpression, context: Context) {
    return yield* evaluate(yield* reduceIf(node, context), context)
  },

  *ExpressionStatement(node: es.ExpressionStatement, context: Context) {
    return yield* evaluate(node.expression, context)
  },

  *ReturnStatement(node: es.ReturnStatement, context: Context) {
    let returnExpression = node.argument!

    // If we have a conditional expression, reduce it until we get something else
    while (
      returnExpression.type === 'LogicalExpression' ||
      returnExpression.type === 'ConditionalExpression'
    ) {
      if (returnExpression.type === 'LogicalExpression') {
        returnExpression = transformLogicalExpression(returnExpression)
      }
      returnExpression = yield* reduceIf(returnExpression, context)
    }

    // If we are now left with a CallExpression, then we use TCO
    if (returnExpression.type === 'CallExpression') {
      const callee = yield* evaluate(returnExpression.callee, context)
      const args = yield* getArgs(context, returnExpression)
      return new TailCallReturnValue(callee, args, returnExpression)
    } else {
      return new ReturnValue(yield* evaluate(returnExpression, context))
    }
  },

  *WhileStatement(node: es.WhileStatement, context: Context) {
    let value: any // tslint:disable-line
    while (
      // tslint:disable-next-line
      (yield* evaluate(node.test, context)) &&
      !(value instanceof ReturnValue) &&
      !(value instanceof BreakValue) &&
      !(value instanceof TailCallReturnValue)
    ) {
      value = yield* evaluate(node.body, context)
    }
    if (value instanceof BreakValue) {
      return undefined
    }
    return value
  },

  *ObjectExpression(node: es.ObjectExpression, context: Context) {
    const obj = {}
    for (const prop of node.properties) {
      let key
      if (prop.key.type === 'Identifier') {
        key = prop.key.name
      } else {
        key = yield* evaluate(prop.key, context)
      }
      obj[key] = yield* evaluate(prop.value, context)
    }
    return obj
  },

  *BlockStatement(node: es.BlockStatement, context: Context) {
    let result: Value

    // Create a new frame (block scoping)
    const frame = createBlockFrame(context, 'blockFrame')
    pushFrame(context, frame)
    hoistFunctionsAndVariableDeclarationsIdentifiers(context, node)

    for (const statement of node.body) {
      result = yield* evaluate(statement, context)
      if (
        result instanceof ReturnValue ||
        result instanceof TailCallReturnValue ||
        result instanceof BreakValue ||
        result instanceof ContinueValue
      ) {
        break
      }
    }
    popFrame(context)
    return result
  },

  *Program(node: es.BlockStatement, context: Context) {
    hoistFunctionsAndVariableDeclarationsIdentifiers(context, node)
    let result: Value
    for (const statement of node.body) {
      result = yield* evaluate(statement, context)
      if (result instanceof ReturnValue || result instanceof TailCallReturnValue) {
        break
      }
    }
    return result
  }
}

export function* evaluate(node: es.Node, context: Context) {
  yield* visit(context, node)
  const result = yield* evaluators[node.type](node, context)
  yield* leave(context)
  return result
}

export function* apply(
  context: Context,
  fun: Closure | Value,
  args: Value[],
  node?: es.CallExpression,
  thisContext?: Value
) {
  let result: Value
  let total = 0

  while (!(result instanceof ReturnValue)) {
    if (fun instanceof Closure) {
      checkNumberOfArguments(context, fun, args, node!)
      const frame = createFrame(fun, args, node)
      frame.thisContext = thisContext
      if (result instanceof TailCallReturnValue) {
        replaceFrame(context, frame)
      } else {
        pushFrame(context, frame)
        total++
      }
      result = yield* evaluate(fun.node.body, context)
      if (result instanceof TailCallReturnValue) {
        fun = result.callee
        node = result.node
        args = result.args
      } else if (!(result instanceof ReturnValue)) {
        // No Return Value, set it as undefined
        result = new ReturnValue(undefined)
      }
    } else if (typeof fun === 'function') {
      try {
        result = fun.apply(thisContext, args)
        break
      } catch (e) {
        // Recover from exception
        const globalFrame = context.runtime.frames[context.runtime.frames.length - 1]
        context.runtime.frames = [globalFrame]
        const loc = node ? node.loc! : constants.UNKNOWN_LOCATION
        if (!(e instanceof errors.RuntimeSourceError)) {
          // The error could've arisen when the builtin called a source function which errored.
          // If the cause was a source error, we don't want to include the error.
          // However if the error came from the builtin itself, we need to handle it.
          handleRuntimeError(context, new errors.ExceptionError(e, loc))
        }
        result = undefined
        throw e
      }
    } else {
      handleRuntimeError(context, new errors.CallingNonFunctionValue(fun, node))
    }
  }
  // Unwraps return value and release stack frame
  if (result instanceof ReturnValue) {
    result = result.value
  }
  for (let i = 1; i <= total; i++) {
    popFrame(context)
  }
  return result
}
