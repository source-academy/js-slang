/* tslint:disable: max-classes-per-file */
/* tslint:disable: object-literal-shorthand*/
import * as es from 'estree'
import * as constants from './constants'
import { toString } from './interop'
import * as errors from './interpreter-errors'
import { Closure, Context, ErrorSeverity, Frame, SourceError, Value, Environment } from './types'
import { createNode } from './utils/node'
import * as rttc from './utils/rttc'

class ReturnValue {
  constructor(public value: Value) {}
}

class BreakValue {}

class ContinueValue {}

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
  const frame: Frame = {
    name,
    parent: currentFrame(context),
    environment,
    thisContext: context
  }
  return frame
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

const HOISTED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement hoisting')

function hoistIdentifier(context: Context, name: string, node: es.Node) {
  const frame = currentFrame(context)
  if (frame.environment.hasOwnProperty(name)) {
    handleError(context, new errors.VariableRedeclaration(node, name))
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
    handleError(context, new errors.VariableRedeclaration(context.runtime.nodes[0]!, name))
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
        handleError(context, new errors.UnassignedVariable(name, context.runtime.nodes[0]))
        break
      } else {
        return frame.environment[name]
      }
    } else {
      frame = frame.parent
    }
  }
  handleError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
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
      const error = new errors.ConstAssignment(context.runtime.nodes[0]!, name)
      handleError(context, error)
    } else {
      frame = frame.parent
    }
  }
  handleError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
}

