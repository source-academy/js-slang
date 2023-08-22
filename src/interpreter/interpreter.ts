/* tslint:disable:max-classes-per-file */
import * as es from 'estree'
import { isEmpty, uniqueId } from 'lodash'

import { UNKNOWN_LOCATION } from '../constants'
import { LazyBuiltIn } from '../createContext'
import * as errors from '../errors/errors'
import { RuntimeSourceError } from '../errors/runtimeSourceError'
import { UndefinedImportError } from '../modules/errors'
import { initModuleContext, loadModuleBundle } from '../modules/moduleLoader'
import { ModuleFunctions } from '../modules/moduleTypes'
import { checkEditorBreakpoints } from '../stdlib/inspector'
import { Context, ContiguousArrayElements, Environment, Frame, Value, Variant } from '../types'
import assert from '../utils/assert'
import * as create from '../utils/astCreator'
import { conditionalExpression, literal, primitive } from '../utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import Closure from './closure'

class BreakValue {}

class ContinueValue {}

class ReturnValue {
  constructor(public value: Value) {}
}

class TailCallReturnValue {
  constructor(public callee: Closure, public args: Value[], public node: es.CallExpression) {}
}

class Thunk {
  public value: Value
  public isMemoized: boolean
  constructor(public exp: es.Node, public env: Environment) {
    this.isMemoized = false
    this.value = null
  }
}

const delayIt = (exp: es.Node, env: Environment): Thunk => new Thunk(exp, env)

function* forceIt(val: any, context: Context): Value {
  if (val instanceof Thunk) {
    if (val.isMemoized) return val.value

    pushEnvironment(context, val.env)
    const evalRes = yield* actualValue(val.exp, context)
    popEnvironment(context)
    val.value = evalRes
    val.isMemoized = true
    return evalRes
  } else return val
}

export function* actualValue(exp: es.Node, context: Context): Value {
  const evalResult = yield* evaluate(exp, context)
  const forced = yield* forceIt(evalResult, context)
  return forced
}

const createEnvironment = (
  closure: Closure,
  args: Value[],
  callExpression?: es.CallExpression
): Environment => {
  const environment: Environment = {
    name: closure.functionName, // TODO: Change this
    tail: closure.environment,
    head: {},
    id: uniqueId()
  }
  if (callExpression) {
    environment.callExpression = {
      ...callExpression,
      arguments: args.map(primitive)
    }
  }
  closure.node.params.forEach((param, index) => {
    if (param.type === 'RestElement') {
      environment.head[(param.argument as es.Identifier).name] = args.slice(index)
    } else {
      environment.head[(param as es.Identifier).name] = args[index]
    }
  })
  return environment
}

export const createBlockEnvironment = (
  context: Context,
  name = 'blockEnvironment',
  head: Frame = {}
): Environment => {
  return {
    name,
    tail: currentEnvironment(context),
    head,
    id: uniqueId()
  }
}

const handleRuntimeError = (context: Context, error: RuntimeSourceError): never => {
  context.errors.push(error)
  context.runtime.environments = context.runtime.environments.slice(
    -context.numberOfOuterEnvironments
  )
  throw error
}

const DECLARED_BUT_NOT_YET_ASSIGNED = Symbol('Used to implement block scope')

function declareIdentifier(context: Context, name: string, node: es.Node) {
  const environment = currentEnvironment(context)
  if (environment.head.hasOwnProperty(name)) {
    const descriptors = Object.getOwnPropertyDescriptors(environment.head)

    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(node, name, descriptors[name].writable)
    )
  }
  environment.head[name] = DECLARED_BUT_NOT_YET_ASSIGNED
  return environment
}

function declareVariables(context: Context, node: es.VariableDeclaration) {
  for (const declaration of node.declarations) {
    declareIdentifier(context, (declaration.id as es.Identifier).name, node)
  }
}

function declareFunctionsAndVariables(context: Context, node: es.BlockStatement) {
  for (const statement of node.body) {
    switch (statement.type) {
      case 'VariableDeclaration':
        declareVariables(context, statement)
        break
      case 'FunctionDeclaration':
        if (statement.id === null) {
          throw new Error(
            'Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.'
          )
        }
        declareIdentifier(context, statement.id.name, statement)
        break
    }
  }
}

