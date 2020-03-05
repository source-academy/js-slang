import { generate } from 'astring'
import * as es from 'estree'
import * as errors from '../errors/errors'
import { parse } from '../parser/parser'
import { BlockExpression, Context, FunctionDeclarationExpression, substituterNodes } from '../types'
import * as ast from '../utils/astCreator'
import {
  dummyBlockExpression,
  dummyBlockStatement,
  dummyExpression,
  dummyProgram,
  dummyStatement,
  dummyVariableDeclarator
} from '../utils/dummyAstCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../utils/operators'
import * as rttc from '../utils/rttc'
import { nodeToValue, valueToExpression } from './converter'
import * as builtin from './lib'
import { getDeclaredNames, isAllowedLiterals, isBuiltinFunction, isNegNumber } from './util'

const irreducibleTypes = new Set<string>([
  'Literal',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ArrayExpression'
])

function isIrreducible(node: substituterNodes) {
  return (
    isBuiltinFunction(node) ||
    isAllowedLiterals(node) ||
    isNegNumber(node) ||
    irreducibleTypes.has(node.type)
  )
}

type irreducibleNodes =
  | es.FunctionExpression
  | es.ArrowFunctionExpression
  | es.Literal
  | es.ArrayExpression

/* tslint:disable:no-shadowed-variable */
// wrapper function, calls substitute immediately.
function substituteMain(
  name: es.Identifier,
  replacement: irreducibleNodes,
  target: substituterNodes
): substituterNodes {
  const seenBefore: Map<substituterNodes, substituterNodes> = new Map()
  /**
   * Substituters are invoked only when the target is not seen before,
   *  therefore each function has the responsbility of registering the
   *  [target, replacement] pair in seenBefore.
   * Substituter have two general steps:
   * 1. Create dummy replacement with 1. and push [target, dummyReplacement]
   *  into the seenBefore array.
   * 2. [recursive step] we substitute the children, and return the dummyReplacement.
   */
  const substituters = {
    Identifier(
      target: es.Identifier
    ): es.Identifier | FunctionDeclarationExpression | es.Literal | es.Expression {
      if (replacement.type === 'Literal') {
        // only accept string, boolean and numbers for arguments
        return target.name === name.name ? ast.primitive(replacement.value) : target
      } else {
        return target.name === name.name
          ? (substitute(replacement) as FunctionDeclarationExpression)
          : target
      }
    },

    ExpressionStatement(target: es.ExpressionStatement): es.ExpressionStatement {
      const substedExpressionStatement = ast.expressionStatement(dummyExpression())
      seenBefore.set(target, substedExpressionStatement)
      substedExpressionStatement.expression = substitute(target.expression) as es.Expression
      return substedExpressionStatement
    },

    BinaryExpression(target: es.BinaryExpression): es.BinaryExpression {
      const substedBinaryExpression = ast.binaryExpression(
        target.operator,
        dummyExpression(),
        dummyExpression(),
        target.loc!
      )
      seenBefore.set(target, substedBinaryExpression)
      substedBinaryExpression.left = substitute(target.left) as es.Expression
      substedBinaryExpression.right = substitute(target.right) as es.Expression
      return substedBinaryExpression
    },

    UnaryExpression(target: es.UnaryExpression): es.UnaryExpression {
      const substedUnaryExpression = ast.unaryExpression(
        target.operator,
        dummyExpression(),
        target.loc!
      )
      seenBefore.set(target, substedUnaryExpression)
      substedUnaryExpression.argument = substitute(target.argument) as es.Expression
      return substedUnaryExpression
    },

    ConditionalExpression(target: es.ConditionalExpression): es.ConditionalExpression {
      const substedConditionalExpression = ast.conditionalExpression(
        dummyExpression(),
        dummyExpression(),
        dummyExpression(),
        target.loc!
      )
      seenBefore.set(target, substedConditionalExpression)
      substedConditionalExpression.test = substitute(target.test) as es.Expression
      substedConditionalExpression.consequent = substitute(target.consequent) as es.Expression
      substedConditionalExpression.alternate = substitute(target.alternate) as es.Expression
      return substedConditionalExpression
    },

    LogicalExpression(target: es.LogicalExpression): es.LogicalExpression {
      const substedLocialExpression = ast.logicalExpression(
        target.operator,
        target.left,
        target.right
      )
      seenBefore.set(target, substedLocialExpression)
      substedLocialExpression.left = substitute(target.left) as es.Expression
      substedLocialExpression.right = substitute(target.right) as es.Expression
      return substedLocialExpression
    },

    CallExpression(target: es.CallExpression): es.CallExpression {
      const dummyArgs = target.arguments.map(() => dummyExpression())
      const substedCallExpression = ast.callExpression(dummyExpression(), dummyArgs, target.loc!)
      seenBefore.set(target, substedCallExpression)
      substedCallExpression.arguments = target.arguments.map(
        expn => substitute(expn) as es.Expression
      )
      substedCallExpression.callee = substitute(target.callee) as es.Expression
      return substedCallExpression
    },

    FunctionDeclaration(target: es.FunctionDeclaration): es.FunctionDeclaration {
      const substedFunctionDeclaration = ast.functionDeclaration(
        target.id,
        target.params,
        dummyBlockStatement()
      )
      seenBefore.set(target, substedFunctionDeclaration)
      // check for free/bounded variable
      for (const param of target.params) {
        if (param.type === 'Identifier' && param.name === name.name) {
          substedFunctionDeclaration.body = target.body
          return substedFunctionDeclaration
        }
      }
      substedFunctionDeclaration.body = substitute(target.body) as es.BlockStatement
      return substedFunctionDeclaration
    },

    FunctionExpression(target: es.FunctionExpression): es.FunctionExpression {
      const substedFunctionExpression = target.id
        ? ast.functionDeclarationExpression(target.id, target.params, dummyBlockStatement())
        : ast.functionExpression(target.params as es.Identifier[], dummyBlockStatement())
      seenBefore.set(target, substedFunctionExpression)
      // check for free/bounded variable
      for (const param of target.params) {
        if (param.type === 'Identifier' && param.name === name.name) {
          substedFunctionExpression.body = target.body
          return substedFunctionExpression
        }
      }
      substedFunctionExpression.body = substitute(target.body) as es.BlockStatement
      return substedFunctionExpression
    },

    Program(target: es.Program): es.Program {
      const substedProgram = ast.program(target.body.map(() => dummyStatement()))
      seenBefore.set(target, substedProgram)
      substedProgram.body = target.body.map(stmt => substitute(stmt) as es.Statement)
      return substedProgram
    },

    BlockStatement(target: es.BlockStatement): es.BlockStatement {
      const substedBody = target.body.map(() => dummyStatement())
      const substedBlockStatement = ast.blockStatement(substedBody)
      seenBefore.set(target, substedBlockStatement)
      const declaredNames: Set<string> = getDeclaredNames(target)
      if (declaredNames.has(name.name)) {
        substedBlockStatement.body = target.body
        return substedBlockStatement
      }
      substedBlockStatement.body = target.body.map(stmt => substitute(stmt) as es.Statement)
      return substedBlockStatement
    },

    BlockExpression(target: BlockExpression): BlockExpression {
      const substedBody = target.body.map(() => dummyStatement())
      const substedBlockExpression = ast.blockExpression(substedBody)
      seenBefore.set(target, substedBlockExpression)
      const declaredNames: Set<string> = getDeclaredNames(target)
      if (declaredNames.has(name.name)) {
        substedBlockExpression.body = target.body
        return substedBlockExpression
      }
      substedBlockExpression.body = target.body.map(stmt => substitute(stmt) as es.Statement)
      return substedBlockExpression
    },

    ReturnStatement(target: es.ReturnStatement): es.ReturnStatement {
      const substedReturnStatement = ast.returnStatement(dummyExpression(), target.loc!)
      seenBefore.set(target, substedReturnStatement)
      substedReturnStatement.argument = substitute(target.argument!) as es.Expression
      return substedReturnStatement
    },

    // source 1
    ArrowFunctionExpression(target: es.ArrowFunctionExpression): es.ArrowFunctionExpression {
      const substedArrow = ast.arrowFunctionExpression(target.params, dummyBlockStatement())
      seenBefore.set(target, substedArrow)
      // check for free/bounded variable
      for (const param of target.params) {
        if (param.type === 'Identifier' && param.name === name.name) {
          substedArrow.body = target.body
          substedArrow.expression = target.body.type !== 'BlockStatement'
          return substedArrow
        }
      }
      substedArrow.body = substitute(target.body) as es.BlockStatement | es.Expression
      substedArrow.expression = target.body.type !== 'BlockStatement'
      return substedArrow
    },

    VariableDeclaration(target: es.VariableDeclaration): es.VariableDeclaration {
      const substedVariableDeclaration = ast.variableDeclaration([dummyVariableDeclarator()])
      seenBefore.set(target, substedVariableDeclaration)
      substedVariableDeclaration.declarations = target.declarations.map(
        substitute
      ) as es.VariableDeclarator[]
      return substedVariableDeclaration
    },

    VariableDeclarator(target: es.VariableDeclarator): es.VariableDeclarator {
      const substedVariableDeclarator = ast.variableDeclarator(target.id, dummyExpression())
      seenBefore.set(target, substedVariableDeclarator)
      substedVariableDeclarator.init =
        target.id.type === 'Identifier' && name.name === target.id.name
          ? target.init
          : // in source, we only allow const, and hence init cannot be undefined
            (substitute(target.init!) as es.Expression)
      return substedVariableDeclarator
    },

    IfStatement(target: es.IfStatement): es.IfStatement {
      const substedIfStatement = ast.ifStatement(
        dummyExpression(),
        dummyBlockStatement(),
        dummyBlockStatement(),
        target.loc!
      )
      seenBefore.set(target, substedIfStatement)
      substedIfStatement.test = substitute(target.test) as es.Expression
      substedIfStatement.consequent = substitute(target.consequent) as es.BlockStatement
      substedIfStatement.alternate = target.alternate
        ? (substitute(target.alternate) as es.BlockStatement)
        : null
      return substedIfStatement
    },

    ArrayExpression(target: es.ArrayExpression): es.ArrayExpression {
      const substedArray = ast.arrayExpression([dummyExpression()])
      seenBefore.set(target, substedArray)
      substedArray.elements = target.elements.map(substitute) as es.Expression[]
      return substedArray
    }
  }

  /**
   * For mapper use, maps a [symbol, value] pair to the node supplied.
   * @param name the name to be replaced
   * @param replacement the expression to replace the name with
   * @param node a node holding the target symbols
   * @param seenBefore a list of nodes that are seen before in substitution
   */
  function substitute(target: substituterNodes): substituterNodes {
    const result = seenBefore.get(target)
    if (result) {
      return result as substituterNodes
    }
    const substituter = substituters[target.type]
    if (substituter === undefined) {
      seenBefore.set(target, target)
      return target // no need to subst, such as literals
    } else {
      // substituters are responsible of registering seenBefore
      return substituter(target)
    }
  }
  return substitute(target)
}