const checkNumberOfArguments = (
  context: Context,
  callee: Closure,
  args: Value[],
  exp: es.CallExpression
) => {
  if (callee.node.params.length !== args.length) {
    const error = new errors.InvalidNumberOfArguments(exp, callee.node.params.length, args.length)
    handleError(context, error)
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
    return <es.ConditionalExpression>{
      type: 'ConditionalExpression',
      test: node.left,
      consequent: node.right,
      alternate: {
        type: 'Literal',
        value: false
      }
    }
  } else {
    return <es.ConditionalExpression>{
      type: 'ConditionalExpression',
      test: node.left,
      consequent: {
        type: 'Literal',
        value: true
      },
      alternate: node.right
    }
  }
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
  Literal: function*(node: es.Literal, context: Context) {
    return node.value
  },
  ThisExpression: function*(node: es.ThisExpression, context: Context) {
    return context.runtime.frames[0].thisContext
  },
  ArrayExpression: function*(node: es.ArrayExpression, context: Context) {
    const res = []
    for (const n of node.elements) {
      res.push(yield* evaluate(n, context))
    }
    return res
  },
  FunctionExpression: function*(node: es.FunctionExpression, context: Context) {
    return new Closure(node, currentFrame(context), context)
  },
  ArrowFunctionExpression: function*(node: es.ArrowFunctionExpression, context: Context) {
    return Closure.makeFromArrowFunction(node, currentFrame(context), context)
  },
  Identifier: function*(node: es.Identifier, context: Context) {
    return getVariable(context, node.name)
  },
  CallExpression: function*(node: es.CallExpression, context: Context) {
    const callee = yield* evaluate(node.callee, context)
    const args = yield* getArgs(context, node)
    let thisContext
    if (node.callee.type === 'MemberExpression') {
      thisContext = yield* evaluate(node.callee.object, context)
    }
    const result = yield* apply(context, callee, args, node, thisContext)
    return result
  },
  NewExpression: function*(node: es.NewExpression, context: Context) {
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
  UnaryExpression: function*(node: es.UnaryExpression, context: Context) {
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
  BinaryExpression: function*(node: es.BinaryExpression, context: Context) {
    let left = yield* evaluate(node.left, context)
    let right = yield* evaluate(node.right, context)

    const error = rttc.checkBinaryExpression(context, node.operator, left, right)
    if (error) {
      handleError(context, error)
      return undefined
    }
    let result
    switch (node.operator) {
      case '+':
        let isLeftString = typeof left === 'string'
        let isRightString = typeof right === 'string'
        if (isLeftString && !isRightString) {
          right = toString(right)
        } else if (isRightString && !isLeftString) {
          left = toString(left)
        }
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
  ConditionalExpression: function*(node: es.ConditionalExpression, context: Context) {
    return yield* this.IfStatement(node, context)
  },
  LogicalExpression: function*(node: es.LogicalExpression, context: Context) {
    return yield* this.IfStatement(transformLogicalExpression(node), context)
  },
  VariableDeclaration: function*(node: es.VariableDeclaration, context: Context) {
    const declaration = node.declarations[0]
    const constant = node.kind == 'const'
    const id = declaration.id as es.Identifier
    const value = yield* evaluate(declaration.init!, context)
    defineVariable(context, id.name, value, constant)
    return undefined
  },
  ContinueStatement: function*(node: es.ContinueStatement, context: Context) {
    return new ContinueValue()
  },
  BreakStatement: function*(node: es.BreakStatement, context: Context) {
    return new BreakValue()
  },
  ForStatement: function*(node: es.ForStatement, context: Context) {
    // Create a new block scope for the loop variables
    const loopFrame = createBlockFrame(context, 'forLoopFrame')
    pushFrame(context, loopFrame)

    if (node.init) {
      if (node.init.type === 'VariableDeclaration') {
        hoistVariableDeclarations(context, node.init)
      }
      yield* evaluate(node.init, context)
    }
    let test = node.test ? yield* evaluate(node.test, context) : true
    let value
    while (test) {
      // create block context and shallow copy loop frame environment
      // see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
      // and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
      // We copy this as a const to avoid ES6 funkiness when mutating loop vars
      // https://github.com/source-academy/js-slang/issues/65#issuecomment-425618227
      const frame = createBlockFrame(context, 'forBlockFrame')
      pushFrame(context, frame)
      for (let name in loopFrame.environment) {
        hoistIdentifier(context, name, node)
        defineVariable(context, name, loopFrame.environment[name], true)
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
      if (node.update) {
        yield* evaluate(node.update, context)
      }
      test = node.test ? yield* evaluate(node.test, context) : true
    }

    popFrame(context)

    if (value instanceof BreakValue) {
      return undefined
    }
    return value
  },
  MemberExpression: function*(node: es.MemberExpression, context: Context) {
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
    try {
      return obj[prop]
    } catch {
      handleError(context, new errors.GetPropertyError(node, obj, prop))
    }
  },
  AssignmentExpression: function*(node: es.AssignmentExpression, context: Context) {
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
        handleError(context, new errors.SetPropertyError(node, obj, prop))
      }
      return val
    }
    const id = node.left as es.Identifier
    // Make sure it exist
    const value = yield* evaluate(node.right, context)
    setVariable(context, id.name, value)
    return value
  },
  FunctionDeclaration: function*(node: es.FunctionDeclaration, context: Context) {
    const id = node.id as es.Identifier
    // tslint:disable-next-line:no-any
    const closure = new Closure(node as any, currentFrame(context), context)
    defineVariable(context, id.name, closure, true)
    return undefined
  },
  *IfStatement(node: es.IfStatement, context: Context) {
    const test = yield* evaluate(node.test, context)

    const error = rttc.checkIfStatement(context, test)
    if (error) {
      handleError(context, error)
      return undefined
    }
    if (test) {
      const result = yield* evaluate(node.consequent, context)
      return result
    } else if (node.alternate) {
      const result = yield* evaluate(node.alternate, context)
      return result
    } else {
      return undefined
    }
  },
  ExpressionStatement: function*(node: es.ExpressionStatement, context: Context) {
    return yield* evaluate(node.expression, context)
  },
  *ReturnStatement(node: es.ReturnStatement, context: Context) {
    let return_expression = node.argument
    if (!return_expression) {
      return new ReturnValue(undefined)
    }

    // If we have a conditional expression, reduce it until we get something else
    while (
      return_expression.type === 'LogicalExpression' ||
      return_expression.type === 'ConditionalExpression'
    ) {
      if (return_expression.type === 'LogicalExpression') {
        return_expression = transformLogicalExpression(return_expression)
      }
      const test = yield* evaluate(return_expression.test, context)
      const error = rttc.checkIfStatement(context, test)
      if (error) {
        handleError(context, error)
        return undefined
      }
      if (test) {
        return_expression = return_expression.consequent
      } else {
        return_expression = return_expression.alternate
      }
    }

    // If we are now left with a CallExpression, then we use TCO
    if (return_expression.type === 'CallExpression') {
      const callee = yield* evaluate(return_expression.callee, context)
      const args = yield* getArgs(context, return_expression)
      return new TailCallReturnValue(callee, args, return_expression)
    } else {
      return new ReturnValue(yield* evaluate(return_expression, context))
    }
  },
  WhileStatement: function*(node: es.WhileStatement, context: Context) {
    let value: any // tslint:disable-line
    while (
      // tslint:disable-next-line
      (test = yield* evaluate(node.test, context)) &&
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
  ObjectExpression: function*(node: es.ObjectExpression, context: Context) {
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
  BlockStatement: function*(node: es.BlockStatement, context: Context) {
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
  Program: function*(node: es.BlockStatement, context: Context) {
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
          handleError(context, new errors.ExceptionError(e, loc))
        }
        result = undefined
        throw e
      }
    } else {
      handleError(context, new errors.CallingNonFunctionValue(fun, node))
      result = undefined
      break
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
