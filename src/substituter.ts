import * as es from 'estree'
import * as errors from './interpreter-errors'
import { parse } from './parser'
import { Context } from './types'
import * as ast from './utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from './utils/operators'
import * as rttc from './utils/rttc'

function substByIdentifier(
  node: es.Node,
  target: es.FunctionDeclaration | [es.Identifier, es.Literal]
) {
  if (Array.isArray(target)) {
    const [id, lit] = target
    // only accept string, boolean and numbers, throw error if doesn't conform
    if (!['string', 'boolean', 'number'].includes(typeof lit.value)) {
      throw new rttc.TypeError(lit, '', 'string, boolean or number', typeof lit.value)
    } else {
      return node.type === 'Identifier' && node.name === id.name
        ? ast.primitive(lit.value)
        : substitute(target, node)
    }
  } else {
    const fn = target as es.FunctionDeclaration
    return node.type === 'Identifier' && node.name === fn.id!.name
      ? ast.functionExpression(fn.id, fn.params, fn.body, fn.loc!)
      : substitute(fn, node)
  }
}

// TODO: change substbyidentifier into the identifier function below.
// TODO: allow subbing identifier with builtin (or literal values)
const substituters = {
  Identifier(target: es.FunctionDeclaration | [es.Identifier, es.Literal], node: es.Identifier) {
    if (Array.isArray(target)) {
      const [id, lit] = target
      // only accept string, boolean and numbers, throw error if doesn't conform
      if (!['string', 'boolean', 'number'].includes(typeof lit.value)) {
        throw new rttc.TypeError(lit, '', 'string, boolean or number', typeof lit.value)
      } else {
        return node.name === id.name ? ast.primitive(lit.value) : substitute(target, node)
      }
    } else {
      const fn = target as es.FunctionDeclaration
      return node.name === fn.id!.name
        ? ast.functionExpression(fn.id, fn.params, fn.body, fn.loc!)
        : substitute(fn, node)
    }
  },
  ExpressionStatement(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.ExpressionStatement
  ) {
    const substedExpression = substByIdentifier(node.expression, target)
    return ast.expressionStatement(substedExpression as es.Expression, node.loc!)
  },
  BinaryExpression(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.BinaryExpression
  ) {
    const { left, right } = node
    const [substedLeft, substedRight] = [left, right].map(exp => substByIdentifier(exp, target))
    return ast.binaryExpression(
      node.operator,
      substedLeft as es.Expression,
      substedRight as es.Expression,
      node.loc!
    )
  },
  UnaryExpression(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.UnaryExpression
  ) {
    const { argument } = node
    const substedArgument = substByIdentifier(argument, target)
    return ast.unaryExpression(node.operator, substedArgument as es.Expression, node.loc!)
  },
  // done. as model.
  ConditionalExpression(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.ConditionalExpression
  ) {
    const { test, consequent, alternate } = node
    const [substedTest, substedConsequent, substedAlternate] = [test, consequent, alternate].map(
      exp => substByIdentifier(exp, target) as es.Expression
    )
    return ast.conditionalExpression(substedTest, substedConsequent, substedAlternate, node.loc!)
  },
  // done (hopefully)
  CallExpression(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.CallExpression
  ) {
    const [callee, args] = [node.callee, node.arguments]
    const [substedCallee, ...substedArgs] = [callee, ...args].map(exp =>
      substByIdentifier(exp, target)
    )
    return ast.callExpression(
      substedCallee as es.Expression,
      substedArgs as es.Expression[],
      node.loc!
    )
  },
  FunctionDeclaration(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.FunctionDeclaration
  ) {
    const { params, body } = node
    const [substedBody, ...substedParams] = [body, ...params].map(exp =>
      substByIdentifier(exp, target)
    )
    return ast.functionDeclaration(
      node.id,
      substedParams as es.Pattern[],
      substedBody as es.BlockStatement,
      node.loc!
    )
  },
  BlockStatement(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.BlockStatement
  ) {
    const substedBody = node.body.map(exp => substByIdentifier(exp, target))
    return ast.blockStatement(substedBody as es.Statement[], node.loc!)
  },
  ReturnStatement(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.ReturnStatement
  ) {
    const arg = node.argument
    if (arg === undefined) {
      return node
    }
    const substedArgument = substByIdentifier(arg as es.Node, target)
    return ast.returnStatement(substedArgument as es.Expression, node.loc!)
  }
}

