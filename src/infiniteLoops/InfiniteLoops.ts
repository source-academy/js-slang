import * as es from 'estree'
import { Value } from '../types'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as stype from './symTypes'
import { checkBinaryExpression, checkUnaryExpression } from '../utils/rttc'
import { serialize } from './serializer'
import { getFirstCall, symbolicExecute } from './symbolicExecutor'
import { getCheckers } from './analyzer'
import * as create from '../utils/astCreator'

interface SimpleEnv {
  constants: [string, any][]
  tset: stype.TransitionSet
  chapter2: boolean
}
function newEnv(chap?: boolean) {
  return { constants: [], tset: new Map(), chapter2: chap } as SimpleEnv
}

function getVariable(envs: SimpleEnv[], name: string) {
  for (const env of envs) {
    for (const [key, val] of env.constants) {
      if (key === name) {
        return val
      }
    }
  }
  return undefined
}

function setVariable(envs: SimpleEnv[], name: string, value: any) {
  envs[0].constants.unshift([name, value])
  return undefined
}

function getConsts(envs: SimpleEnv[]) {
  const encountered: string[] = []
  const result: [string, number][] = []
  for (const env of envs) {
    for (const [key, val] of env.constants) {
      if (encountered.indexOf(key) >= 0) {
        continue
      }
      if (typeof val === 'number') {
        encountered.push(key)
        result.unshift([key, val])
      }
    }
  }
  return result
}

function buildTset(node: es.FunctionDeclaration, envs: SimpleEnv[]) {
  const id = node.id as es.Identifier
  const firstCall = getFirstCall(node)
  const symTree = symbolicExecute(node, getConsts(envs))
  const transition = serialize(firstCall, symTree)
  envs[0].tset.set(id.name, transition)
}

function removePreludeFunctions(envs: SimpleEnv[]) {
  const preludeListFunctions = [
    'is_list',
    'equal',
    'length',
    'map',
    'build_list',
    'for_each',
    'list_to_string',
    'reverse',
    'append',
    'member',
    'remove',
    'remove_all',
    'filter',
    'enum_list',
    'list_ref',
    'accumulate'
  ]
  for (let i = envs.length - 1; i >= 0; i--) {
    const tset = envs[i].tset
    if (tset.size === 16 && tset.has('is_list')) {
      for (const fn of preludeListFunctions) {
        envs[i].tset.delete(fn)
      }
      break
    }
  }
}

function mergeTset(envs: SimpleEnv[]) {
  const t0 = new Map()
  removePreludeFunctions(envs)
  for (const e of envs) {
    for (const [k, v] of e.tset.entries()) {
      if (!t0.has(k)) {
        t0.set(k, v)
      }
    }
  }
  return t0
}

function boolSymToEstree(sym: stype.BooleanSymbol | null, loc: es.SourceLocation): es.Expression {
  if (sym === null) {
    return create.literal(true)
  }
  if (sym.type === 'InequalitySymbol') {
    const op: es.BinaryOperator = sym.direction > 0 ? '>' : sym.direction < 0 ? '<' : '==='
    return create.binaryExpression(
      op,
      create.identifier(sym.name),
      create.literal(sym.constant),
      loc
    )
  } else {
    const op: es.LogicalOperator = sym.conjunction ? '&&' : '||'
    return create.logicalExpression(
      op,
      boolSymToEstree(sym.left, loc),
      boolSymToEstree(sym.right, loc),
      loc
    )
  }
}

function putError(msg: string, loc: es.SourceLocation) {
  return create.expressionStatement(
    create.callExpression(create.identifier('error'), [create.literal(msg)], loc)
  )
}

function addProtection(checker: stype.InfiniteLoopChecker) {
  const loc = checker.loc
  const test = boolSymToEstree(checker.condition, loc)
  return create.ifStatement(
    test,
    create.blockStatement([putError(checker.message, loc)]),
    create.blockStatement([]),
    loc
  )
}

/* We run the detection here, need to use T-set
 * with functions from the correct scope
 */
