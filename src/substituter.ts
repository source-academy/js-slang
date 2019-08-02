import * as es from 'estree'
import * as errors from './interpreter-errors'
import { BlockExpression, Context, FunctionDeclarationExpression } from './types'
import * as ast from './utils/astCreator'
import { dummyBlockStatement, dummyExpression, dummyStatement } from './utils/dummyAstCreator'
import { evaluateBinaryExpression, evaluateUnaryExpression } from './utils/operators'
import * as rttc from './utils/rttc'

function isIrreducible(node: es.Node) {
  return ['Identifier', 'Literal', 'FunctionExpression'].includes(node.type)
}

/* tslint:disable:no-shadowed-variable */
// wrapper function, calls substitute immediately.
function substituteMain(
  name: es.Identifier,
  replacement: FunctionDeclarationExpression | es.Literal,
  target: es.Node
): es.Node {
  const seenBefore: Map<es.Node, es.Node> = new Map()
  /**
   * Substituters are invoked only when the target is not seen before,
   *  therefore each function has the responsbility of registering the
   *  [target, replacement] pair in seenBefore.
   * Substituter have two general steps:
   * 1. Declare relevant, dummy children
   * 2. Create dummy replacement with 1. and push [target, dummyReplacement]
   *  into the seenBefore array.
   * 3. [recursive step] we substitute the children, and return the dummyReplacement.
   */
  const substituters = {
    // done
    Identifier(
      target: es.Identifier
    ): es.Identifier | FunctionDeclarationExpression | es.Literal | es.Expression {
      if (replacement.type === 'Literal') {
        // only accept string, boolean and numbers for arguments
        if (!['string', 'boolean', 'number'].includes(typeof replacement.value)) {
          throw new rttc.TypeError(
            replacement,
            '',
            'string, boolean or number',
            typeof replacement.value
          )
        } else {
          // target as Identifier is guaranteed to be a tree.
          return target.name === name.name ? ast.primitive(replacement.value) : target
        }
      } else {
        // Function Expression
        return target.name === replacement.id.name
          ? (substitute(replacement) as FunctionDeclarationExpression)
          : target
      }
    },
    // done
    ExpressionStatement(target: es.ExpressionStatement): es.ExpressionStatement {
      const substedExpressionStatement = ast.expressionStatement(dummyExpression())
      seenBefore.set(target, substedExpressionStatement)
      substedExpressionStatement.expression = substitute(target.expression) as es.Expression
      return substedExpressionStatement
    },
    // done
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
    // done
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
    // done
    ConditionalExpression(target: es.ConditionalExpression): es.ConditionalExpression {
      const substedConditionalExpression = ast.conditionalExpression(
        dummyExpression(),
        dummyExpression(),
        dummyExpression(),
        target.loc!
      )
      substedConditionalExpression.test = substitute(target.test) as es.Expression
      substedConditionalExpression.consequent = substitute(target.consequent) as es.Expression
      substedConditionalExpression.alternate = substitute(target.alternate) as es.Expression
      return substedConditionalExpression
    },
    // done
    CallExpression(target: es.CallExpression): es.CallExpression {
      const dummyArgs = target.arguments.map(() => dummyExpression())
      const substedCallExpression = ast.callExpression(dummyExpression(), dummyArgs, target.loc!)
      seenBefore.set(target, substedCallExpression)
      substedCallExpression.arguments = target.arguments.map(
        expn => substitute(expn) as es.Expression
      )
      // do not subst callee for 1. const declarations and 2. Formal argument
      // substitution of parameters
      // TODO
      if (replacement.type === 'Literal') {
        substedCallExpression.callee = target.callee as es.Expression
      } else {
        substedCallExpression.callee = substitute(target.callee) as es.Expression
      }
      return substedCallExpression
    },
    // done
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
    // done
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
    // done
    Program(target: es.Program): es.Program {
      const substedProgram = ast.program(target.body.map(() => dummyStatement()))
      seenBefore.set(target, substedProgram)
      substedProgram.body = target.body.map(stmt => substitute(stmt) as es.Statement)
      return substedProgram
    },
    // done
    BlockStatement(target: es.BlockStatement): es.BlockStatement {
      const substedBody = target.body.map(() => dummyStatement())
      const substedBlockStatement = ast.blockStatement(substedBody)
      seenBefore.set(target, substedBlockStatement)
      substedBlockStatement.body = target.body.map(stmt => substitute(stmt) as es.Statement)
      return substedBlockStatement
    },
    // done
    ReturnStatement(target: es.ReturnStatement): es.ReturnStatement {
      const substedReturnStatement = ast.returnStatement(dummyExpression(), target.loc!)
      seenBefore.set(target, substedReturnStatement)
      substedReturnStatement.argument = substitute(target.argument!) as es.Expression
      return substedReturnStatement
    }
  }

  /**
   * For mapper use, maps a [symbol, value] pair to the node supplied.
   * @param name the name to be replaced
   * @param replacement the expression to replace the name with
   * @param node a node holding the target symbols
   * @param seenBefore a list of nodes that are seen before in substitution
   */
  function substitute(target: es.Node): es.Node {
    const result = seenBefore.get(target)
    if (result) {
      return result
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
  callee: FunctionDeclarationExpression,
  args: Array<es.Identifier | es.Literal>
): BlockExpression | es.Expression {
  const substedBlock = ast.blockExpression(callee.body.body, callee.loc!)
  for (let i = 0; i < args.length; i++) {
    // source discipline requires parameters to be identifiers.
    const param = callee.params[i] as es.Identifier
    const arg = args[i] as es.Literal

    substedBlock.body = substedBlock.body.map(
      stmt => substituteMain(param, arg, stmt) as es.Statement
    )
  }
  const firstStatement: es.Statement = substedBlock.body[0]
  return firstStatement.type === 'ReturnStatement'
    ? (firstStatement.argument as es.Expression)
    : substedBlock
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
    const [reduced] = reduce(node.expression, context)
    return [
      reduced.type.includes('Statement')
        ? reduced
        : ast.expressionStatement(reduced as es.Expression),
      context
    ]
  },
  BinaryExpression(node: es.BinaryExpression, context: Context): [es.Node, Context] {
    const { operator, left, right } = node
    if (left.type === 'Literal') {
      if (right.type === 'Literal') {
        const error = rttc.checkBinaryExpression(node, operator, left.value, right.value)
        if (error === undefined) {
          const lit = ast.literal(evaluateBinaryExpression(operator, left.value, right.value))
          return [lit, context]
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
  CallExpression(node: es.CallExpression, context: Context): [es.Node, Context] {
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
      if (callee.type === 'FunctionExpression' && args.length !== callee.params.length) {
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
      return [
        callee.type === 'FunctionExpression'
          ? apply(
              callee as FunctionDeclarationExpression,
              args as Array<es.Literal | es.Identifier>
            )
          : context.runtime.environments[0].head[name](...args),
        context
      ]
    }
  },
  Program(node: es.Program, context: Context): [es.Node, Context] {
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
    } else {
      const [reduced] = reduce(firstStatement, context)
      return [
        ast.program([reduced as es.Statement, ...(otherStatements as es.Statement[])]),
        context
      ]
    }
  },
  BlockStatement(node: es.BlockStatement, context: Context): [es.Node, Context] {
    const [firstStatement, ...otherStatements] = node.body
    if (firstStatement.type === 'ReturnStatement') {
      const arg = firstStatement.argument as es.Expression
      if (isIrreducible(arg)) {
        return [ast.expressionStatement(arg), context]
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
      return [ast.program(otherStatements), context]
    } else if (firstStatement.type === 'FunctionDeclaration') {
      let funDecExp = ast.functionDeclarationExpression(
        firstStatement.id!,
        firstStatement.params,
        firstStatement.body,
        firstStatement.loc!
      ) as FunctionDeclarationExpression
      // substitute body
      funDecExp = substituteMain(
        funDecExp.id,
        funDecExp,
        funDecExp
      ) as FunctionDeclarationExpression
      // substitute the rest of the program
      const remainingBlock = ast.blockStatement(otherStatements)
      return [substituteMain(funDecExp.id, funDecExp, remainingBlock), context]
    } else {
      const [reduced] = reduce(firstStatement, context)
      return [ast.program([reduced as es.Statement, ...otherStatements]), context]
    }
  }
}

function reduce(node: es.Node, context: Context): [es.Node, Context] {
  const reducer = reducers[node.type]
  if (reducer === undefined) {
    return [ast.program([]), context] // exit early
    // return [node, context] // if reducer is not found we just get stuck
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

export function treeifyMain(program: es.Program): es.Program {
  // recurse down the program like substitute
  // if see a function at expression position,
  //   has an identifier: replace with the name
  //   else: replace with an identifer "=>"
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
    CallExpression: (target: es.CallExpression): es.CallExpression => {
      return ast.callExpression(
        treeify(target.callee) as es.Expression,
        target.arguments.map(arg => treeify(arg) as es.Expression)
      )
    },
    FunctionDeclaration: (target: es.FunctionDeclaration): es.FunctionDeclaration => {
      return ast.functionDeclaration(target.id, target.params, treeify(
        target.body
      ) as es.BlockStatement)
    },
    // CORE
    FunctionExpression: (target: es.FunctionExpression): es.Identifier => {
      return ast.identifier(target.id ? target.id.name : '=>')
    },
    Program: (target: es.Program): es.Program => {
      return ast.program(target.body.map(stmt => treeify(stmt) as es.Statement))
    },
    BlockStatement: (target: es.BlockStatement): es.BlockStatement => {
      return ast.blockStatement(target.body.map(stmt => treeify(stmt) as es.Statement))
    },
    ReturnStatement: (target: es.ReturnStatement): es.ReturnStatement => {
      return ast.returnStatement(treeify(target.argument!) as es.Expression)
    }
  }

  function treeify(target: es.Node): es.Node {
    const treeifier = treeifiers[target.type]
    if (treeifier === undefined) {
      return target
    } else {
      return treeifier(target)
    }
  }

  return treeify(program) as es.Program
}

// the context here is for builtins
export function getEvaluationSteps(program: es.Program, context: Context): es.Node[] {
  const steps: es.Node[] = []
  try {
    // starts with substituting predefined fns.
    let [reduced] = substPredefinedFns(program, context)
    while ((reduced as es.Program).body.length > 0) {
      steps.push(reduced)
      // some bug with no semis
      // tslint:disable-next-line
      ;[reduced] = reduce(reduced, context)
    }
    return steps.map(step => treeifyMain(step as es.Program))
  } catch (error) {
    context.errors.push(error)
    return steps.map(step => treeifyMain(step as es.Program))
  }
}
