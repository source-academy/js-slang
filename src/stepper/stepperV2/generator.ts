/*
TODO: Write docs  
convert estree into corresponding stepper type
Every class should have the following properties
- basic StepperBaseNodeInterface
- constructor: create new AST from class type StepperBaseNode
- static create: factory method to parse estree to StepperAST
*/

import * as es from 'estree'
import { StepperBinaryExpression } from "./nodes/Expression/BinaryExpression"
import { StepperUnaryExpression } from "./nodes/Expression/UnaryExpression"
import { StepperLiteral } from "./nodes/Expression/Literal"
import { StepperBaseNode } from './interface'
import { StepperExpressionStatement } from './nodes/Statement/ExpressionStatement'
import { StepperProgram } from './nodes/Program'
import { StepperVariableDeclaration, StepperVariableDeclarator } from './nodes/Statement/VariableDeclaration'
import { StepperIdentifier } from './nodes/Expression/Identifier'
import { StepperBlockStatement } from './nodes/Statement/BlockStatement'
import { StepperIfStatement } from './nodes/Statement/IfStatement'
import { StepperConditionalExpression } from './nodes/Expression/ConditionalExpression'
import { StepperArrowFunctionExpression } from './nodes/Expression/ArrowFunctionExpression'
import { StepperFunctionApplication } from './nodes/Expression/FunctionApplication'
const undefinedNode = new StepperLiteral('undefined');

const nodeConverters: {[Key: string]: (node: any) => StepperBaseNode} = {
  Literal: (node: es.SimpleLiteral) => StepperLiteral.create(node),
  UnaryExpression: (node: es.UnaryExpression) => StepperUnaryExpression.create(node),
  BinaryExpression: (node: es.BinaryExpression) => StepperBinaryExpression.create(node),
  ExpressionStatement: (node: es.ExpressionStatement) => StepperExpressionStatement.create(node),
  ConditionalExpression: (node: es.ConditionalExpression) => StepperConditionalExpression.create(node),
  ArrowFunctionExpression: (node: es.ArrowFunctionExpression) => StepperArrowFunctionExpression.create(node),
  CallExpression: (node: es.CallExpression) => StepperFunctionApplication.create(node as es.SimpleCallExpression),
  Program: (node: es.Program) => StepperProgram.create(node),
  VariableDeclaration: (node: es.VariableDeclaration) => StepperVariableDeclaration.create(node),
  VariableDeclarator: (node: es.VariableDeclarator) => StepperVariableDeclarator.create(node),
  Identifier: (node: es.Identifier) => StepperIdentifier.create(node),
  BlockStatement: (node: es.BlockStatement) => StepperBlockStatement.create(node),
  IfStatement: (node: es.IfStatement) => StepperIfStatement.create(node)
};

export function convert(node: es.Node): StepperBaseNode {
  const converter = nodeConverters[node.type as keyof typeof nodeConverters];
  return converter ? converter(node as any) : undefinedNode;
}