/**
 * For mapper use, maps a [symbol, value] pair to the node supplied.
 * @param target symbol and value, can be fn name and funExp, or id and literal
 * @param node a node holding the target symbols
 */
function substitute(
  target: es.FunctionDeclaration | [es.Identifier, es.Literal],
  node: es.Node
): es.Node {
  const substituter = substituters[node.type]
  if (substituter === undefined) {
    return node // if substituter is not found we just get stuck
  } else {
    return substituter(target, node)
  }
}

/**
 * Substitutes a call expression with the body of the callee (funExp)
 * and the body will have all ocurrences of parameters substituted
 * with the arguments.
 * @param call call expression with callee as functionExpression
 * @param args arguments supplied to the call expression
 */
function apply(
  callee: es.FunctionExpression,
  args: Array<es.Identifier | es.Literal>
): es.BlockStatement {
  // you have one job: substitute all parameters with arguments
  // one way: map into the block statement, using a modified substitute(literal, node) function
  // substitute the function block repeatedly with the arguments
  let substedBlock = callee.body
  for (let i = 0; i < args.length; i++) {
    // source discipline requires parameters to be identifiers.
    const param = callee.params[i] as es.Identifier
    substedBlock = ast.blockStatement(
      substedBlock.body.map(
        stmt => substitute([param, args[i] as es.Literal], stmt) as es.Statement
      )
    )
  }
  return substedBlock
}

const reducers = {
  Identifier(node: es.Identifier, context: Context): [es.Node, Context] {
    // can only be built ins. the rest should have been declared
    const globalFrame = context.runtime.environments[0].head
    if (!(node.name in globalFrame)) {
      throw new errors.UndefinedVariable(node.name, node)
    } else {
      // builtin functions will remain as name
      if (typeof globalFrame[node.name] === 'function') {
        return [node, context]
      } else {
        return [globalFrame[node.name], context]
      }
    }
  },
  BinaryExpression(node: es.BinaryExpression, context: Context): [es.Node, Context] {
    const { operator, left, right } = node
    if (left.type === 'Literal') {
      if (right.type === 'Literal') {
        const error = rttc.checkBinaryExpression(node, operator, left.value, right.value)
        if (error === undefined) {
          return [ast.literal(evaluateBinaryExpression(operator, left.value, right.value)), context]
        } else {
          throw error
        }
      } else {
        const [reducedRight] = reduce(right, context)
        const reducedExpression = ast.binaryExpression(
          operator,
          left,
          reducedRight as es.Expression,
          node.loc!
        )
        return [reducedExpression, context]
      }
    } else {
      const [reducedLeft] = reduce(node.left, context)
      const reducedExpression = ast.binaryExpression(
        operator,
        reducedLeft as es.Expression,
        right,
        node.loc!
      )
      return [reducedExpression, context]
    }
  },
  UnaryExpression(node: es.UnaryExpression, context: Context): [es.Node, Context] {
    const { operator, argument } = node
    if (argument.type === 'Literal') {
      const error = rttc.checkUnaryExpression(node, operator, argument.value)
      if (error === undefined) {
        return [ast.literal(evaluateUnaryExpression(operator, argument.value)), context]
      } else {
        throw error
      }
    } else {
      const [reducedArgument] = reduce(argument, context)
      const reducedExpression = ast.unaryExpression(
        operator,
        reducedArgument as es.Expression,
        node.loc!
      )
      return [reducedExpression, context]
    }
  },
  ConditionalExpression(node: es.ConditionalExpression, context: Context): [es.Node, Context] {
    const { test, consequent, alternate } = node
    if (test.type === 'Literal') {
      const error = rttc.checkIfStatement(node, test)
      if (error === undefined) {
        return [ast.expressionStatement(test.type ? consequent : alternate), context]
      } else {
        throw error
      }
    } else {
      const [reducedTest] = reduce(test, context)
      const reducedExpression = ast.conditionalExpression(
        reducedTest as es.Expression,
        consequent,
        alternate,
        node.loc!
      )
      return [reducedExpression, context]
    }
  },
  // core of the subst model
  CallExpression(node: es.CallExpression, context: Context): [es.Node, Context] {
    const [callee, args] = [node.callee, node.arguments]
    // if functor can reduce, reduce functor
    const [reducedCallee] = reduce(callee, context)
    // source 0: reducedCallee can only be a builtin function or functionExpression
    if (reducedCallee.type !== 'FunctionExpression' && reducedCallee.type !== 'Identifier') {
      throw new errors.CallingNonFunctionValue(reducedCallee, node)
    } else if (
      reducedCallee.type === 'Identifier' &&
      !(reducedCallee.name in context.runtime.environments[0].head)
    ) {
      throw new errors.UndefinedVariable(reducedCallee.name, reducedCallee)
    } else {
      // callee is a funExp or builtin fn
      // if arguments can reduce, reduce arguments
      const reducedArgs = args.map(arg => reduce(arg, context)[0])
      // check for 1. length of params = length of args
      // 2. all args are literals or builtins
      if (
        reducedCallee.type !== 'Identifier' &&
        reducedArgs.length !== reducedCallee.params.length
      ) {
        throw new errors.InvalidNumberOfArguments(
          node,
          reducedArgs.length,
          reducedCallee.params.length
        )
      } else {
        for (const currentArg of reducedArgs) {
          if (currentArg.type === 'Identifier') {
            if (currentArg.name in context.runtime.environments[0].head) {
              continue
            } else {
              throw new errors.UndefinedVariable(currentArg.name, currentArg)
            }
          } else if (currentArg.type === 'Literal') {
            continue
          } else {
            // a proper reduction sequence should not reach here. this is a bug.
          }
        }
      }
      // if it reaches here, means all the arguments are legal.
      return reducedCallee.type === 'FunctionExpression'
        ? apply(
            reducedCallee as es.FunctionExpression,
            reducedArgs as Array<es.Literal | es.Identifier>
          )[0]
        : context.runtime.environments[0].head[name](...reducedArgs)
    }
  },
  Program(node: es.Program, context: Context): [es.Node, Context] {
    const [firstStatement, ...otherStatements] = node.body
    if (
      firstStatement.type === 'ExpressionStatement' &&
      firstStatement.expression.type === 'Literal'
    ) {
      return [ast.program(otherStatements, node.loc!), context]
    } else if (firstStatement.type === 'FunctionDeclaration') {
      // substitute the rest of the program
      const substedStmts = otherStatements.map(stmt => substitute(firstStatement, stmt))
      return [ast.program(substedStmts as es.Statement[]), context]
    } else {
      const [reduced] = reduce(firstStatement, context)
      return [ast.program([reduced as es.Statement, ...otherStatements], node.loc!), context]
    }
  },
  /* <BAD PRACTICE>
   * for now BlockStatement is just duplicated code from Program which is BAD PRACTICE,
   * but in future BlockStatement will need to handle return as well.
   * </BAD PRACTICE>
   */
  BlockStatement(node: es.BlockStatement, context: Context) {
    const [firstStatement, ...otherStatements] = node.body
    const isFirstStatementCompletelyReduced =
      firstStatement.type === 'ExpressionStatement' && firstStatement.expression.type === 'Literal'
    if (isFirstStatementCompletelyReduced) {
      return [ast.blockStatement(otherStatements, node.loc!), context]
    } else {
      const [reduced] = reduce(firstStatement, context)
      return [ast.blockStatement([reduced as es.Statement, ...otherStatements], node.loc!), context]
    }
  }
}

