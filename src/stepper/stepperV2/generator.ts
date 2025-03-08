/*
TODO: Write docs  
convert estree into corresponding stepper type
Every class should have the following properties
- basic StepperBaseNodeInterface
- constructor: create new AST from class type StepperBaseNode
- static create: factory method to parse estree to StepperAST
*/

import * as es from 'estree'
import { StepperBinaryExpression } from "./nodes/BinaryExpression"
import { StepperUnaryExpression } from "./nodes/UnaryExpression"
import { StepperLiteral } from "./nodes/Literal"
import { StepperBaseNode } from './interface'
import { StepperExpressionStatement } from './nodes/StepperExpressionStatement'
import { StepperProgram } from './nodes/Program'
import { StepperVariableDeclaration, StepperVariableDeclarator } from './nodes/StepperVariableDeclaration'
const undefinedNode = new StepperLiteral('undefined');

const nodeConverters: {[Key: string]: (node: any) => StepperBaseNode} = {
  Literal: (node: es.SimpleLiteral) => StepperLiteral.create(node),
  UnaryExpression: (node: es.UnaryExpression) => StepperUnaryExpression.create(node),
  BinaryExpression: (node: es.BinaryExpression) => StepperBinaryExpression.create(node),
  ExpressionStatement: (node: es.ExpressionStatement) => StepperExpressionStatement.create(node),
  Program: (node: es.Program) => StepperProgram.create(node),
  VariableDeclaration: (node: es.VariableDeclaration) => StepperVariableDeclaration.create(node),
  VariableDeclarator: (node: es.VariableDeclarator) => StepperVariableDeclarator.create(node)
};

export function convert(node: es.Node): StepperBaseNode {
  const converter = nodeConverters[node.type as keyof typeof nodeConverters];
  return converter ? converter(node as any) : undefinedNode;
}