function defineVariable(context: Context, name: string, value: Value, constant = false) {
  const environment = currentEnvironment(context)

  if (environment.head[name] !== DECLARED_BUT_NOT_YET_ASSIGNED) {
    return handleRuntimeError(
      context,
      new errors.VariableRedeclaration(context.runtime.nodes[0]!, name, !constant)
    )
  }

  Object.defineProperty(environment.head, name, {
    value,
    writable: !constant,
    enumerable: true
  })

  return environment
}

function* visit(context: Context, node: es.Node) {
  checkEditorBreakpoints(context, node)
  context.runtime.nodes.unshift(node)
  yield context
}

function* leave(context: Context) {
  context.runtime.break = false
  context.runtime.nodes.shift()
  yield context
}

const currentEnvironment = (context: Context) => context.runtime.environments[0]
const replaceEnvironment = (context: Context, environment: Environment) => {
  context.runtime.environments[0] = environment
  context.runtime.environmentTree.insert(environment)
}
const popEnvironment = (context: Context) => context.runtime.environments.shift()
export const pushEnvironment = (context: Context, environment: Environment) => {
  context.runtime.environments.unshift(environment)
  context.runtime.environmentTree.insert(environment)
}

const getVariable = (context: Context, name: string) => {
  let environment: Environment | null = currentEnvironment(context)
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === DECLARED_BUT_NOT_YET_ASSIGNED) {
        return handleRuntimeError(
          context,
          new errors.UnassignedVariable(name, context.runtime.nodes[0])
        )
      } else {
        return environment.head[name]
      }
    } else {
      environment = environment.tail
    }
  }
  return handleRuntimeError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
}

const setVariable = (context: Context, name: string, value: any) => {
  let environment: Environment | null = currentEnvironment(context)
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (environment.head[name] === DECLARED_BUT_NOT_YET_ASSIGNED) {
        break
      }
      const descriptors = Object.getOwnPropertyDescriptors(environment.head)
      if (descriptors[name].writable) {
        environment.head[name] = value
        return undefined
      }
      return handleRuntimeError(
        context,
        new errors.ConstAssignment(context.runtime.nodes[0]!, name)
      )
    } else {
      environment = environment.tail
    }
  }
  return handleRuntimeError(context, new errors.UndefinedVariable(name, context.runtime.nodes[0]))
}

const checkNumberOfArguments = (
  context: Context,
  callee: Closure | Value,
  args: Value[],
  exp: es.CallExpression
) => {
  if (callee instanceof Closure) {
    const params = callee.node.params
    const hasVarArgs = params[params.length - 1]?.type === 'RestElement'
    if (hasVarArgs ? params.length - 1 > args.length : params.length !== args.length) {
      return handleRuntimeError(
        context,
        new errors.InvalidNumberOfArguments(
          exp,
          hasVarArgs ? params.length - 1 : params.length,
          args.length,
          hasVarArgs
        )
      )
    }
  } else {
    const hasVarArgs = callee.minArgsNeeded != undefined
    if (hasVarArgs ? callee.minArgsNeeded > args.length : callee.length !== args.length) {
      return handleRuntimeError(
        context,
        new errors.InvalidNumberOfArguments(
          exp,
          hasVarArgs ? callee.minArgsNeeded : callee.length,
          args.length,
          hasVarArgs
        )
      )
    }
  }
  return undefined
}

function* getArgs(context: Context, call: es.CallExpression) {
  const args = []
  for (const arg of call.arguments) {
    if (context.variant === Variant.LAZY) {
      args.push(delayIt(arg, currentEnvironment(context)))
    } else if (arg.type === 'SpreadElement') {
      args.push(...(yield* actualValue(arg.argument, context)))
    } else {
      args.push(yield* actualValue(arg, context))
    }
  }
  return args
}

function transformLogicalExpression(node: es.LogicalExpression): es.ConditionalExpression {
  if (node.operator === '&&') {
    return conditionalExpression(node.left, node.right, literal(false), node.loc)
  } else {
    return conditionalExpression(node.left, literal(true), node.right, node.loc)
  }
}

