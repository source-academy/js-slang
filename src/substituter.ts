// import { generate } from 'astring'
import * as es from 'estree'
import * as errors from './interpreter-errors'
import { parse } from './parser'
import { Context } from './types'
import * as ast from './utils/astCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from './utils/operators'
import * as rttc from './utils/rttc'

function isIrreducible(node: es.Node, context: Context) {
  return ['Identifier', 'Literal', 'FunctionExpression'].includes(node.type)
}
const substituters = {
  Identifier(target: es.FunctionDeclaration | [es.Identifier, es.Literal], node: es.Identifier) {
    if (Array.isArray(target)) {
      const [id, lit] = target
      // only accept string, boolean and numbers for arguments, throw error if doesn't conform
      if (!['string', 'boolean', 'number'].includes(typeof lit.value)) {
        throw new rttc.TypeError(lit, '', 'string, boolean or number', typeof lit.value)
      } else {
        return node.name === id.name ? ast.primitive(lit.value) : substitute(target, node)
      }
    } else {
      const fn = target
      return node.name === fn.id!.name
        ? ast.functionExpression(fn.id, fn.params, fn.body, fn.loc!)
        : substitute(fn, node)
    }
  },
  ExpressionStatement(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.ExpressionStatement
  ) {
    const substedExpression = substitute(target, node.expression)
    return ast.expressionStatement(substedExpression as es.Expression, node.loc!)
  },
  BinaryExpression(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.BinaryExpression
  ) {
    const { left, right } = node
    const [substedLeft, substedRight] = [left, right].map(exp => substitute(target, exp))
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
    const substedArgument = substitute(target, argument)
    return ast.unaryExpression(node.operator, substedArgument as es.Expression, node.loc!)
  },
  // done. as model.
  ConditionalExpression(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.ConditionalExpression
  ) {
    const { test, consequent, alternate } = node
    const [substedTest, substedConsequent, substedAlternate] = [test, consequent, alternate].map(
      exp => substitute(target, exp) as es.Expression
    )
    return ast.conditionalExpression(substedTest, substedConsequent, substedAlternate, node.loc!)
  },
  // done (hopefully)
  CallExpression(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.CallExpression
  ) {
    const [callee, args] = [node.callee, node.arguments]
    const [substedCallee, ...substedArgs] = [callee, ...args].map(exp => substitute(target, exp))
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
    const [substedBody, ...substedParams] = [body, ...params].map(exp => substitute(target, exp))
    return ast.functionDeclaration(
      node.id,
      substedParams as es.Pattern[],
      substedBody as es.BlockStatement,
      node.loc!
    )
  },
  Program(target: es.FunctionDeclaration | [es.Identifier, es.Literal], node: es.Program) {
    const substedBody = node.body.map(exp => substitute(target, exp))
    return ast.program(substedBody as es.Statement[], node.loc!)
  },
  BlockStatement(
    target: es.FunctionDeclaration | [es.Identifier, es.Literal],
    node: es.BlockStatement
  ) {
    const substedBody = node.body.map(exp => substitute(target, exp))
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
    const substedArgument = substitute(target, arg as es.Node)
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
    return node // no need to subst, such as literals
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
  // console.log(`apply is called for ${callee.id}`)
  let substedBlock = callee.body
  for (let i = 0; i < args.length; i++) {
    // source discipline requires parameters to be identifiers.
    const param = callee.params[i] as es.Identifier
    const arg = args[i] as es.Literal
    // console.log(`param is ${param.name} and arg is ${arg.value}`)
    substedBlock = ast.blockStatement(
      substedBlock.body.map(stmt => substitute([param, arg], stmt) as es.Statement),
      callee.loc!
    )
  }
  // console.log(generate(substedBlock))
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
  ExpressionStatement(node: es.ExpressionStatement, context: Context): [es.Node, Context] {
    const [reducedExpression] = reduce(node.expression, context)
    return [ast.expressionStatement(reducedExpression as es.Expression, node.loc!), context]
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
  LogicalExpression(node: es.LogicalExpression, context: Context): [es.Node, Context] {
    const { left, right } = node
    if (left.type === 'Literal') {
      if (typeof left.value !== 'boolean') {
        throw new rttc.TypeError(
          left,
          ' on left hand side of operation',
          'boolean',
          typeof left.value
        )
      } else {
        if (right.type === 'Literal' && typeof right.value !== 'boolean') {
          throw new rttc.TypeError(
            left,
            ' on left hand side of operation',
            'boolean',
            typeof left.value
          )
        } else {
          const result =
            node.operator === '&&'
              ? left.value
                ? right
                : ast.expressionStatement(ast.literal(false, node.loc!))
              : left.value
              ? ast.expressionStatement(ast.literal(true, node.loc!))
              : right
          return [result as es.Node, context]
        }
      }
    } else {
      const [reducedLeft] = reduce(left, context)
      return [
        ast.logicalExpression(
          node.operator,
          reducedLeft as es.Expression,
          right,
          node.loc!
        ) as es.Node,
        context
      ]
    }
  },
  ConditionalExpression(node: es.ConditionalExpression, context: Context): [es.Node, Context] {
    const { test, consequent, alternate } = node
    if (test.type === 'Literal') {
      const error = rttc.checkIfStatement(node, test)
      if (error === undefined) {
        return [ast.expressionStatement(test.value ? consequent : alternate), context]
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
    // source 0: discipline: any expression can be transformed into either literal, ident(builtin) or funexp
    // if functor can reduce, reduce functor
    if (!['Literal', 'FunctionExpression', 'Identifier'].includes(callee.type)) {
      return [
        ast.callExpression(
          reduce(callee, context)[0] as es.Expression,
          args as es.Expression[],
          node.loc!
        ),
        context
      ]
    } else if (callee.type === 'Literal') {
      throw new errors.CallingNonFunctionValue(callee, node)
    } else if (
      callee.type === 'Identifier' &&
      !(callee.name in context.runtime.environments[0].head)
    ) {
      throw new errors.UndefinedVariable(callee.name, callee)
    } else {
      // callee is builtin or funexp
      if (callee.type === 'FunctionExpression' && args.length !== callee.params.length) {
        throw new errors.InvalidNumberOfArguments(node, args.length, callee.params.length)
      } else {
        for (let i = 0; i < args.length; i++) {
          const currentArg = args[i]
          if (!isIrreducible(currentArg, context)) {
            const reducedArgs = [
              ...args.slice(0, i),
              reduce(currentArg, context)[0],
              ...args.slice(i + 1)
            ]
            return [
              ast.callExpression(
                callee as es.Expression,
                reducedArgs as es.Expression[],
                node.loc!
              ),
              context
            ]
          }
          if (
            currentArg.type === 'Identifier' &&
            !(currentArg.name in context.runtime.environments[0].head)
          ) {
            throw new errors.UndefinedVariable(currentArg.name, currentArg)
          }
        }
      }
      // if it reaches here, means all the arguments are legal.
      return [
        callee.type === 'FunctionExpression'
          ? apply(callee as es.FunctionExpression, args as Array<es.Literal | es.Identifier>)
          : context.runtime.environments[0].head[name](...args),
        context
      ]
    }
  },
  Program(node: es.Program, context: Context): [es.Node, Context] {
    const [firstStatement, ...otherStatements] = node.body
    if (
      firstStatement.type === 'ExpressionStatement' &&
      (firstStatement.expression.type === 'Literal' ||
        firstStatement.expression.type === 'FunctionExpression')
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
    if (firstStatement.type === 'ReturnStatement') {
      const arg = firstStatement.argument as es.Expression
      if (isIrreducible(arg, context)) {
        return [arg, context]
      } else {
        const reducedReturn = ast.returnStatement(
          reduce(arg, context)[0] as es.Expression,
          firstStatement.loc!
        )
        return ast.blockStatement([reducedReturn, ...otherStatements], node.loc!)
      }
    } else if (
      firstStatement.type === 'ExpressionStatement' &&
      (firstStatement.expression.type === 'Literal' ||
        firstStatement.expression.type === 'FunctionExpression')
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
    // starts with substituting predefined fns.
    let [reduced] = substPredefinedFns(program, context)
    while ((reduced as es.Program).body.length > 0) {
      steps.push(reduced)
      // console.log(generate(reduced))
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