/**
 * Substitutes a call expression with the body of the callee (funExp)
 * and the body will have all ocurrences of parameters substituted
 * with the arguments.
 * @param call call expression with callee as functionExpression
 * @param args arguments supplied to the call expression
 */
function apply(
  callee: es.FunctionExpression | es.ArrowFunctionExpression,
  args: irreducibleNodes[]
): BlockExpression | es.Expression {
  let substedBody = callee.body
  for (let i = 0; i < args.length; i++) {
    // source discipline requires parameters to be identifiers.
    const param = callee.params[i] as es.Identifier
    const arg = args[i] as es.Literal

    substedBody = substituteMain(param, arg, substedBody) as typeof substedBody
  }

  if (callee.type === 'ArrowFunctionExpression' && callee.expression) {
    return substedBody as es.Expression
  }

  const firstStatement: es.Statement = (substedBody as es.BlockStatement).body[0]
  return firstStatement.type === 'ReturnStatement'
    ? (firstStatement.argument as es.Expression)
    : ast.blockExpression((substedBody as es.BlockStatement).body)
}

const reducers = {
  // source 0
  Identifier(node: es.Identifier, context: Context): [substituterNodes, Context] {
    // can only be built ins. the rest should have been declared
    if (!(isAllowedLiterals(node) || isBuiltinFunction(node))) {
      throw new errors.UndefinedVariable(node.name, node)
    } else {
      return [node, context]
    }
  },

  ExpressionStatement(node: es.ExpressionStatement, context: Context): [substituterNodes, Context] {
    const [reduced] = reduce(node.expression, context)
    return [ast.expressionStatement(reduced as es.Expression), context]
  },

  BinaryExpression(node: es.BinaryExpression, context: Context): [substituterNodes, Context] {
    const { operator, left, right } = node
    if (isIrreducible(left)) {
      if (isIrreducible(right)) {
        // if the ast are the same, then the values are the same
        if (
          builtin.is_function(left).value &&
          builtin.is_function(right).value &&
          operator === '==='
        ) {
          return [valueToExpression(left === right), context]
        }
        const [leftValue, rightValue] = [left, right].map(nodeToValue)
        const error = rttc.checkBinaryExpression(node, operator, leftValue, rightValue)
        if (error === undefined) {
          const lit = evaluateBinaryExpression(operator, leftValue, rightValue)
          return [valueToExpression(lit, context), context]
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

  UnaryExpression(node: es.UnaryExpression, context: Context): [substituterNodes, Context] {
    const { operator, argument } = node
    if (isIrreducible(argument)) {
      // tslint:disable-next-line
      const argumentValue = nodeToValue(argument)
      const error = rttc.checkUnaryExpression(node, operator, argumentValue)
      if (error === undefined) {
        const result = evaluateUnaryExpression(operator, argumentValue)
        return [valueToExpression(result, context), context]
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

  LogicalExpression(node: es.LogicalExpression, context: Context): [substituterNodes, Context] {
    const { left, right } = node
    if (isIrreducible(left)) {
      if (!(left.type === 'Literal' && typeof left.value === 'boolean')) {
        throw new rttc.TypeError(left, ' on left hand side of operation', 'boolean', left.type)
      } else {
        const result =
          node.operator === '&&'
            ? left.value
              ? right
              : ast.literal(false, node.loc!)
            : left.value
            ? ast.literal(true, node.loc!)
            : right
        return [result as es.Expression, context]
      }
    } else {
      const [reducedLeft] = reduce(left, context)
      return [
        ast.logicalExpression(
          node.operator,
          reducedLeft as es.Expression,
          right,
          node.loc!
        ) as substituterNodes,
        context
      ]
    }
  },

  ConditionalExpression(
    node: es.ConditionalExpression,
    context: Context
  ): [substituterNodes, Context] {
    const { test, consequent, alternate } = node
    if (test.type === 'Literal') {
      const error = rttc.checkIfStatement(node, test.value)
      if (error === undefined) {
        return [(test.value ? consequent : alternate) as es.Expression, context]
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
  CallExpression(node: es.CallExpression, context: Context): [substituterNodes, Context] {
    const [callee, args] = [node.callee, node.arguments]
    // source 0: discipline: any expression can be transformed into either literal, ident(builtin) or funexp
    // if functor can reduce, reduce functor
    if (!isIrreducible(callee)) {
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
      if (
        (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') &&
        args.length !== callee.params.length
      ) {
        throw new errors.InvalidNumberOfArguments(node, args.length, callee.params.length)
      } else {
        for (let i = 0; i < args.length; i++) {
          const currentArg = args[i]
          if (!isIrreducible(currentArg)) {
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
      if (['FunctionExpression', 'ArrowFunctionExpression'].includes(callee.type)) {
        return [apply(callee as FunctionDeclarationExpression, args as es.Literal[]), context]
      } else {
        if ((callee as es.Identifier).name.includes('math')) {
          return [builtin.evaluateMath((callee as es.Identifier).name, ...args), context]
        }
        return [builtin[(callee as es.Identifier).name](...args), context]
      }
    }
  },

  Program(node: es.Program, context: Context): [substituterNodes, Context] {
    const [firstStatement, ...otherStatements] = node.body
    if (firstStatement.type === 'ExpressionStatement' && isIrreducible(firstStatement.expression)) {
      return [ast.program(otherStatements as es.Statement[]), context]
    } else if (firstStatement.type === 'FunctionDeclaration') {
      let funDecExp = ast.functionDeclarationExpression(
        firstStatement.id!,
        firstStatement.params,
        firstStatement.body
      ) as FunctionDeclarationExpression
      // substitute body
      funDecExp = substituteMain(
        funDecExp.id,
        funDecExp,
        funDecExp
      ) as FunctionDeclarationExpression
      // substitute the rest of the program
      const remainingProgram = ast.program(otherStatements as es.Statement[])
      return [substituteMain(funDecExp.id, funDecExp, remainingProgram), context]
    } else if (firstStatement.type === 'VariableDeclaration') {
      const { kind, declarations } = firstStatement
      if (kind !== 'const') {
        // TODO: cannot use let or var
        return [dummyProgram(), context]
      } else if (
        declarations.length <= 0 ||
        declarations.length > 1 ||
        declarations[0].type !== 'VariableDeclarator' ||
        !declarations[0].init
      ) {
        // TODO: syntax error
        return [dummyProgram(), context]
      } else {
        const declarator = declarations[0] as es.VariableDeclarator
        const rhs = declarator.init!
        if (declarator.id.type !== 'Identifier') {
          // TODO: source does not allow destructuring
          return [dummyProgram(), context]
        } else if (isIrreducible(rhs)) {
          const remainingProgram = ast.program(otherStatements as es.Statement[])
          // forced casting for some weird errors
          return [
            substituteMain(declarator.id, rhs as es.ArrayExpression, remainingProgram),
            context
          ]
        } else if (rhs.type === 'ArrowFunctionExpression' || rhs.type === 'FunctionExpression') {
          let funDecExp = ast.functionDeclarationExpression(
            declarator.id,
            rhs.params,
            rhs.body.type === 'BlockStatement'
              ? rhs.body
              : ast.blockStatement([ast.returnStatement(rhs.body)])
          ) as FunctionDeclarationExpression
          // substitute body
          funDecExp = substituteMain(
            funDecExp.id,
            funDecExp,
            funDecExp
          ) as FunctionDeclarationExpression
          // substitute the rest of the program
          const remainingProgram = ast.program(otherStatements as es.Statement[])
          return [substituteMain(funDecExp.id, funDecExp, remainingProgram), context]
        } else {
          const [reducedRhs] = reduce(rhs, context)
          return [
            ast.program([
              ast.declaration(
                declarator.id.name,
                'const',
                reducedRhs as es.Expression
              ) as es.Statement,
              ...(otherStatements as es.Statement[])
            ]),
            context
          ]
        }
      }
    }
    const [reduced] = reduce(firstStatement, context)
    return [ast.program([reduced as es.Statement, ...(otherStatements as es.Statement[])]), context]
  },

  BlockStatement(node: es.BlockStatement, context: Context): [substituterNodes, Context] {
    const [firstStatement, ...otherStatements] = node.body
    if (firstStatement.type === 'ReturnStatement') {
      const arg = firstStatement.argument as es.Expression
      if (isIrreducible(arg)) {
        return [firstStatement, context]
      } else {
        const reducedReturn = ast.returnStatement(
          reduce(arg, context)[0] as es.Expression,
          firstStatement.loc!
        )
        return [ast.blockStatement([reducedReturn, ...otherStatements]), context]
      }
    } else if (
      firstStatement.type === 'ExpressionStatement' &&
      isIrreducible(firstStatement.expression)
    ) {
      return [
        otherStatements.length > 0
          ? ast.blockStatement(otherStatements as es.Statement[])
          : ast.expressionStatement(ast.identifier('undefined')),
        context
      ]
    } else if (firstStatement.type === 'FunctionDeclaration') {
      let funDecExp = ast.functionDeclarationExpression(
        firstStatement.id!,
        firstStatement.params,
        firstStatement.body
      ) as FunctionDeclarationExpression
      // substitute body
      funDecExp = substituteMain(
        funDecExp.id,
        funDecExp,
        funDecExp
      ) as FunctionDeclarationExpression
      // substitute the rest of the blockStatement
      const remainingBlockStatement = ast.blockStatement(otherStatements as es.Statement[])
      return [substituteMain(funDecExp.id, funDecExp, remainingBlockStatement), context]
    } else if (firstStatement.type === 'VariableDeclaration') {
      const { kind, declarations } = firstStatement
      if (kind !== 'const') {
        // TODO: cannot use let or var
        return [dummyBlockStatement(), context]
      } else if (
        declarations.length <= 0 ||
        declarations.length > 1 ||
        declarations[0].type !== 'VariableDeclarator' ||
        !declarations[0].init
      ) {
        // TODO: syntax error
        return [dummyBlockStatement(), context]
      } else {
        const declarator = declarations[0] as es.VariableDeclarator
        const rhs = declarator.init!
        if (declarator.id.type !== 'Identifier') {
          // TODO: source does not allow destructuring
          return [dummyBlockStatement(), context]
        } else if (isIrreducible(rhs)) {
          const remainingBlockStatement = ast.blockStatement(otherStatements as es.Statement[])
          // force casting for weird errors
          return [
            substituteMain(declarator.id, rhs as es.ArrayExpression, remainingBlockStatement),
            context
          ]
        } else if (rhs.type === 'ArrowFunctionExpression' || rhs.type === 'FunctionExpression') {
          let funDecExp = ast.functionDeclarationExpression(
            declarator.id,
            rhs.params,
            rhs.body.type === 'BlockStatement'
              ? rhs.body
              : ast.blockStatement([ast.returnStatement(rhs.body)])
          ) as FunctionDeclarationExpression
          // substitute body
          funDecExp = substituteMain(
            funDecExp.id,
            funDecExp,
            funDecExp
          ) as FunctionDeclarationExpression
          // substitute the rest of the blockStatement
          const remainingBlockStatement = ast.blockStatement(otherStatements as es.Statement[])
          return [substituteMain(funDecExp.id, funDecExp, remainingBlockStatement), context]
        } else {
          const [reducedRhs] = reduce(rhs, context)
          return [
            ast.blockStatement([
              ast.declaration(
                declarator.id.name,
                'const',
                reducedRhs as es.Expression
              ) as es.Statement,
              ...(otherStatements as es.Statement[])
            ]),
            context
          ]
        }
      }
    }
    const [reduced] = reduce(firstStatement, context)
    return [
      ast.blockStatement([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
      context
    ]
  },

  BlockExpression(node: BlockExpression, context: Context): [substituterNodes, Context] {
    const [firstStatement, ...otherStatements] = node.body
    if (firstStatement.type === 'ReturnStatement') {
      const arg = firstStatement.argument as es.Expression
      if (isIrreducible(arg)) {
        return [arg, context]
      } else {
        const reducedReturn = ast.returnStatement(
          reduce(arg, context)[0] as es.Expression,
          firstStatement.loc!
        )
        return [ast.blockExpression([reducedReturn, ...otherStatements]), context]
      }
    } else if (
      firstStatement.type === 'ExpressionStatement' &&
      isIrreducible(firstStatement.expression)
    ) {
      return [
        otherStatements.length > 0
          ? ast.blockExpression(otherStatements as es.Statement[])
          : ast.identifier('undefined'),
        context
      ]
    } else if (firstStatement.type === 'FunctionDeclaration') {
      let funDecExp = ast.functionDeclarationExpression(
        firstStatement.id!,
        firstStatement.params,
        firstStatement.body
      ) as FunctionDeclarationExpression
      // substitute body
      funDecExp = substituteMain(
        funDecExp.id,
        funDecExp,
        funDecExp
      ) as FunctionDeclarationExpression
      // substitute the rest of the blockExpression
      const remainingBlockExpression = ast.blockExpression(otherStatements as es.Statement[])
      return [substituteMain(funDecExp.id, funDecExp, remainingBlockExpression), context]
    } else if (firstStatement.type === 'VariableDeclaration') {
      const { kind, declarations } = firstStatement
      if (kind !== 'const') {
        // TODO: cannot use let or var
        return [dummyBlockExpression(), context]
      } else if (
        declarations.length <= 0 ||
        declarations.length > 1 ||
        declarations[0].type !== 'VariableDeclarator' ||
        !declarations[0].init
      ) {
        // TODO: syntax error
        return [dummyBlockExpression(), context]
      } else {
        const declarator = declarations[0] as es.VariableDeclarator
        const rhs = declarator.init!
        if (declarator.id.type !== 'Identifier') {
          // TODO: source does not allow destructuring
          return [dummyBlockExpression(), context]
        } else if (isIrreducible(rhs)) {
          const remainingBlockExpression = ast.blockExpression(otherStatements as es.Statement[])
          // forced casting for some weird errors
          return [
            substituteMain(declarator.id, rhs as es.ArrayExpression, remainingBlockExpression),
            context
          ]
        } else if (rhs.type === 'ArrowFunctionExpression' || rhs.type === 'FunctionExpression') {
          let funDecExp = ast.functionDeclarationExpression(
            declarator.id,
            rhs.params,
            rhs.body.type === 'BlockStatement'
              ? rhs.body
              : ast.blockStatement([ast.returnStatement(rhs.body)])
          ) as FunctionDeclarationExpression
          // substitute body
          funDecExp = substituteMain(
            funDecExp.id,
            funDecExp,
            funDecExp
          ) as FunctionDeclarationExpression
          // substitute the rest of the blockExpression
          const remainingBlockExpression = ast.blockExpression(otherStatements as es.Statement[])
          return [substituteMain(funDecExp.id, funDecExp, remainingBlockExpression), context]
        } else {
          const [reducedRhs] = reduce(rhs, context)
          return [
            ast.blockExpression([
              ast.declaration(
                declarator.id.name,
                'const',
                reducedRhs as es.Expression
              ) as es.Statement,
              ...(otherStatements as es.Statement[])
            ]),
            context
          ]
        }
      }
    }
    const [reduced] = reduce(firstStatement, context)
    return [
      ast.blockExpression([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
      context
    ]
  },

  // source 1
  IfStatement(node: es.IfStatement, context: Context): [substituterNodes, Context] {
    const { test, consequent, alternate } = node
    if (test.type === 'Literal') {
      const error = rttc.checkIfStatement(node, test.value)
      if (error === undefined) {
        return [(test.value ? consequent : alternate) as es.Statement, context]
      } else {
        throw error
      }
    } else {
      const [reducedTest] = reduce(test, context)
      const reducedIfStatement = ast.ifStatement(
        reducedTest as es.Expression,
        consequent as es.BlockStatement,
        alternate as es.IfStatement | es.BlockStatement,
        node.loc!
      )
      return [reducedIfStatement, context]
    }
  }
}

function reduce(node: substituterNodes, context: Context): [substituterNodes, Context] {
  const reducer = reducers[node.type]
  if (reducer === undefined) {
    return [ast.program([]), context] // exit early
    // return [node, context] // if reducer is not found we just get stuck
  } else {
    return reducer(node, context)
  }
}

// Main creates a scope for us to control the verbosity
function treeifyMain(target: substituterNodes): substituterNodes {
  // recurse down the program like substitute
  // if see a function at expression position,
  //   has an identifier: replace with the name
  //   else: replace with an identifer "=>"
  let verbose = true
  const treeifiers = {
    // Identifier: return
    ExpressionStatement: (target: es.ExpressionStatement): es.ExpressionStatement => {
      return ast.expressionStatement(treeify(target.expression) as es.Expression)
    },

    BinaryExpression: (target: es.BinaryExpression) => {
      return ast.binaryExpression(
        target.operator,
        treeify(target.left) as es.Expression,
        treeify(target.right) as es.Expression
      )
    },

    LogicalExpression: (target: es.LogicalExpression) => {
      return ast.logicalExpression(
        target.operator,
        treeify(target.left) as es.Expression,
        treeify(target.right) as es.Expression
      )
    },

    UnaryExpression: (target: es.UnaryExpression): es.UnaryExpression => {
      return ast.unaryExpression(target.operator, treeify(target.argument) as es.Expression)
    },

    ConditionalExpression: (target: es.ConditionalExpression): es.ConditionalExpression => {
      return ast.conditionalExpression(
        treeify(target.test) as es.Expression,
        treeify(target.consequent) as es.Expression,
        treeify(target.alternate) as es.Expression
      )
    },

    CallExpression: (target: es.CallExpression): es.CallExpression => {
      return ast.callExpression(
        treeify(target.callee) as es.Expression,
        target.arguments.map(arg => treeify(arg) as es.Expression)
      )
    },

    FunctionDeclaration: (target: es.FunctionDeclaration): es.FunctionDeclaration => {
      return ast.functionDeclaration(
        target.id,
        target.params,
        treeify(target.body) as es.BlockStatement
      )
    },

    // CORE
    FunctionExpression: (
      target: es.FunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression => {
      if (target.id) {
        return target.id
      } else if (verbose) {
        // here onwards is guarding against arrow turned function expressions
        verbose = false
        const redacted = ast.arrowFunctionExpression(
          target.params,
          treeify(target.body) as es.BlockStatement
        )
        verbose = true
        return redacted
      } else {
        // simplify the body with ellipses
        return ast.arrowFunctionExpression(target.params, ast.identifier('...'))
      }
    },

    Program: (target: es.Program): es.Program => {
      return ast.program(target.body.map(stmt => treeify(stmt) as es.Statement))
    },

    BlockStatement: (target: es.BlockStatement): es.BlockStatement => {
      return ast.blockStatement(target.body.map(stmt => treeify(stmt) as es.Statement))
    },

    ReturnStatement: (target: es.ReturnStatement): es.ReturnStatement => {
      return ast.returnStatement(treeify(target.argument!) as es.Expression)
    },

    BlockExpression: (target: BlockExpression): es.BlockStatement => {
      return ast.blockStatement(target.body.map(treeify) as es.Statement[])
    },

    // source 1
    VariableDeclaration: (target: es.VariableDeclaration): es.VariableDeclaration => {
      return ast.variableDeclaration(target.declarations.map(treeify) as es.VariableDeclarator[])
    },

    VariableDeclarator: (target: es.VariableDeclarator): es.VariableDeclarator => {
      return ast.variableDeclarator(target.id, treeify(target.init!) as es.Expression)
    },

    IfStatement: (target: es.IfStatement): es.IfStatement => {
      return ast.ifStatement(
        treeify(target.test) as es.Expression,
        treeify(target.consequent) as es.BlockStatement,
        treeify(target.alternate!) as es.BlockStatement | es.IfStatement
      )
    },

    // CORE
    ArrowFunctionExpression: (
      target: es.ArrowFunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression => {
      if (verbose) {
        // here onwards is guarding against arrow turned function expressions
        verbose = false
        const redacted = ast.arrowFunctionExpression(
          target.params,
          treeify(target.body) as es.BlockStatement
        )
        verbose = true
        return redacted
      } else {
        // simplify the body with ellipses
        return ast.arrowFunctionExpression(target.params, ast.identifier('...'))
      }
    },

    // source 2
    ArrayExpression: (target: es.ArrayExpression): es.ArrayExpression => {
      return ast.arrayExpression(target.elements.map(treeify) as es.Expression[])
    }
  }

  function treeify(target: substituterNodes): substituterNodes {
    const treeifier = treeifiers[target.type]
    if (treeifier === undefined) {
      return target
    } else {
      return treeifier(target)
    }
  }

  return treeify(target)
}

export const codify = (node: substituterNodes): string => generate(treeifyMain(node))

// strategy: we remember how many statements are there originally in program.
// since listPrelude are just functions, they will be disposed of one by one
// we prepend the program with the program resulting from the definitions,
//   and reduce the combined program until the program body
//   has number of statement === original program
// then we return it to the getEvaluationSteps
function substPredefinedFns(program: es.Program, context: Context): [es.Program, Context] {
  const originalStatementCount = program.body.length
  let combinedProgram = program
  if (context.prelude) {
    // evaluate the list prelude first
    const listPreludeProgram = parse(context.prelude, context)!
    combinedProgram.body = listPreludeProgram.body.concat(program.body)
  }
  while (combinedProgram.body.length > originalStatementCount) {
    // some bug with no semis
    // tslint:disable-next-line
    ;[combinedProgram] = reduce(combinedProgram, context) as [es.Program, Context]
  }
  return [combinedProgram, context]
}

function substPredefinedConstants(program: es.Program): es.Program {
  const constants = [['undefined', undefined]]
  const mathConstants = Object.getOwnPropertyNames(Math)
    .filter(name => typeof Math[name] !== 'function')
    .map(name => ['math_' + name, Math[name]])
  let substed = program
  for (const nameValuePair of constants.concat(mathConstants)) {
    substed = substituteMain(
      ast.identifier(nameValuePair[0] as string),
      ast.literal(nameValuePair[1] as string | number) as es.Literal,
      substed
    ) as es.Program
  }
  return substed
}

// the context here is for builtins
export function getEvaluationSteps(program: es.Program, context: Context): es.Program[] {
  const steps: es.Program[] = []
  try {
    // starts with substituting predefined constants
    let reduced = substPredefinedConstants(program)
    // and predefined fns.
    reduced = substPredefinedFns(reduced, context)[0]
    while ((reduced as es.Program).body.length > 0) {
      if (steps.length === 19999) {
        steps.push(
          ast.program([ast.expressionStatement(ast.identifier('Maximum number of steps exceeded'))])
        )
        break
      }
      steps.push(reduced as es.Program)
      reduced = reduce(reduced, context)[0] as es.Program
    }
    return steps
  } catch (error) {
    context.errors.push(error)
    return steps
  }
}