function* reduceIf(
  node: es.IfStatement | es.ConditionalExpression,
  context: Context
): IterableIterator<null | es.Node> {
  const test = yield* actualValue(node.test, context)

  const error = rttc.checkIfStatement(node, test, context.chapter)
  if (error) {
    return handleRuntimeError(context, error)
  }

  return test ? node.consequent : node.alternate
}

export type Evaluator<T extends es.Node> = (node: T, context: Context) => IterableIterator<Value>

function* evaluateBlockStatement(context: Context, node: es.BlockStatement) {
  declareFunctionsAndVariables(context, node)
  let result
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
  return result
}

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
// tslint:disable:object-literal-shorthand
// prettier-ignore
export const evaluators: { [nodeType: string]: Evaluator<es.Node> } = {
  /** Simple Values */
  Literal: function*(node: es.Literal, _context: Context) {
    return node.value
  },

  TemplateLiteral: function*(node: es.TemplateLiteral) {
    // Expressions like `${1}` are not allowed, so no processing needed
    return node.quasis[0].value.cooked
  },

  ThisExpression: function*(node: es.ThisExpression, context: Context) {
    return currentEnvironment(context).thisContext
  },

  ArrayExpression: function*(node: es.ArrayExpression, context: Context) {
    const res = []
    for (const n of node.elements as ContiguousArrayElements) {
      res.push(yield* evaluate(n, context))
    }
    return res
  },

  DebuggerStatement: function*(node: es.DebuggerStatement, context: Context) {
    context.runtime.break = true
    yield
  },

  FunctionExpression: function*(node: es.FunctionExpression, context: Context) {
    return new Closure(node, currentEnvironment(context), context)
  },

  ArrowFunctionExpression: function*(node: es.ArrowFunctionExpression, context: Context) {
    return Closure.makeFromArrowFunction(node, currentEnvironment(context), context)
  },

  Identifier: function*(node: es.Identifier, context: Context) {
    return getVariable(context, node.name)
  },

  CallExpression: function*(node: es.CallExpression, context: Context) {
    const callee = yield* actualValue(node.callee, context)
    const args = yield* getArgs(context, node)
    let thisContext
    if (node.callee.type === 'MemberExpression') {
      thisContext = yield* actualValue(node.callee.object, context)
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
    const value = yield* actualValue(node.argument, context)

    const error = rttc.checkUnaryExpression(node, node.operator, value, context.chapter)
    if (error) {
      return handleRuntimeError(context, error)
    }
    return evaluateUnaryExpression(node.operator, value)
  },

  BinaryExpression: function*(node: es.BinaryExpression, context: Context) {
    const left = yield* actualValue(node.left, context)
    const right = yield* actualValue(node.right, context)
    const error = rttc.checkBinaryExpression(node, node.operator, context.chapter, left, right)
    if (error) {
      return handleRuntimeError(context, error)
    }
    return evaluateBinaryExpression(node.operator, left, right)
  },

  ConditionalExpression: function*(node: es.ConditionalExpression, context: Context) {
    return yield* this.IfStatement(node, context)
  },

  LogicalExpression: function*(node: es.LogicalExpression, context: Context) {
    return yield* this.ConditionalExpression(transformLogicalExpression(node), context)
  },

  VariableDeclaration: function*(node: es.VariableDeclaration, context: Context) {
    const declaration = node.declarations[0]
    const constant = node.kind === 'const'
    const id = declaration.id as es.Identifier
    const value = yield* evaluate(declaration.init!, context)
    defineVariable(context, id.name, value, constant)
    return undefined
  },

  ContinueStatement: function*(_node: es.ContinueStatement, _context: Context) {
    return new ContinueValue()
  },

  BreakStatement: function*(_node: es.BreakStatement, _context: Context) {
    return new BreakValue()
  },

  ForStatement: function*(node: es.ForStatement, context: Context) {
    // Create a new block scope for the loop variables
    const loopEnvironment = createBlockEnvironment(context, 'forLoopEnvironment')
    pushEnvironment(context, loopEnvironment)

    const initNode = node.init!
    const testNode = node.test!
    const updateNode = node.update!
    if (initNode.type === 'VariableDeclaration') {
      declareVariables(context, initNode)
    }
    yield* actualValue(initNode, context)

    let value
    while (yield* actualValue(testNode, context)) {
      // create block context and shallow copy loop environment head
      // see https://www.ecma-international.org/ecma-262/6.0/#sec-for-statement-runtime-semantics-labelledevaluation
      // and https://hacks.mozilla.org/2015/07/es6-in-depth-let-and-const/
      // We copy this as a const to avoid ES6 funkiness when mutating loop vars
      // https://github.com/source-academy/js-slang/issues/65#issuecomment-425618227
      const environment = createBlockEnvironment(context, 'forBlockEnvironment')
      pushEnvironment(context, environment)
      for (const name in loopEnvironment.head) {
        if (loopEnvironment.head.hasOwnProperty(name)) {
          declareIdentifier(context, name, node)
          defineVariable(context, name, loopEnvironment.head[name], true)
        }
      }

      value = yield* actualValue(node.body, context)

      // Remove block context
      popEnvironment(context)
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

      yield* actualValue(updateNode, context)
    }

    popEnvironment(context)

    return value
  },

  MemberExpression: function*(node: es.MemberExpression, context: Context) {
    let obj = yield* actualValue(node.object, context)
    if (obj instanceof Closure) {
      obj = obj.fun
    }
    let prop
    if (node.computed) {
      prop = yield* actualValue(node.property, context)
    } else {
      prop = (node.property as es.Identifier).name
    }

    const error = rttc.checkMemberAccess(node, obj, prop)
    if (error) {
      return handleRuntimeError(context, error)
    }

    if (
      obj !== null &&
      obj !== undefined &&
      typeof obj[prop] !== 'undefined' &&
      !obj.hasOwnProperty(prop)
    ) {
      return handleRuntimeError(context, new errors.GetInheritedPropertyError(node, obj, prop))
    }
    try {
      return obj[prop]
    } catch {
      return handleRuntimeError(context, new errors.GetPropertyError(node, obj, prop))
    }
  },

  AssignmentExpression: function*(node: es.AssignmentExpression, context: Context) {
    if (node.left.type === 'MemberExpression') {
      const left = node.left
      const obj = yield* actualValue(left.object, context)
      let prop
      if (left.computed) {
        prop = yield* actualValue(left.property, context)
      } else {
        prop = (left.property as es.Identifier).name
      }

      const error = rttc.checkMemberAccess(node, obj, prop)
      if (error) {
        return handleRuntimeError(context, error)
      }

      const val = yield* evaluate(node.right, context)
      try {
        obj[prop] = val
      } catch {
        return handleRuntimeError(context, new errors.SetPropertyError(node, obj, prop))
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
    const id = node.id
    if (id === null) {
      throw new Error("Encountered a FunctionDeclaration node without an identifier. This should have been caught when parsing.")
    }
    // tslint:disable-next-line:no-any
    const closure = new Closure(node, currentEnvironment(context), context)
    defineVariable(context, id.name, closure, true)
    return undefined
  },

  IfStatement: function*(node: es.IfStatement | es.ConditionalExpression, context: Context) {
    const result = yield* reduceIf(node, context)
    if (result === null) {
      return undefined;
    }
    return yield* evaluate(result, context)
  },

  ExpressionStatement: function*(node: es.ExpressionStatement, context: Context) {
    return yield* evaluate(node.expression, context)
  },

  ReturnStatement: function*(node: es.ReturnStatement, context: Context) {
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
    if (returnExpression.type === 'CallExpression' && context.variant !== Variant.LAZY) {
      const callee = yield* actualValue(returnExpression.callee, context)
      const args = yield* getArgs(context, returnExpression)
      return new TailCallReturnValue(callee, args, returnExpression)
    } else {
      return new ReturnValue(yield* evaluate(returnExpression, context))
    }
  },

  WhileStatement: function*(node: es.WhileStatement, context: Context) {
    let value: any // tslint:disable-line
    while (
      // tslint:disable-next-line
      (yield* actualValue(node.test, context)) &&
      !(value instanceof ReturnValue) &&
      !(value instanceof BreakValue) &&
      !(value instanceof TailCallReturnValue)
    ) {
      value = yield* actualValue(node.body, context)
    }
    if (value instanceof BreakValue) {
      return undefined
    }
    return value
  },

  ObjectExpression: function*(node: es.ObjectExpression, context: Context) {
    const obj = {}
    for (const propUntyped of node.properties) {
      // node.properties: es.Property | es.SpreadExpression, but
      // our Acorn is set to ES6 which cannot have a es.SpreadExpression
      // at this point. Force the type.
      const prop = propUntyped as es.Property
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
    // Create a new environment (block scoping)
    const environment = createBlockEnvironment(context, 'blockEnvironment')
    pushEnvironment(context, environment)
    const result: Value = yield* evaluateBlockStatement(context, node)
    popEnvironment(context)
    return result
  },

  ImportDeclaration: function*(node: es.ImportDeclaration, context: Context) {
    throw new Error('ImportDeclarations should already have been removed')
  },

  ExportNamedDeclaration: function*(_node: es.ExportNamedDeclaration, _context: Context) {
    // Exports are handled as a separate pre-processing step in 'transformImportedFile'.
    // Subsequently, they are removed from the AST by 'removeExports' before the AST is evaluated.
    // As such, there should be no ExportNamedDeclaration nodes in the AST.
    throw new Error('Encountered an ExportNamedDeclaration node in the AST while evaluating. This suggests that an invariant has been broken.')
  },

  ExportDefaultDeclaration: function*(_node: es.ExportDefaultDeclaration, _context: Context) {
    // Exports are handled as a separate pre-processing step in 'transformImportedFile'.
    // Subsequently, they are removed from the AST by 'removeExports' before the AST is evaluated.
    // As such, there should be no ExportDefaultDeclaration nodes in the AST.
    throw new Error('Encountered an ExportDefaultDeclaration node in the AST while evaluating. This suggests that an invariant has been broken.')
  },

  ExportAllDeclaration: function*(_node: es.ExportAllDeclaration, _context: Context) {
    // Exports are handled as a separate pre-processing step in 'transformImportedFile'.
    // Subsequently, they are removed from the AST by 'removeExports' before the AST is evaluated.
    // As such, there should be no ExportAllDeclaration nodes in the AST.
    throw new Error('Encountered an ExportAllDeclaration node in the AST while evaluating. This suggests that an invariant has been broken.')
  },

  Program: function*(node: es.BlockStatement, context: Context) {
    throw new Error('A program should not contain another program within itself')
  }
}
// tslint:enable:object-literal-shorthand

// TODO: move to util
/**
 * Checks if `env` is empty (that is, head of env is an empty object)
 */
function isEmptyEnvironment(env: Environment) {
  return isEmpty(env.head)
}

/**
 * Extracts the non-empty tail environment from the given environment and
 * returns current environment if tail environment is a null.
 */
function getNonEmptyEnv(environment: Environment): Environment {
  if (isEmptyEnvironment(environment)) {
    const tailEnvironment = environment.tail
    if (tailEnvironment === null) {
      return environment
    }
    return getNonEmptyEnv(tailEnvironment)
  } else {
    return environment
  }
}

export function* evaluateProgram(
  program: es.Program,
  context: Context,
  checkImports: boolean,
  loadTabs: boolean
) {
  yield* visit(context, program)

  context.numberOfOuterEnvironments += 1
  const environment = createBlockEnvironment(context, 'programEnvironment')
  pushEnvironment(context, environment)

  const otherNodes: es.Statement[] = []
  const moduleFunctions: Record<string, ModuleFunctions> = {}

  try {
    for (const node of program.body) {
      if (node.type !== 'ImportDeclaration') {
        otherNodes.push(node as es.Statement)
        continue
      }

      yield* visit(context, node)

      const moduleName = node.source.value
      assert(
        typeof moduleName === 'string',
        `ImportDeclarations should have string sources, got ${moduleName}`
      )

      if (!(moduleName in moduleFunctions)) {
        initModuleContext(moduleName, context, loadTabs)
        moduleFunctions[moduleName] = loadModuleBundle(moduleName, context, node)
      }

      const functions = moduleFunctions[moduleName]

      for (const spec of node.specifiers) {
        assert(
          spec.type === 'ImportSpecifier',
          `Only Import Specifiers are supported, got ${spec.type}`
        )

        if (checkImports && !(spec.imported.name in functions)) {
          throw new UndefinedImportError(spec.imported.name, moduleName, spec)
        }

        declareIdentifier(context, spec.local.name, node)
        defineVariable(context, spec.local.name, functions[spec.imported.name], true)
      }
      yield* leave(context)
    }
  } catch (error) {
    handleRuntimeError(context, error)
  }

  const newProgram = create.blockStatement(otherNodes)
  const result = yield* forceIt(yield* evaluateBlockStatement(context, newProgram), context)

  yield* leave(context) // Done visiting program

  if (result instanceof Closure) {
    Object.defineProperty(getNonEmptyEnv(currentEnvironment(context)).head, uniqueId(), {
      value: result,
      writable: false,
      enumerable: true
    })
  }
  return result
}

function* evaluate(node: es.Node, context: Context) {
  yield* visit(context, node)
  const result = yield* evaluators[node.type](node, context)
  yield* leave(context)
  if (result instanceof Closure) {
    Object.defineProperty(getNonEmptyEnv(currentEnvironment(context)).head, uniqueId(), {
      value: result,
      writable: false,
      enumerable: true
    })
  }
  return result
}

export function* apply(
  context: Context,
  fun: Closure | Value,
  args: (Thunk | Value)[],
  node: es.CallExpression,
  thisContext?: Value
) {
  let result: Value
  let total = 0

  while (!(result instanceof ReturnValue)) {
    if (fun instanceof Closure) {
      checkNumberOfArguments(context, fun, args, node!)
      const environment = createEnvironment(fun, args, node)
      if (result instanceof TailCallReturnValue) {
        replaceEnvironment(context, environment)
      } else {
        pushEnvironment(context, environment)
        total++
      }
      const bodyEnvironment = createBlockEnvironment(context, 'functionBodyEnvironment')
      bodyEnvironment.thisContext = thisContext
      pushEnvironment(context, bodyEnvironment)
      result = yield* evaluateBlockStatement(context, fun.node.body as es.BlockStatement)
      popEnvironment(context)
      if (result instanceof TailCallReturnValue) {
        fun = result.callee
        node = result.node
        args = result.args
      } else if (!(result instanceof ReturnValue)) {
        // No Return Value, set it as undefined
        result = new ReturnValue(undefined)
      }
    } else if (fun instanceof LazyBuiltIn) {
      try {
        let finalArgs = args
        if (fun.evaluateArgs) {
          finalArgs = []
          for (const arg of args) {
            finalArgs.push(yield* forceIt(arg, context))
          }
        }
        result = fun.func.apply(thisContext, finalArgs)
        break
      } catch (e) {
        // Recover from exception
        context.runtime.environments = context.runtime.environments.slice(
          -context.numberOfOuterEnvironments
        )

        const loc = node.loc ?? UNKNOWN_LOCATION
        if (!(e instanceof RuntimeSourceError || e instanceof errors.ExceptionError)) {
          // The error could've arisen when the builtin called a source function which errored.
          // If the cause was a source error, we don't want to include the error.
          // However if the error came from the builtin itself, we need to handle it.
          return handleRuntimeError(context, new errors.ExceptionError(e, loc))
        }
        result = undefined
        throw e
      }
    } else if (typeof fun === 'function') {
      checkNumberOfArguments(context, fun, args, node!)
      try {
        const forcedArgs = []

        for (const arg of args) {
          forcedArgs.push(yield* forceIt(arg, context))
        }

        result = fun.apply(thisContext, forcedArgs)
        break
      } catch (e) {
        // Recover from exception
        context.runtime.environments = context.runtime.environments.slice(
          -context.numberOfOuterEnvironments
        )

        const loc = node.loc ?? UNKNOWN_LOCATION
        if (!(e instanceof RuntimeSourceError || e instanceof errors.ExceptionError)) {
          // The error could've arisen when the builtin called a source function which errored.
          // If the cause was a source error, we don't want to include the error.
          // However if the error came from the builtin itself, we need to handle it.
          return handleRuntimeError(context, new errors.ExceptionError(e, loc))
        }
        result = undefined
        throw e
      }
    } else {
      return handleRuntimeError(context, new errors.CallingNonFunctionValue(fun, node))
    }
  }
  // Unwraps return value and release stack environment
  if (result instanceof ReturnValue) {
    result = result.value
  }
  for (let i = 1; i <= total; i++) {
    popEnvironment(context)
  }
  return result
}
