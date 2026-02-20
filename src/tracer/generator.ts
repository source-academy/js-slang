/*
TODO: Write docs  
convert estree into corresponding stepper type
Every class should have the following properties
- basic StepperBaseNodeInterface
- constructor: create new AST from class type StepperBaseNode
- static create: factory method to parse estree to StepperAST
*/

import { generate } from 'astring'
import type es from 'estree'
import type { Node, NodeTypeToNode } from '../types'
import { isBuiltinFunction } from './builtins'
import type { StepperBaseNode } from './interface'
import { StepperArrayExpression } from './nodes/Expression/ArrayExpression'
import { StepperArrowFunctionExpression } from './nodes/Expression/ArrowFunctionExpression'
import { StepperBinaryExpression } from './nodes/Expression/BinaryExpression'
import { StepperConditionalExpression } from './nodes/Expression/ConditionalExpression'
import { StepperFunctionApplication } from './nodes/Expression/FunctionApplication'
import { StepperIdentifier } from './nodes/Expression/Identifier'
import { StepperLiteral } from './nodes/Expression/Literal'
import { StepperLogicalExpression } from './nodes/Expression/LogicalExpression'
import { StepperUnaryExpression } from './nodes/Expression/UnaryExpression'
import { StepperProgram } from './nodes/Program'
import { StepperBlockStatement } from './nodes/Statement/BlockStatement'
import { StepperExpressionStatement } from './nodes/Statement/ExpressionStatement'
import { StepperFunctionDeclaration } from './nodes/Statement/FunctionDeclaration'
import { StepperIfStatement } from './nodes/Statement/IfStatement'
import { StepperReturnStatement } from './nodes/Statement/ReturnStatement'
import {
  StepperVariableDeclaration,
  StepperVariableDeclarator
} from './nodes/Statement/VariableDeclaration'
import { StepperNode } from './nodes'

const undefinedNode = new StepperLiteral('undefined')

const nodeConverters: {
  [K in Node['type']]?: (node: NodeTypeToNode<K>) => StepperBaseNode
} = {
  ArrayExpression: StepperArrayExpression.create,
  ArrowFunctionExpression: StepperArrowFunctionExpression.create,
  BinaryExpression: StepperBinaryExpression.create,
  BlockStatement: StepperBlockStatement.create,
  CallExpression: StepperFunctionApplication.create,
  ConditionalExpression: StepperConditionalExpression.create,
  ExpressionStatement: StepperExpressionStatement.create,
  FunctionDeclaration: StepperFunctionDeclaration.create,
  Identifier(node) {
    if (node.name === 'NaN') {
      return new StepperLiteral(NaN, 'NaN')
    } else if (node.name === 'Infinity') {
      return new StepperLiteral(Infinity, 'Infinity')
    } else {
      return StepperIdentifier.create(node)
    }
  },
  IfStatement: StepperIfStatement.create,
  Literal: StepperLiteral.create,
  LogicalExpression: StepperLogicalExpression.create,
  Program: StepperProgram.create,
  ReturnStatement: StepperReturnStatement.create,
  UnaryExpression: StepperUnaryExpression.create,
  VariableDeclaration: StepperVariableDeclaration.create,
  VariableDeclarator: StepperVariableDeclarator.create,
}