function evaluateBlockSatement(envs: SimpleEnv[], node: es.BlockStatement) {
  for (const statement of node.body) {
    if (statement.type === 'FunctionDeclaration') {
      buildTset(statement, envs)
    } else {
      simpleEval(statement, envs)
    }
  }

  const checkers = getCheckers(mergeTset(envs))
  for (const statement of node.body) {
    if (statement.type === 'FunctionDeclaration') {
      const id = statement.id as es.Identifier
      for (const checker of checkers) {
        if (checker.functionName === id.name) {
          const toAdd = addProtection(checker)
          statement.body.body.unshift(toAdd)
        }
      }
    }
  }
  return undefined
}

/* Simple evaluator to "simplify" some expressions, handle scoping,
 * and global variables.
 */
const evaluators: { [nodeType: string]: (node: es.Node, envs: SimpleEnv[]) => any } = {
  Literal(node: es.Literal, envs: SimpleEnv[]) {
    return node.value
  },

  ArrowFunctionExpression(node: es.ArrowFunctionExpression, envs: SimpleEnv[]) {
    return undefined
  },

  Identifier(node: es.Identifier, envs: SimpleEnv[]) {
    return getVariable(envs, node.name)
  },

  CallExpression(node: es.CallExpression, envs: SimpleEnv[]) {
    return undefined
  },

  UnaryExpression(node: es.UnaryExpression, envs: SimpleEnv[]) {
    const value = simpleEval(node.argument, envs)
    if (checkUnaryExpression(node, node.operator, value)) {
      return undefined
    } else {
      return evaluateUnaryExpression(node.operator, value)
    }
  },

  BinaryExpression(node: es.BinaryExpression, envs: SimpleEnv[]) {
    const left = simpleEval(node.left, envs)
    const right = simpleEval(node.right, envs)
    if (checkBinaryExpression(node, node.operator, left, right)) {
      return undefined
    } else {
      return evaluateBinaryExpression(node.operator, left, right)
    }
  },

  ConditionalExpression(node: es.ConditionalExpression, envs: SimpleEnv[]) {
    return evaluators.IfStatement(node, envs)
  },

  LogicalExpression(node: es.LogicalExpression, envs: SimpleEnv[]) {
    const op = node.operator
    const left = simpleEval(node.left, envs)
    const right = simpleEval(node.right, envs)
    return left === undefined && right === undefined
      ? undefined
      : op === '&&'
      ? left && right
      : left || right
  },

  VariableDeclaration(node: es.VariableDeclaration, envs: SimpleEnv[]) {
    const declaration = node.declarations[0]
    const id = declaration.id as es.Identifier
    const value = simpleEval(declaration.init!, envs)
    setVariable(envs, id.name, value)
    return undefined
  },

  FunctionDeclaration(node: es.FunctionDeclaration, envs: SimpleEnv[]) {
    return undefined
  },

  IfStatement(node: es.IfStatement | es.ConditionalExpression, envs: SimpleEnv[]) {
    const test = simpleEval(node.test, envs)
    return test === undefined
      ? undefined
      : test
      ? simpleEval(node.consequent, envs)
      : node.alternate
      ? simpleEval(node.alternate, envs)
      : undefined
  },

  ExpressionStatement(node: es.ExpressionStatement, envs: SimpleEnv[]) {
    return simpleEval(node.expression, envs)
  },

  BlockStatement(node: es.BlockStatement, envs: SimpleEnv[]) {
    let result: Value

    // Create a new environment (block scoping)
    envs.unshift(newEnv())
    result = evaluateBlockSatement(envs, node)
    envs.shift()
    return result
  },

  Program(node: es.BlockStatement, envs: SimpleEnv[]) {
    envs.unshift(newEnv())
    return evaluateBlockSatement(envs, node)
  }
}

function simpleEval(node: es.Node, envs: SimpleEnv[]) {
  const fn = evaluators[node.type]
  if (fn !== undefined) {
    return fn(node, envs)
  } else {
    return undefined
  }
}

export function addInfiniteLoopProtection(prog: es.Program, chap: boolean) {
  simpleEval(prog, [newEnv(chap)])
}
