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
  target: substituterNodes,
  paths: string[][]
): [substituterNodes, string[][]] {
  const seenBefore: Map<substituterNodes, substituterNodes> = new Map()

  // initialises array to keep track of all paths visited
  // without modifying input path array
  const allPaths: string[][] = []
  let allPathsIndex = 0
  const endMarker = '$'

  if (paths[0] === undefined) {
    allPaths.push([])
  } else {
    allPaths.push([...paths[0]])
  }

  // substituters will stop expanding the path if index === -1
  const pathNotEnded = (index: number) => index > -1

  // branches out path into two different paths,
  // returns array index of branched path
  function branch(index: number): number {
    allPathsIndex++
    allPaths[allPathsIndex] = [...allPaths[index]]
    return allPathsIndex
  }

  /**
   * Substituters are invoked only when the target is not seen before,
   *  therefore each function has the responsbility of registering the
   *  [target, replacement] pair in seenBefore.
   * How substituters work:
   * 1. Create dummy replacement and push [target, dummyReplacement]
   *    into the seenBefore array.
   * 2. [Recursive step] substitute the children;
   *    for each child, branch out the current path
   *    and push the appropriate access string into the path
   * 3. Return the dummyReplacement
   */
  const substituters = {
    // if name to be replaced is found,
    // push endMarker into path
    Identifier(
      target: es.Identifier,
      index: number
    ): es.Identifier | FunctionDeclarationExpression | es.Literal | es.Expression {
      if (replacement.type === 'Literal') {
        // only accept string, boolean and numbers for arguments
        if (target.name === name.name) {
          if (pathNotEnded(index)) {
            allPaths[index].push(endMarker)
          }
          return ast.primitive(replacement.value)
        } else {
          return target
        }
      } else {
        if (target.name === name.name) {
          if (pathNotEnded(index)) {
            allPaths[index].push(endMarker)
          }
          return substitute(replacement, -1) as FunctionDeclarationExpression
        } else {
          return target
        }
      }
    },

    ExpressionStatement(target: es.ExpressionStatement, index: number): es.ExpressionStatement {
      const substedExpressionStatement = ast.expressionStatement(dummyExpression())
      seenBefore.set(target, substedExpressionStatement)
      if (pathNotEnded(index)) {
        allPaths[index].push('expression')
      }
      substedExpressionStatement.expression = substitute(target.expression, index) as es.Expression
      return substedExpressionStatement
    },

    BinaryExpression(target: es.BinaryExpression, index: number): es.BinaryExpression {
      const substedBinaryExpression = ast.binaryExpression(
        target.operator,
        dummyExpression(),
        dummyExpression(),
        target.loc!
      )
      seenBefore.set(target, substedBinaryExpression)
      let nextIndex = index
      if (pathNotEnded(index)) {
        nextIndex = branch(index)
        allPaths[index].push('left')
        allPaths[nextIndex].push('right')
      }
      substedBinaryExpression.left = substitute(target.left, index) as es.Expression
      substedBinaryExpression.right = substitute(target.right, nextIndex) as es.Expression
      return substedBinaryExpression
    },

    UnaryExpression(target: es.UnaryExpression, index: number): es.UnaryExpression {
      const substedUnaryExpression = ast.unaryExpression(
        target.operator,
        dummyExpression(),
        target.loc!
      )
      seenBefore.set(target, substedUnaryExpression)
      if (pathNotEnded(index)) {
        allPaths[index].push('argument')
      }
      substedUnaryExpression.argument = substitute(target.argument, index) as es.Expression
      return substedUnaryExpression
    },

    ConditionalExpression(
      target: es.ConditionalExpression,
      index: number
    ): es.ConditionalExpression {
      const substedConditionalExpression = ast.conditionalExpression(
        dummyExpression(),
        dummyExpression(),
        dummyExpression(),
        target.loc!
      )
      seenBefore.set(target, substedConditionalExpression)
      let nextIndex = index
      let thirdIndex = index
      if (pathNotEnded(index)) {
        nextIndex = branch(index)
        thirdIndex = branch(index)
        allPaths[index].push('test')
        allPaths[nextIndex].push('consequent')
        allPaths[thirdIndex].push('alternate')
      }
      substedConditionalExpression.test = substitute(target.test, index) as es.Expression
      substedConditionalExpression.consequent = substitute(
        target.consequent,
        nextIndex
      ) as es.Expression
      substedConditionalExpression.alternate = substitute(
        target.alternate,
        thirdIndex
      ) as es.Expression
      return substedConditionalExpression
    },

    LogicalExpression(target: es.LogicalExpression, index: number): es.LogicalExpression {
      const substedLocialExpression = ast.logicalExpression(
        target.operator,
        target.left,
        target.right
      )
      seenBefore.set(target, substedLocialExpression)
      let nextIndex = index
      if (pathNotEnded(index)) {
        nextIndex = branch(index)
        allPaths[index].push('left')
        allPaths[nextIndex].push('right')
      }
      substedLocialExpression.left = substitute(target.left, index) as es.Expression
      substedLocialExpression.right = substitute(target.right, nextIndex) as es.Expression
      return substedLocialExpression
    },

    CallExpression(target: es.CallExpression, index: number): es.CallExpression {
      const dummyArgs = target.arguments.map(() => dummyExpression())
      const substedCallExpression = ast.callExpression(dummyExpression(), dummyArgs, target.loc!)
      seenBefore.set(target, substedCallExpression)
      const arr: number[] = []
      let nextIndex = index
      for (let i = 0; i < target.arguments.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('arguments[' + i + ']')
        }
        arr[i] = nextIndex
        dummyArgs[i] = substitute(target.arguments[i], nextIndex) as es.Expression
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('callee')
      }
      substedCallExpression.callee = substitute(target.callee, index) as es.Expression
      return substedCallExpression
    },

    FunctionDeclaration(target: es.FunctionDeclaration, index: number): es.FunctionDeclaration {
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
      if (pathNotEnded(index)) {
        allPaths[index].push('body')
      }
      substedFunctionDeclaration.body = substitute(target.body, index) as es.BlockStatement
      return substedFunctionDeclaration
    },

    FunctionExpression(target: es.FunctionExpression, index: number): es.FunctionExpression {
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
      if (pathNotEnded(index)) {
        allPaths[index].push('body')
      }
      substedFunctionExpression.body = substitute(target.body, index) as es.BlockStatement
      return substedFunctionExpression
    },

    Program(target: es.Program, index: number): es.Program {
      const substedProgram = ast.program(target.body.map(() => dummyStatement()))
      seenBefore.set(target, substedProgram)
      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.body.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('body[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('body[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedProgram.body = target.body.map(stmt => {
        arrIndex++
        return substitute(stmt, arr[arrIndex]) as es.Statement
      })
      return substedProgram
    },

    BlockStatement(target: es.BlockStatement, index: number): es.BlockStatement {
      const substedBody = target.body.map(() => dummyStatement())
      const substedBlockStatement = ast.blockStatement(substedBody)
      seenBefore.set(target, substedBlockStatement)
      const declaredNames: Set<string> = getDeclaredNames(target)
      if (declaredNames.has(name.name)) {
        substedBlockStatement.body = target.body
        return substedBlockStatement
      }
      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.body.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('body[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('body[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedBlockStatement.body = target.body.map(stmt => {
        arrIndex++
        return substitute(stmt, arr[arrIndex]) as es.Statement
      })
      return substedBlockStatement
    },

    BlockExpression(target: BlockExpression, index: number): BlockExpression {
      const substedBody = target.body.map(() => dummyStatement())
      const substedBlockExpression = ast.blockExpression(substedBody)
      seenBefore.set(target, substedBlockExpression)
      const declaredNames: Set<string> = getDeclaredNames(target)
      if (declaredNames.has(name.name)) {
        substedBlockExpression.body = target.body
        return substedBlockExpression
      }
      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.body.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('body[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('body[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedBlockExpression.body = target.body.map(stmt => {
        arrIndex++
        return substitute(stmt, arr[arrIndex]) as es.Statement
      })
      return substedBlockExpression
    },

    ReturnStatement(target: es.ReturnStatement, index: number): es.ReturnStatement {
      const substedReturnStatement = ast.returnStatement(dummyExpression(), target.loc!)
      seenBefore.set(target, substedReturnStatement)
      if (pathNotEnded(index)) {
        allPaths[index].push('argument')
      }
      substedReturnStatement.argument = substitute(target.argument!, index) as es.Expression
      return substedReturnStatement
    },

    // source 1
    ArrowFunctionExpression(
      target: es.ArrowFunctionExpression,
      index: number
    ): es.ArrowFunctionExpression {
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
      if (pathNotEnded(index)) {
        allPaths[index].push('body')
      }
      substedArrow.body = substitute(target.body, index) as es.BlockStatement | es.Expression
      substedArrow.expression = target.body.type !== 'BlockStatement'
      return substedArrow
    },

    VariableDeclaration(target: es.VariableDeclaration, index: number): es.VariableDeclaration {
      const substedVariableDeclaration = ast.variableDeclaration([dummyVariableDeclarator()])
      seenBefore.set(target, substedVariableDeclaration)
      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.declarations.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('declarations[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('declarations[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedVariableDeclaration.declarations = target.declarations.map(dec => {
        arrIndex++
        return substitute(dec, arr[arrIndex]) as es.VariableDeclarator
      })
      return substedVariableDeclaration
    },

    VariableDeclarator(target: es.VariableDeclarator, index: number): es.VariableDeclarator {
      const substedVariableDeclarator = ast.variableDeclarator(target.id, dummyExpression())
      seenBefore.set(target, substedVariableDeclarator)
      if (target.id.type === 'Identifier' && name.name === target.id.name) {
        substedVariableDeclarator.init = target.init
      } else {
        if (pathNotEnded(index)) {
          allPaths[index].push('init')
        }
        substedVariableDeclarator.init = substitute(target.init!, index) as es.Expression
      }
      return substedVariableDeclarator
    },

    IfStatement(target: es.IfStatement, index: number): es.IfStatement {
      const substedIfStatement = ast.ifStatement(
        dummyExpression(),
        dummyBlockStatement(),
        dummyBlockStatement(),
        target.loc!
      )
      seenBefore.set(target, substedIfStatement)
      let nextIndex = index
      let thirdIndex = index
      if (pathNotEnded(index)) {
        nextIndex = branch(index)
        thirdIndex = branch(index)
        allPaths[index].push('test')
        allPaths[nextIndex].push('consequent')
        allPaths[thirdIndex].push('alternate')
      }
      substedIfStatement.test = substitute(target.test, index) as es.Expression
      substedIfStatement.consequent = substitute(target.consequent, nextIndex) as es.BlockStatement
      substedIfStatement.alternate = target.alternate
        ? (substitute(target.alternate, thirdIndex) as es.BlockStatement)
        : null
      return substedIfStatement
    },

    ArrayExpression(target: es.ArrayExpression, index: number): es.ArrayExpression {
      const substedArray = ast.arrayExpression([dummyExpression()])
      seenBefore.set(target, substedArray)
      const arr: number[] = []
      let nextIndex = index
      for (let i = 1; i < target.elements.length; i++) {
        if (pathNotEnded(index)) {
          nextIndex = branch(index)
          allPaths[nextIndex].push('elements[' + i + ']')
        }
        arr[i] = nextIndex
      }
      if (pathNotEnded(index)) {
        allPaths[index].push('elements[0]')
      }
      arr[0] = index
      let arrIndex = -1
      substedArray.elements = target.elements.map(ele => {
        arrIndex++
        return substitute(ele, arr[arrIndex]) as es.Expression
      })
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
  function substitute(target: substituterNodes, index: number): substituterNodes {
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
      return substituter(target, index)
    }
  }

  // after running substitute,
  // find paths that contain endMarker
  // and return only those paths
  const substituted = substitute(target, 0)
  const validPaths: string[][] = []
  for (const path of allPaths) {
    if (path[path.length - 1] === endMarker) {
      validPaths.push(path.slice(0, path.length - 1))
    }
  }
  return [substituted, validPaths]
}

/**
 * Substitutes a call expression with the body of the callee (funExp)
 * and the body will have all ocurrences of parameters substituted
 * with the arguments.
 * @param callee call expression with callee as functionExpression
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

    substedBody = substituteMain(param, arg, substedBody, [[]])[0] as typeof substedBody
  }

  if (callee.type === 'ArrowFunctionExpression' && callee.expression) {
    return substedBody as es.Expression
  }

  const firstStatement: es.Statement = (substedBody as es.BlockStatement).body[0]
  return firstStatement.type === 'ReturnStatement'
    ? (firstStatement.argument as es.Expression)
    : ast.blockExpression((substedBody as es.BlockStatement).body)
}

// Wrapper function to house reduce, explain and bodify
function reduceMain(
  node: substituterNodes,
  context: Context
): [substituterNodes, Context, string[][], string] {
  // variable to control verbosity of bodify
  let verbose = true

  // converts body of code to string
  function bodify(target: substituterNodes): string {
    const bodifiers = {
      Literal: (target: es.Literal): string =>
        target.raw !== undefined ? target.raw : String(target.value),

      Identifier: (target: es.Identifier): string => target.name,

      ExpressionStatement: (target: es.ExpressionStatement): string =>
        bodify(target.expression) + ' finished evaluating',

      BinaryExpression: (target: es.BinaryExpression): string =>
        bodify(target.left) + ' ' + target.operator + ' ' + bodify(target.right),

      UnaryExpression: (target: es.UnaryExpression): string =>
        target.operator + bodify(target.argument),

      ConditionalExpression: (target: es.ConditionalExpression): string =>
        bodify(target.test) + ' ? ' + bodify(target.consequent) + ' : ' + bodify(target.alternate),

      LogicalExpression: (target: es.LogicalExpression): string =>
        bodify(target.left) + ' ' + target.operator + ' ' + bodify(target.right),

      CallExpression: (target: es.CallExpression): string => {
        if (target.callee.type === 'ArrowFunctionExpression') {
          return '(' + bodify(target.callee) + ')(' + target.arguments.map(bodify) + ')'
        } else {
          return bodify(target.callee) + '(' + target.arguments.map(bodify) + ')'
        }
      },

      FunctionDeclaration: (target: es.FunctionDeclaration): string => {
        const funcName = target.id !== null ? target.id.name : 'error'
        return (
          'Function ' +
          funcName +
          ' declared' +
          (target.params.length > 0
            ? ', parameter(s) ' + target.params.map(bodify) + ' required'
            : '')
        )
      },

      FunctionExpression: (target: es.FunctionExpression): string => {
        const id = target.id
        return id === null || id === undefined ? '...' : id.name
      },

      ReturnStatement: (target: es.ReturnStatement): string =>
        bodify(target.argument as es.Expression) + ' returned',

      // guards against infinite text generation
      ArrowFunctionExpression: (target: es.ArrowFunctionExpression): string => {
        if (verbose) {
          verbose = false
          const redacted =
            (target.params.length > 0 ? target.params.map(bodify) : '()') +
            ' => ' +
            bodify(target.body)
          verbose = true
          return redacted
        } else {
          return (target.params.length > 0 ? target.params.map(bodify) : '()') + ' => ...'
        }
      },

      VariableDeclaration: (target: es.VariableDeclaration): string =>
        'Constant ' +
        bodify(target.declarations[0].id) +
        ' declared and substituted into rest of block',

      ArrayExpression: (target: es.ArrayExpression): string =>
        target.elements.map(bodify).toString()
    }

    const bodifier = bodifiers[target.type]
    return bodifier === undefined ? '...' : bodifier(target)
  }

  // generates string to explain current step
  function explain(target: substituterNodes): string {
    const explainers = {
      BinaryExpression: (target: es.BinaryExpression): string =>
        'Binary expression ' + bodify(target) + ' evaluated',

      UnaryExpression: (target: es.UnaryExpression): string => {
        return (
          'Unary expression evaluated, ' +
          (target.operator === '!' ? 'boolean ' : 'value ') +
          bodify(target.argument) +
          ' negated'
        )
      },

      ConditionalExpression: (target: es.ConditionalExpression): string => {
        return (
          'Conditional expression evaluated, condition is ' +
          (bodify(target.test) === 'true'
            ? 'true, consequent evaluated'
            : 'false, alternate evaluated')
        )
      },

      LogicalExpression: (target: es.LogicalExpression): string => {
        return target.operator === '&&'
          ? 'AND operation evaluated, left of operator is ' +
              (bodify(target.left) === 'true'
                ? 'true, continue evaluating right of operator'
                : 'false, stop evaluation')
          : 'OR operation evaluated, left of operator is ' +
              (bodify(target.left) === 'true'
                ? 'true, stop evaluation'
                : 'false, continue evaluating right of operator')
      },

      CallExpression: (target: es.CallExpression): string => {
        if (target.callee.type === 'ArrowFunctionExpression') {
          if (target.callee.params.length === 0) {
            return bodify(target.callee) + ' runs'
          } else {
            return (
              target.arguments.map(bodify) +
              ' substituted into ' +
              target.callee.params.map(bodify) +
              ' of ' +
              bodify(target.callee)
            )
          }
        } else if (target.callee.type === 'FunctionExpression') {
          if (target.callee.params.length === 0) {
            return 'Function ' + bodify(target.callee) + ' runs'
          } else {
            return (
              'Function ' +
              bodify(target.callee) +
              ' takes in ' +
              target.arguments.map(bodify) +
              ' as input ' +
              target.callee.params.map(bodify)
            )
          }
        } else {
          return bodify(target.callee) + ' runs'
        }
      },

      Program: (target: es.Program): string => bodify(target.body[0]),

      BlockExpression: (target: BlockExpression): string => bodify(target.body[0]),

      BlockStatement: (target: es.BlockStatement): string =>
        target.body.length === 0 ? 'Empty block statement evaluated' : bodify(target.body[0]),

      IfStatement: (target: es.IfStatement): string => {
        return (
          'If statement evaluated, ' +
          (bodify(target.test) === 'true'
            ? 'condition true, proceed to if block'
            : 'condition false, proceed to else block')
        )
      }
    }

    const explainer = explainers[target.type]
    return explainer === undefined ? '...' : explainer(target)
  }

  const reducers = {
    // source 0
    Identifier(
      node: es.Identifier,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      // can only be built ins. the rest should have been declared
      if (!(isAllowedLiterals(node) || isBuiltinFunction(node))) {
        throw new errors.UndefinedVariable(node.name, node)
      } else {
        return [node, context, paths, 'identifier']
      }
    },

    ExpressionStatement(
      node: es.ExpressionStatement,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      paths[0].push('expression')
      const [reduced, cont, path, str] = reduce(node.expression, context, paths)
      return [ast.expressionStatement(reduced as es.Expression), cont, path, str]
    },

    BinaryExpression(
      node: es.BinaryExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const { operator, left, right } = node
      if (isIrreducible(left)) {
        if (isIrreducible(right)) {
          // if the ast are the same, then the values are the same
          if (
            builtin.is_function(left).value &&
            builtin.is_function(right).value &&
            operator === '==='
          ) {
            return [valueToExpression(left === right), context, paths, explain(node)]
          }
          const [leftValue, rightValue] = [left, right].map(nodeToValue)
          const error = rttc.checkBinaryExpression(node, operator, leftValue, rightValue)
          if (error === undefined) {
            const lit = evaluateBinaryExpression(operator, leftValue, rightValue)
            return [valueToExpression(lit, context), context, paths, explain(node)]
          } else {
            throw error
          }
        } else {
          paths[0].push('right')
          const [reducedRight, cont, path, str] = reduce(right, context, paths)
          const reducedExpression = ast.binaryExpression(
            operator,
            left,
            reducedRight as es.Expression,
            node.loc!
          )
          return [reducedExpression, cont, path, str]
        }
      } else {
        paths[0].push('left')
        const [reducedLeft, cont, path, str] = reduce(left, context, paths)
        const reducedExpression = ast.binaryExpression(
          operator,
          reducedLeft as es.Expression,
          right,
          node.loc!
        )
        return [reducedExpression, cont, path, str]
      }
    },

    UnaryExpression(
      node: es.UnaryExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const { operator, argument } = node
      if (isIrreducible(argument)) {
        // tslint:disable-next-line
        const argumentValue = nodeToValue(argument)
        const error = rttc.checkUnaryExpression(node, operator, argumentValue)
        if (error === undefined) {
          const result = evaluateUnaryExpression(operator, argumentValue)
          return [valueToExpression(result, context), context, paths, explain(node)]
        } else {
          throw error
        }
      } else {
        paths[0].push('argument')
        const [reducedArgument, cont, path, str] = reduce(argument, context, paths)
        const reducedExpression = ast.unaryExpression(
          operator,
          reducedArgument as es.Expression,
          node.loc!
        )
        return [reducedExpression, cont, path, str]
      }
    },

    ConditionalExpression(
      node: es.ConditionalExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const { test, consequent, alternate } = node
      if (test.type === 'Literal') {
        const error = rttc.checkIfStatement(node, test.value)
        if (error === undefined) {
          return [
            (test.value ? consequent : alternate) as es.Expression,
            context,
            paths,
            explain(node)
          ]
        } else {
          throw error
        }
      } else {
        paths[0].push('test')
        const [reducedTest, cont, path, str] = reduce(test, context, paths)
        const reducedExpression = ast.conditionalExpression(
          reducedTest as es.Expression,
          consequent,
          alternate,
          node.loc!
        )
        return [reducedExpression, cont, path, str]
      }
    },

    LogicalExpression(
      node: es.LogicalExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
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
          return [result as es.Expression, context, paths, explain(node)]
        }
      } else {
        paths[0].push('left')
        const [reducedLeft, cont, path, str] = reduce(left, context, paths)
        return [
          ast.logicalExpression(
            node.operator,
            reducedLeft as es.Expression,
            right,
            node.loc!
          ) as substituterNodes,
          cont,
          path,
          str
        ]
      }
    },

    // core of the subst model
    CallExpression(
      node: es.CallExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const [callee, args] = [node.callee, node.arguments]
      // source 0: discipline: any expression can be transformed into either literal, ident(builtin) or funexp
      // if functor can reduce, reduce functor
      if (!isIrreducible(callee)) {
        paths[0].push('callee')
        const [reducedCallee, cont, path, str] = reduce(callee, context, paths)
        return [
          ast.callExpression(reducedCallee as es.Expression, args as es.Expression[], node.loc!),
          cont,
          path,
          str
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
              paths[0].push('arguments[' + i + ']')
              const [reducedCurrentArg, cont, path, str] = reduce(currentArg, context, paths)
              const reducedArgs = [...args.slice(0, i), reducedCurrentArg, ...args.slice(i + 1)]
              return [
                ast.callExpression(
                  callee as es.Expression,
                  reducedArgs as es.Expression[],
                  node.loc!
                ),
                cont,
                path,
                str
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
          return [
            apply(callee as FunctionDeclarationExpression, args as es.Literal[]),
            context,
            paths,
            explain(node)
          ]
        } else {
          if ((callee as es.Identifier).name.includes('math')) {
            return [
              builtin.evaluateMath((callee as es.Identifier).name, ...args),
              context,
              paths,
              explain(node)
            ]
          }
          return [builtin[(callee as es.Identifier).name](...args), context, paths, explain(node)]
        }
      }
    },

    Program(
      node: es.Program,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const [firstStatement, ...otherStatements] = node.body
      if (
        firstStatement.type === 'ExpressionStatement' &&
        isIrreducible(firstStatement.expression)
      ) {
        paths[0].push('body[0]')
        paths.push([])
        return [ast.program(otherStatements as es.Statement[]), context, paths, explain(node)]
      } else if (firstStatement.type === 'FunctionDeclaration') {
        let funDecExp = ast.functionDeclarationExpression(
          firstStatement.id!,
          firstStatement.params,
          firstStatement.body
        ) as FunctionDeclarationExpression
        // substitute body
        funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
          []
        ])[0] as FunctionDeclarationExpression
        // substitute the rest of the program
        const remainingProgram = ast.program(otherStatements as es.Statement[])
        const subst = substituteMain(funDecExp.id, funDecExp, remainingProgram, paths)
        // concats paths such that:
        // paths[0] -> path to the program to be substituted, pre-redex
        // paths[1...] -> path(s) to the parts of the remaining program
        // that were substituted, post-redex
        paths[0].push('body[0]')
        const allPaths = paths.concat(subst[1])
        if (subst[1].length === 0) {
          allPaths.push([])
        }
        return [subst[0], context, allPaths, explain(node)]
      } else if (firstStatement.type === 'VariableDeclaration') {
        const { kind, declarations } = firstStatement
        if (kind !== 'const') {
          // TODO: cannot use let or var
          return [dummyProgram(), context, paths, 'cannot use let or var']
        } else if (
          declarations.length <= 0 ||
          declarations.length > 1 ||
          declarations[0].type !== 'VariableDeclarator' ||
          !declarations[0].init
        ) {
          // TODO: syntax error
          return [dummyProgram(), context, paths, 'syntax error']
        } else {
          const declarator = declarations[0] as es.VariableDeclarator
          const rhs = declarator.init!
          if (declarator.id.type !== 'Identifier') {
            // TODO: source does not allow destructuring
            return [dummyProgram(), context, paths, 'source does not allow destructuring']
          } else if (isIrreducible(rhs)) {
            const remainingProgram = ast.program(otherStatements as es.Statement[])
            // forced casting for some weird errors
            const subst = substituteMain(
              declarator.id,
              rhs as es.ArrayExpression,
              remainingProgram,
              paths
            )
            // concats paths such that:
            // paths[0] -> path to the program to be substituted, pre-redex
            // paths[1...] -> path(s) to the parts of the remaining program
            // that were substituted, post-redex
            paths[0].push('body[0]')
            const allPaths = paths.concat(subst[1])
            if (subst[1].length === 0) {
              allPaths.push([])
            }
            return [subst[0], context, allPaths, explain(node)]
          } else if (rhs.type === 'ArrowFunctionExpression' || rhs.type === 'FunctionExpression') {
            let funDecExp = ast.functionDeclarationExpression(
              declarator.id,
              rhs.params,
              rhs.body.type === 'BlockStatement'
                ? rhs.body
                : ast.blockStatement([ast.returnStatement(rhs.body)])
            ) as FunctionDeclarationExpression
            // substitute body
            funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
              []
            ])[0] as FunctionDeclarationExpression
            // substitute the rest of the program
            const remainingProgram = ast.program(otherStatements as es.Statement[])
            const subst = substituteMain(funDecExp.id, funDecExp, remainingProgram, paths)
            // concats paths such that:
            // paths[0] -> path to the program to be substituted, pre-redex
            // paths[1...] -> path(s) to the parts of the remaining program
            // that were substituted, post-redex
            paths[0].push('body[0]')
            const allPaths = paths.concat(subst[1])
            if (subst[1].length === 0) {
              allPaths.push([])
            }
            return [subst[0], context, allPaths, explain(node)]
          } else {
            paths[0].push('body[0]')
            paths[0].push('declarations[0]')
            paths[0].push('init')
            const [reducedRhs, cont, path, str] = reduce(rhs, context, paths)
            return [
              ast.program([
                ast.declaration(
                  declarator.id.name,
                  'const',
                  reducedRhs as es.Expression
                ) as es.Statement,
                ...(otherStatements as es.Statement[])
              ]),
              cont,
              path,
              str
            ]
          }
        }
      }
      paths[0].push('body[0]')
      const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
      return [
        ast.program([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
        cont,
        path,
        str
      ]
    },

    BlockStatement(
      node: es.BlockStatement,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      if (node.body.length === 0) {
        return [ast.expressionStatement(ast.identifier('undefined')), context, paths, explain(node)]
      } else {
        const [firstStatement, ...otherStatements] = node.body
        if (firstStatement.type === 'ReturnStatement') {
          const arg = firstStatement.argument as es.Expression
          return [ast.expressionStatement(arg), context, paths, explain(node)]
        } else if (firstStatement.type === 'IfStatement') {
          paths[0].push('body[0]')
          const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
          if (reduced.type === 'BlockStatement') {
            const body = reduced.body as es.Statement[]
            if (body.length > 1) {
              path[1] = [...path[0].slice(0, path[0].length - 1)]
            }
            const wholeBlock = body.concat(...(otherStatements as es.Statement[]))
            return [ast.blockStatement(wholeBlock), cont, path, str]
          } else {
            return [
              ast.blockStatement([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
              cont,
              path,
              str
            ]
          }
        } else if (
          firstStatement.type === 'ExpressionStatement' &&
          isIrreducible(firstStatement.expression)
        ) {
          let stmt
          if (otherStatements.length > 0) {
            paths[0].push('body[0]')
            paths.push([])
            stmt = ast.blockStatement(otherStatements as es.Statement[])
          } else {
            stmt = ast.expressionStatement(ast.identifier('undefined'))
          }
          return [stmt, context, paths, explain(node)]
        } else if (firstStatement.type === 'FunctionDeclaration') {
          let funDecExp = ast.functionDeclarationExpression(
            firstStatement.id!,
            firstStatement.params,
            firstStatement.body
          ) as FunctionDeclarationExpression
          // substitute body
          funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
            []
          ])[0] as FunctionDeclarationExpression
          // substitute the rest of the blockStatement
          const remainingBlockStatement = ast.blockStatement(otherStatements as es.Statement[])
          const subst = substituteMain(funDecExp.id, funDecExp, remainingBlockStatement, paths)
          // concats paths such that:
          // paths[0] -> path to the program to be substituted, pre-redex
          // paths[1...] -> path(s) to the parts of the remaining program
          // that were substituted, post-redex
          paths[0].push('body[0]')
          const allPaths = paths.concat(subst[1])
          if (subst[1].length === 0) {
            allPaths.push([])
          }
          return [subst[0], context, allPaths, explain(node)]
        } else if (firstStatement.type === 'VariableDeclaration') {
          const { kind, declarations } = firstStatement
          if (kind !== 'const') {
            // TODO: cannot use let or var
            return [dummyBlockStatement(), context, paths, 'cannot use let or var']
          } else if (
            declarations.length <= 0 ||
            declarations.length > 1 ||
            declarations[0].type !== 'VariableDeclarator' ||
            !declarations[0].init
          ) {
            // TODO: syntax error
            return [dummyBlockStatement(), context, paths, 'syntax error']
          } else {
            const declarator = declarations[0] as es.VariableDeclarator
            const rhs = declarator.init!
            if (declarator.id.type !== 'Identifier') {
              // TODO: source does not allow destructuring
              return [dummyBlockStatement(), context, paths, 'source does not allow destructuring']
            } else if (isIrreducible(rhs)) {
              const remainingBlockStatement = ast.blockStatement(otherStatements as es.Statement[])
              // force casting for weird errors
              const subst = substituteMain(
                declarator.id,
                rhs as es.ArrayExpression,
                remainingBlockStatement,
                paths
              )
              // concats paths such that:
              // paths[0] -> path to the program to be substituted, pre-redex
              // paths[1...] -> path(s) to the parts of the remaining program
              // that were substituted, post-redex
              paths[0].push('body[0]')
              const allPaths = paths.concat(subst[1])
              if (subst[1].length === 0) {
                allPaths.push([])
              }
              return [subst[0], context, allPaths, explain(node)]
            } else if (
              rhs.type === 'ArrowFunctionExpression' ||
              rhs.type === 'FunctionExpression'
            ) {
              let funDecExp = ast.functionDeclarationExpression(
                declarator.id,
                rhs.params,
                rhs.body.type === 'BlockStatement'
                  ? rhs.body
                  : ast.blockStatement([ast.returnStatement(rhs.body)])
              ) as FunctionDeclarationExpression
              // substitute body
              funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
                []
              ])[0] as FunctionDeclarationExpression
              // substitute the rest of the blockStatement
              const remainingBlockStatement = ast.blockStatement(otherStatements as es.Statement[])
              const subst = substituteMain(funDecExp.id, funDecExp, remainingBlockStatement, paths)
              // concats paths such that:
              // paths[0] -> path to the program to be substituted, pre-redex
              // paths[1...] -> path(s) to the parts of the remaining program
              // that were substituted, post-redex
              paths[0].push('body[0]')
              const allPaths = paths.concat(subst[1])
              if (subst[1].length === 0) {
                allPaths.push([])
              }
              return [subst[0], context, allPaths, explain(node)]
            } else {
              paths[0].push('body[0]')
              paths[0].push('declarations[0]')
              paths[0].push('init')
              const [reducedRhs, cont, path, str] = reduce(rhs, context, paths)
              return [
                ast.blockStatement([
                  ast.declaration(
                    declarator.id.name,
                    'const',
                    reducedRhs as es.Expression
                  ) as es.Statement,
                  ...(otherStatements as es.Statement[])
                ]),
                cont,
                path,
                str
              ]
            }
          }
        }
        paths[0].push('body[0]')
        const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
        return [
          ast.blockStatement([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
          cont,
          path,
          str
        ]
      }
    },

    BlockExpression(
      node: BlockExpression,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const [firstStatement, ...otherStatements] = node.body
      if (firstStatement.type === 'ReturnStatement') {
        const arg = firstStatement.argument as es.Expression
        return [arg, context, paths, explain(node)]
      } else if (firstStatement.type === 'IfStatement') {
        paths[0].push('body[0]')
        const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
        if (reduced.type === 'BlockStatement') {
          const body = reduced.body as es.Statement[]
          if (body.length > 1) {
            path[1] = [...path[0].slice(0, path[0].length - 1)]
          }
          const wholeBlock = body.concat(...(otherStatements as es.Statement[]))
          return [ast.blockExpression(wholeBlock), cont, path, str]
        } else {
          return [
            ast.blockExpression([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
            cont,
            path,
            str
          ]
        }
      } else if (
        firstStatement.type === 'ExpressionStatement' &&
        isIrreducible(firstStatement.expression)
      ) {
        let stmt
        if (otherStatements.length > 0) {
          paths[0].push('body[0]')
          paths.push([])
          stmt = ast.blockExpression(otherStatements as es.Statement[])
        } else {
          stmt = ast.identifier('undefined')
        }
        return [stmt, context, paths, explain(node)]
      } else if (firstStatement.type === 'FunctionDeclaration') {
        let funDecExp = ast.functionDeclarationExpression(
          firstStatement.id!,
          firstStatement.params,
          firstStatement.body
        ) as FunctionDeclarationExpression
        // substitute body
        funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
          []
        ])[0] as FunctionDeclarationExpression
        // substitute the rest of the blockExpression
        const remainingBlockExpression = ast.blockExpression(otherStatements as es.Statement[])
        const subst = substituteMain(funDecExp.id, funDecExp, remainingBlockExpression, paths)
        // concats paths such that:
        // paths[0] -> path to the program to be substituted, pre-redex
        // paths[1...] -> path(s) to the parts of the remaining program
        // that were substituted, post-redex
        paths[0].push('body[0]')
        const allPaths = paths.concat(subst[1])
        if (subst[1].length === 0) {
          allPaths.push([])
        }
        return [subst[0], context, allPaths, explain(node)]
      } else if (firstStatement.type === 'VariableDeclaration') {
        const { kind, declarations } = firstStatement
        if (kind !== 'const') {
          // TODO: cannot use let or var
          return [dummyBlockExpression(), context, paths, 'cannot use let or var']
        } else if (
          declarations.length <= 0 ||
          declarations.length > 1 ||
          declarations[0].type !== 'VariableDeclarator' ||
          !declarations[0].init
        ) {
          // TODO: syntax error
          return [dummyBlockExpression(), context, paths, 'syntax error']
        } else {
          const declarator = declarations[0] as es.VariableDeclarator
          const rhs = declarator.init!
          if (declarator.id.type !== 'Identifier') {
            // TODO: source does not allow destructuring
            return [dummyBlockExpression(), context, paths, 'source does not allow destructuring']
          } else if (isIrreducible(rhs)) {
            const remainingBlockExpression = ast.blockExpression(otherStatements as es.Statement[])
            // forced casting for some weird errors
            const subst = substituteMain(
              declarator.id,
              rhs as es.ArrayExpression,
              remainingBlockExpression,
              paths
            )
            // concats paths such that:
            // paths[0] -> path to the program to be substituted, pre-redex
            // paths[1...] -> path(s) to the parts of the remaining program
            // that were substituted, post-redex
            paths[0].push('body[0]')
            const allPaths = paths.concat(subst[1])
            if (subst[1].length === 0) {
              allPaths.push([])
            }
            return [subst[0], context, allPaths, explain(node)]
          } else if (rhs.type === 'ArrowFunctionExpression' || rhs.type === 'FunctionExpression') {
            let funDecExp = ast.functionDeclarationExpression(
              declarator.id,
              rhs.params,
              rhs.body.type === 'BlockStatement'
                ? rhs.body
                : ast.blockStatement([ast.returnStatement(rhs.body)])
            ) as FunctionDeclarationExpression
            // substitute body
            funDecExp = substituteMain(funDecExp.id, funDecExp, funDecExp, [
              []
            ])[0] as FunctionDeclarationExpression
            // substitute the rest of the blockExpression
            const remainingBlockExpression = ast.blockExpression(otherStatements as es.Statement[])
            const subst = substituteMain(funDecExp.id, funDecExp, remainingBlockExpression, paths)
            // concats paths such that:
            // paths[0] -> path to the program to be substituted, pre-redex
            // paths[1...] -> path(s) to the parts of the remaining program
            // that were substituted, post-redex
            paths[0].push('body[0]')
            const allPaths = paths.concat(subst[1])
            if (subst[1].length === 0) {
              allPaths.push([])
            }
            return [subst[0], context, allPaths, explain(node)]
          } else {
            paths[0].push('body[0]')
            paths[0].push('declarations[0]')
            paths[0].push('init')
            const [reducedRhs, cont, path, str] = reduce(rhs, context, paths)
            return [
              ast.blockExpression([
                ast.declaration(
                  declarator.id.name,
                  'const',
                  reducedRhs as es.Expression
                ) as es.Statement,
                ...(otherStatements as es.Statement[])
              ]),
              cont,
              path,
              str
            ]
          }
        }
      }
      paths[0].push('body[0]')
      const [reduced, cont, path, str] = reduce(firstStatement, context, paths)
      return [
        ast.blockExpression([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
        cont,
        path,
        str
      ]
    },

    // source 1
    IfStatement(
      node: es.IfStatement,
      context: Context,
      paths: string[][]
    ): [substituterNodes, Context, string[][], string] {
      const { test, consequent, alternate } = node
      if (test.type === 'Literal') {
        const error = rttc.checkIfStatement(node, test.value)
        if (error === undefined) {
          return [
            (test.value ? consequent : alternate) as es.Statement,
            context,
            paths,
            explain(node)
          ]
        } else {
          throw error
        }
      } else {
        paths[0].push('test')
        const [reducedTest, cont, path, str] = reduce(test, context, paths)
        const reducedIfStatement = ast.ifStatement(
          reducedTest as es.Expression,
          consequent as es.BlockStatement,
          alternate as es.IfStatement | es.BlockStatement,
          node.loc!
        )
        return [reducedIfStatement, cont, path, str]
      }
    }
  }

  /**
   * Reduces one step of the program and returns
   * 1. The reduced program
   * 2. The path(s) leading to the redex
   *    - If substitution not involved, returns array containing one path
   *    - If substitution is involved, returns array containing
   *      path to program to be substituted pre-redex, as well as
   *      path(s) to the parts of the program that were substituted post-redex
   * 3. String explaining the reduction
   */
  function reduce(
    node: substituterNodes,
    context: Context,
    paths: string[][]
  ): [substituterNodes, Context, string[][], string] {
    const reducer = reducers[node.type]
    if (reducer === undefined) {
      return [ast.program([]), context, [], 'error'] // exit early
    } else {
      return reducer(node, context, paths)
    }
  }
  return reduce(node, context, [[]])
}

// Main creates a scope for us to control the verbosity
function treeifyMain(target: substituterNodes): substituterNodes {
  // recurse down the program like substitute
  // if see a function at expression position,
  //   has an identifier: replace with the name
  //   else: replace with an identifer "=>"
  let verboseCount = 0
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

    LogicalExpression: (target: es.LogicalExpression) => {
      return ast.logicalExpression(
        target.operator,
        treeify(target.left) as es.Expression,
        treeify(target.right) as es.Expression
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
      } else if (verboseCount < 5) {
        // here onwards is guarding against arrow turned function expressions
        verboseCount++
        const redacted = ast.arrowFunctionExpression(
          target.params,
          treeify(target.body) as es.BlockStatement
        )
        verboseCount = 0
        return redacted
      } else {
        // shortens body after 5 iterations
        return ast.arrowFunctionExpression(target.params, ast.identifier('...'))
      }
    },

    Program: (target: es.Program): es.Program => {
      return ast.program(target.body.map(stmt => treeify(stmt) as es.Statement))
    },

    BlockStatement: (target: es.BlockStatement): es.BlockStatement => {
      return ast.blockStatement(target.body.map(stmt => treeify(stmt) as es.Statement))
    },

    BlockExpression: (target: BlockExpression): es.BlockStatement => {
      return ast.blockStatement(target.body.map(treeify) as es.Statement[])
    },

    ReturnStatement: (target: es.ReturnStatement): es.ReturnStatement => {
      return ast.returnStatement(treeify(target.argument!) as es.Expression)
    },

    // source 1
    // CORE
    ArrowFunctionExpression: (
      target: es.ArrowFunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression => {
      if (verboseCount < 5) {
        // here onwards is guarding against arrow turned function expressions
        verboseCount++
        const redacted = ast.arrowFunctionExpression(
          target.params,
          treeify(target.body) as es.BlockStatement
        )
        verboseCount = 0
        return redacted
      } else {
        // shortens body after 5 iterations
        return ast.arrowFunctionExpression(target.params, ast.identifier('...'))
      }
    },

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

// Mainly kept for testing
export const codify = (node: substituterNodes): string => generate(treeifyMain(node))

/**
 * Recurses down the tree, tracing path to redex
 * and calling treeifyMain on all other children
 * Once redex is found, extract redex from tree
 * and put redexMarker in its place
 * Returns array containing modified tree and
 * extracted redex
 */
function pathifyMain(
  target: substituterNodes,
  paths: string[][]
): [substituterNodes, substituterNodes] {
  let pathIndex = 0
  let path = paths[0]
  let redex = ast.program([]) as substituterNodes
  let endIndex = path === undefined ? 0 : path.length - 1
  const redexMarker = ast.identifier('$') as substituterNodes
  const withBrackets = ast.identifier('($)') as substituterNodes

  const pathifiers = {
    ExpressionStatement: (target: es.ExpressionStatement): es.ExpressionStatement => {
      let exp = treeifyMain(target.expression) as es.Expression
      if (path[pathIndex] === 'expression') {
        if (pathIndex === endIndex) {
          redex = exp
          exp =
            target.expression.type === 'ArrowFunctionExpression'
              ? (withBrackets as es.Expression)
              : (redexMarker as es.Expression)
        } else {
          pathIndex++
          exp = pathify(target.expression) as es.Expression
        }
      }
      return ast.expressionStatement(exp)
    },

    BinaryExpression: (target: es.BinaryExpression) => {
      let left = treeifyMain(target.left) as es.Expression
      let right = treeifyMain(target.right) as es.Expression
      if (path[pathIndex] === 'left') {
        if (pathIndex === endIndex) {
          redex = left
          left = redexMarker as es.Expression
        } else {
          pathIndex++
          left = pathify(target.left) as es.Expression
        }
      } else if (path[pathIndex] === 'right') {
        if (pathIndex === endIndex) {
          redex = right
          right = redexMarker as es.Expression
        } else {
          pathIndex++
          right = pathify(target.right) as es.Expression
        }
      }
      return ast.binaryExpression(target.operator, left, right)
    },

    UnaryExpression: (target: es.UnaryExpression): es.UnaryExpression => {
      let arg = treeifyMain(target.argument) as es.Expression
      if (path[pathIndex] === 'argument') {
        if (pathIndex === endIndex) {
          redex = arg
          arg = redexMarker as es.Expression
        } else {
          pathIndex++
          arg = pathify(target.argument) as es.Expression
        }
      }
      return ast.unaryExpression(target.operator, arg)
    },

    ConditionalExpression: (target: es.ConditionalExpression): es.ConditionalExpression => {
      let test = treeifyMain(target.test) as es.Expression
      let cons = treeifyMain(target.consequent) as es.Expression
      let alt = treeifyMain(target.alternate) as es.Expression
      if (path[pathIndex] === 'test') {
        if (pathIndex === endIndex) {
          redex = test
          test = redexMarker as es.Expression
        } else {
          pathIndex++
          test = pathify(target.test) as es.Expression
        }
      } else if (path[pathIndex] === 'consequent') {
        if (pathIndex === endIndex) {
          redex = cons
          cons = redexMarker as es.Expression
        } else {
          pathIndex++
          cons = pathify(target.consequent) as es.Expression
        }
      } else if (path[pathIndex] === 'alternate') {
        if (pathIndex === endIndex) {
          redex = alt
          alt = redexMarker as es.Expression
        } else {
          pathIndex++
          alt = pathify(target.alternate) as es.Expression
        }
      }
      return ast.conditionalExpression(test, cons, alt)
    },

    LogicalExpression: (target: es.LogicalExpression) => {
      let left = treeifyMain(target.left) as es.Expression
      let right = treeifyMain(target.right) as es.Expression
      if (path[pathIndex] === 'left') {
        if (pathIndex === endIndex) {
          redex = left
          left = redexMarker as es.Expression
        } else {
          pathIndex++
          left = pathify(target.left) as es.Expression
        }
      } else if (path[pathIndex] === 'right') {
        if (pathIndex === endIndex) {
          redex = right
          right = redexMarker as es.Expression
        } else {
          pathIndex++
          right = pathify(target.right) as es.Expression
        }
      }
      return ast.logicalExpression(target.operator, left, right)
    },

    CallExpression: (target: es.CallExpression): es.CallExpression => {
      let callee = treeifyMain(target.callee) as es.Expression
      const args = target.arguments.map(arg => treeifyMain(arg) as es.Expression)
      if (path[pathIndex] === 'callee') {
        if (pathIndex === endIndex) {
          redex = callee
          callee =
            target.callee.type === 'ArrowFunctionExpression'
              ? (withBrackets as es.Expression)
              : (redexMarker as es.Expression)
        } else {
          pathIndex++
          callee = pathify(target.callee) as es.Expression
        }
      } else {
        let argIndex
        const isEnd = pathIndex === endIndex
        for (let i = 0; i < target.arguments.length; i++) {
          if (path[pathIndex] === 'arguments[' + i + ']') {
            argIndex = i
            break
          }
        }
        if (argIndex !== undefined) {
          pathIndex++
          if (isEnd) {
            redex = args[argIndex]
            args[argIndex] = redexMarker as es.Expression
          } else {
            args[argIndex] = pathify(target.arguments[argIndex]) as es.Expression
          }
        }
      }
      return ast.callExpression(callee, args)
    },

    FunctionDeclaration: (target: es.FunctionDeclaration): es.FunctionDeclaration => {
      let body = treeifyMain(target.body) as es.BlockStatement
      if (path[pathIndex] === 'body') {
        if (pathIndex === endIndex) {
          redex = body
          body = redexMarker as es.BlockStatement
        } else {
          pathIndex++
          body = pathify(target.body) as es.BlockStatement
        }
      }
      return ast.functionDeclaration(target.id, target.params, body)
    },

    FunctionExpression: (
      target: es.FunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression => {
      if (target.id) {
        return target.id
      } else {
        let body = treeifyMain(target.body) as es.BlockStatement
        if (path[pathIndex] === 'body') {
          if (pathIndex === endIndex) {
            redex = body
            body = redexMarker as es.BlockStatement
          } else {
            pathIndex++
            body = pathify(target.body) as es.BlockStatement
          }
        }
        return ast.arrowFunctionExpression(target.params, body)
      }
    },

    Program: (target: es.Program): es.Program => {
      const body = target.body.map(treeifyMain) as es.Statement[]
      let bodyIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.body.length; i++) {
        if (path[pathIndex] === 'body[' + i + ']') {
          bodyIndex = i
          break
        }
      }
      if (bodyIndex !== undefined) {
        if (isEnd) {
          redex = body[bodyIndex]
          body[bodyIndex] = redexMarker as es.Statement
        } else {
          pathIndex++
          body[bodyIndex] = pathify(target.body[bodyIndex]) as es.Statement
        }
      }
      return ast.program(body)
    },

    BlockStatement: (target: es.BlockStatement): es.BlockStatement => {
      const body = target.body.map(treeifyMain) as es.Statement[]
      let bodyIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.body.length; i++) {
        if (path[pathIndex] === 'body[' + i + ']') {
          bodyIndex = i
          break
        }
      }
      if (bodyIndex !== undefined) {
        if (isEnd) {
          redex = body[bodyIndex]
          body[bodyIndex] = redexMarker as es.Statement
        } else {
          pathIndex++
          body[bodyIndex] = pathify(target.body[bodyIndex]) as es.Statement
        }
      }
      return ast.blockStatement(body)
    },

    BlockExpression: (target: BlockExpression): es.BlockStatement => {
      const body = target.body.map(treeifyMain) as es.Statement[]
      let bodyIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.body.length; i++) {
        if (path[pathIndex] === 'body[' + i + ']') {
          bodyIndex = i
          break
        }
      }
      if (bodyIndex !== undefined) {
        if (isEnd) {
          redex = body[bodyIndex]
          body[bodyIndex] = redexMarker as es.Statement
        } else {
          pathIndex++
          body[bodyIndex] = pathify(target.body[bodyIndex]) as es.Statement
        }
      }
      return ast.blockStatement(body)
    },

    ReturnStatement: (target: es.ReturnStatement): es.ReturnStatement => {
      let arg = treeifyMain(target.argument!) as es.Expression
      if (path[pathIndex] === 'argument') {
        if (pathIndex === endIndex) {
          redex = arg
          arg = redexMarker as es.Expression
        } else {
          pathIndex++
          arg = pathify(target.argument!) as es.Expression
        }
      }
      return ast.returnStatement(arg)
    },

    // source 1
    ArrowFunctionExpression: (
      target: es.ArrowFunctionExpression
    ): es.Identifier | es.ArrowFunctionExpression => {
      let body = treeifyMain(target.body) as es.BlockStatement
      if (path[pathIndex] === 'body') {
        if (pathIndex === endIndex) {
          redex = body
          body = redexMarker as es.BlockStatement
        } else {
          pathIndex++
          body = pathify(target.body) as es.BlockStatement
        }
      }
      return ast.arrowFunctionExpression(target.params, body)
    },

    VariableDeclaration: (target: es.VariableDeclaration): es.VariableDeclaration => {
      const decl = target.declarations.map(treeifyMain) as es.VariableDeclarator[]
      let declIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.declarations.length; i++) {
        if (path[pathIndex] === 'declarations[' + i + ']') {
          declIndex = i
          break
        }
      }
      if (declIndex !== undefined) {
        if (isEnd) {
          redex = decl[declIndex]
          decl[declIndex] = redexMarker as es.VariableDeclarator
        } else {
          pathIndex++
          decl[declIndex] = pathify(target.declarations[declIndex]) as es.VariableDeclarator
        }
      }
      return ast.variableDeclaration(decl)
    },

    VariableDeclarator: (target: es.VariableDeclarator): es.VariableDeclarator => {
      let init = treeifyMain(target.init!) as es.Expression
      if (path[pathIndex] === 'init') {
        if (pathIndex === endIndex) {
          redex = init
          init = redexMarker as es.Expression
        } else {
          pathIndex++
          init = pathify(target.init!) as es.Expression
        }
      }
      return ast.variableDeclarator(target.id, init)
    },

    IfStatement: (target: es.IfStatement): es.IfStatement => {
      let test = treeifyMain(target.test) as es.Expression
      let cons = treeifyMain(target.consequent) as es.BlockStatement
      let alt = treeifyMain(target.alternate!) as es.BlockStatement | es.IfStatement
      if (path[pathIndex] === 'test') {
        if (pathIndex === endIndex) {
          redex = test
          test = redexMarker as es.Expression
        } else {
          pathIndex++
          test = pathify(target.test) as es.Expression
        }
      } else if (path[pathIndex] === 'consequent') {
        if (pathIndex === endIndex) {
          redex = cons
          cons = redexMarker as es.BlockStatement
        } else {
          pathIndex++
          cons = pathify(target.consequent) as es.BlockStatement
        }
      } else if (path[pathIndex] === 'alternate') {
        if (pathIndex === endIndex) {
          redex = alt
          alt = redexMarker as es.BlockStatement | es.IfStatement
        } else {
          pathIndex++
          alt = pathify(target.alternate!) as es.BlockStatement | es.IfStatement
        }
      }
      return ast.ifStatement(test, cons, alt)
    },

    // source 2
    ArrayExpression: (target: es.ArrayExpression): es.ArrayExpression => {
      const eles = target.elements.map(treeifyMain) as es.Expression[]
      let eleIndex
      const isEnd = pathIndex === endIndex
      for (let i = 0; i < target.elements.length; i++) {
        if (path[pathIndex] === 'elements[' + i + ']') {
          eleIndex = i
          break
        }
      }
      if (eleIndex !== undefined) {
        if (isEnd) {
          redex = eles[eleIndex]
          eles[eleIndex] = redexMarker as es.Expression
        } else {
          pathIndex++
          eles[eleIndex] = pathify(target.elements[eleIndex]) as es.Expression
        }
      }
      return ast.arrayExpression(eles)
    }
  }

  function pathify(target: substituterNodes): substituterNodes {
    const pathifier = pathifiers[target.type]
    if (pathifier === undefined) {
      return treeifyMain(target)
    } else {
      return pathifier(target)
    }
  }

  if (path === undefined || path[0] === undefined) {
    return [treeifyMain(target), ast.program([])]
  } else {
    let pathified = pathify(target)
    // runs pathify more than once if more than one substitution path
    for (let i = 1; i < paths.length; i++) {
      pathIndex = 0
      path = paths[i]
      endIndex = path === undefined ? 0 : path.length - 1
      pathified = pathify(pathified)
    }
    return [pathified, redex]
  }
}

// Function to convert array from getEvaluationSteps into text
export const redexify = (node: substituterNodes, path: string[][]): [string, string] => [
  generate(pathifyMain(node, path)[0]),
  generate(pathifyMain(node, path)[1])
]

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
    ;[combinedProgram] = [
      reduceMain(combinedProgram, context)[0],
      reduceMain(combinedProgram, context)[1]
    ] as [es.Program, Context]
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
      substed,
      [[]]
    )[0] as es.Program
  }
  return substed
}

// the context here is for builtins
export function getEvaluationSteps(
  program: es.Program,
  context: Context
): [es.Program, string[][], string][] {
  const steps: [es.Program, string[][], string][] = []
  try {
    // starts with substituting predefined constants
    let start = substPredefinedConstants(program)
    // and predefined fns.
    start = substPredefinedFns(start, context)[0]
    // then add in path and explanation string
    let reducedWithPath: [substituterNodes, Context, string[][], string] = [
      start,
      context,
      [],
      'Start of evaluation'
    ]
    // reduces program until evaluation completes
    // even steps: program before reduction
    // odd steps: program after reduction
    let i = -1
    while ((reducedWithPath[0] as es.Program).body.length > 0) {
      steps.push([
        reducedWithPath[0] as es.Program,
        reducedWithPath[2].length > 1 ? reducedWithPath[2].slice(1) : reducedWithPath[2],
        reducedWithPath[3]
      ])
      if (steps.length === 999) {
        steps[i][1] = reducedWithPath[2]
        steps[i][2] = reducedWithPath[3]
        steps.push([ast.program([]), [], 'Maximum number of steps exceeded'])
        break
      }
      steps.push([reducedWithPath[0] as es.Program, [], ''])
      if (i > 0) {
        steps[i][1] = reducedWithPath[2].length > 1 ? [reducedWithPath[2][0]] : reducedWithPath[2]
        steps[i][2] = reducedWithPath[3]
      }
      reducedWithPath = reduceMain(reducedWithPath[0], context)
      i += 2
    }
    if (steps.length !== 1000) {
      steps[steps.length - 1][2] = 'Evaluation complete'
    }
    return steps
  } catch (error) {
    context.errors.push(error)
    return steps
  }
}