const explainers: {
  [K in StepperNode['type']]?: (node: Extract<StepperNode, { type: K }>) => string
} = {
  ArrowFunctionExpression: (_node: StepperArrowFunctionExpression) => {
    throw new Error('Not implemented.')
  },
  BinaryExpression(node) {
    return `Binary expression ${generate(node)} evaluated`
  },
  BlockStatement(node) {
    if (node.body.length === 0) {
      return 'Empty block expression evaluated'
    }
    return `${generate(node.body[0])} finished evaluating`
  },
  CallExpression(node) {
    if (node.callee.type !== 'ArrowFunctionExpression' && node.callee.type !== 'Identifier') {
      throw new Error('`callee` should be function expression.')
    }

    // Determine whether the called function is built-in or not and create explanation accordingly
    const func: StepperArrowFunctionExpression = node.callee as StepperArrowFunctionExpression
    if (func.name && isBuiltinFunction(func.name)) {
      return `${func.name} runs`
      // @ts-expect-error func.body.type can be StepperBlockExpression
    } else if (func.body.type === 'BlockStatement') {
      if (func.params.length === 0) {
        return '() => {...}' + ' runs'
      }
      const paramDisplay = func.params.map(x => x.name).join(', ')
      const argDisplay: string = node.arguments
        .map(x =>
          (x.type === 'ArrowFunctionExpression' || x.type === 'Identifier') &&
          x.name !== undefined
            ? x.name
            : generate(x)
        )
        .join(', ')
      return 'Function ' + func.name + ' takes in ' + argDisplay + ' as input ' + paramDisplay
    } else {
      if (func.params.length === 0) {
        return generate(func) + ' runs'
      }
      return (
        node.arguments.map(x => generate(x)).join(', ') +
        ' substituted into ' +
        func.params.map(x => x.name).join(', ') +
        ' of ' +
        generate(func)
      )
    }
  },
  ConditionalExpression(node) {
    const test = node.test // test should have typeof literal
    if (test.type !== 'Literal') {
      throw new Error('Invalid conditional contraction. `test` should be literal.')
    }
    const testStatus = test.value
    if (typeof testStatus !== 'boolean') {
      throw new Error(
        'Invalid conditional contraction. `test` should be boolean, got ' +
          typeof testStatus +
          ' instead.'
      )
    }
    if (testStatus === true) {
      return 'Conditional expression evaluated, condition is true, consequent evaluated'
    } else {
      return 'Conditional expression evaluated, condition is false, alternate evaluated'
    }
  },
  ExpressionStatement(node) {
    return `${generate(node.expression)} finished evaluating`
  },
  FunctionDeclaration(node) {
    return `Function ${node.id.name} declared, parameter(s) ${node.params.map(x =>
      generate(x)
    )} required`
  },
  IfStatement(node) {
    if (node.test instanceof StepperLiteral) {
      if (node.test.value) {
        return 'If statement evaluated, condition true, proceed to if block'
      } else {
        return 'If statement evaluated, condition false, proceed to else block'
      }
    } else {
      throw new Error('Not implemented')
    }
  },
  LogicalExpression(node) {
    if (node.operator == '&&') {
      return (node.left as StepperLiteral).value === true
        ? 'AND operation evaluated, left of operator is true, continue evaluating right of operator'
        : 'AND operation evaluated, left of operator is false, stop evaluation'
    } else if (node.operator === '||') {
      return (node.left as StepperLiteral).value === true
        ? 'OR operation evaluated, left of operator is true, stop evaluation'
        : 'OR operation evaluated, left of operator is false, continue evaluating right of operator'
    }

    throw new Error(`Invalid operator for LogicalExpression: ${node.operator}`) 
  },
  ReturnStatement(node) {
    if (!node.argument) {
      throw new Error('return argument should not be empty')
    }
    return `${generate(node.argument)} returned`
  },
  UnaryExpression(node) {
    if (node.operator === '-') {
      return (
        'Unary expression evaluated, value ' +
        JSON.stringify((node.argument as StepperLiteral).value) +
        ' negated.'
      )
    } else if (node.operator === '!') {
      return (
        'Unary expression evaluated, boolean ' +
        JSON.stringify((node.argument as StepperLiteral).value) +
        ' negated.'
      )
    } else {
      throw new Error('Unsupported unary operator ' + node.operator)
    }
  },
  VariableDeclaration(node) {
    if (node.kind === 'const') {
      return (
        'Constant ' +
        node.declarations.map(ast => ast.id.name).join(', ') +
        ' declared and substituted into the rest of block'
      )
    } else {
      return '...'
    }
  },
}

export function convert(node: es.BaseNode): StepperBaseNode {
  const converter = nodeConverters[node.type as keyof typeof nodeConverters]
  return converter ? converter(node as any) : undefinedNode
}

// Explanation generator
export function explain(redex: StepperBaseNode): string {
  if (redex.type in explainers) {
    // @ts-expect-error Parameter type gets narrowed to never
    return explainers[redex.type](redex)
  }

  return '...'
}