function reduce(node: es.Node, context: Context): [es.Node, Context] {
  const reducer = reducers[node.type]
  if (reducer === undefined) {
    return [node, context] // if reducer is not found we just get stuck
  } else {
    return reducer(node, context)
  }
}

// TODO: change the context to include the predefined fn names
function substPredefinedFns(node: es.Node, context: Context): [es.Node, Context] {
  /*
  const globalFrame = context.runtime.environments[0].head
  let predefinedFns: Array<es.FunctionDeclaration> = globalFrame.keys
    .filter((name: string) => context.predefinedFnNames.includes(name))
    .map((name: string) => globalFrame[name])
  for (let i = 0; i < predefinedFns.length; i++) {
    node = substitute(predefinedFns[i], node)
  }
  */
  return [node, context]
}

// the context here is for builtins
export function getEvaluationSteps(code: string, context: Context): es.Node[] {
  const steps: es.Node[] = []
  try {
    const program = parse(code, context)
    if (program === undefined) {
      return [parse('', context)!]
    }
    steps.push(program)
    // starts with substituting predefined fns. visually in the inspector remains
    // the same, except for the mouseovers.
    let [reduced] = substPredefinedFns(program, context)
    while ((reduced as es.Program).body.length > 0) {
      steps.push(reduced)
      // some bug with no semis
      // tslint:disable-next-line
      ;[reduced] = reduce(reduced, context)
    }
    return steps
  } catch (error) {
    context.errors.push(error)
    return steps
  }
}
