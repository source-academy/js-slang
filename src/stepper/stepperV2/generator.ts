/*
TODO: Write docs  
convert estree into corresponding stepper type
Every class should have the following properties
- basic StepperBaseNodeInterface
- constructor: create new AST from class type StepperBaseNode
- static create: factory method to parse estree to StepperAST
*/

import * as es from 'estree'
import { generate } from 'astring'
import { StepperBinaryExpression } from "./nodes/Expression/BinaryExpression"
import { StepperUnaryExpression } from "./nodes/Expression/UnaryExpression"
import { StepperLiteral } from "./nodes/Expression/Literal"
import { StepperBaseNode } from './interface'
import { StepperExpressionStatement } from './nodes/Statement/ExpressionStatement'
import { StepperProgram } from './nodes/Program'
import { StepperVariableDeclaration, StepperVariableDeclarator } from './nodes/Statement/VariableDeclaration'
import { StepperIdentifier } from './nodes/Expression/Identifier'
import { StepperBlockStatement } from './nodes/Statement/BlockStatement'
const undefinedNode = new StepperLiteral('undefined');

const nodeConverters: {[Key: string]: (node: any) => StepperBaseNode} = {
  Literal: (node: es.SimpleLiteral) => StepperLiteral.create(node),
  UnaryExpression: (node: es.UnaryExpression) => StepperUnaryExpression.create(node),
  BinaryExpression: (node: es.BinaryExpression) => StepperBinaryExpression.create(node),
  ExpressionStatement: (node: es.ExpressionStatement) => StepperExpressionStatement.create(node),
  Program: (node: es.Program) => StepperProgram.create(node),
  VariableDeclaration: (node: es.VariableDeclaration) => StepperVariableDeclaration.create(node),
  VariableDeclarator: (node: es.VariableDeclarator) => StepperVariableDeclarator.create(node),
  Identifier: (node: es.Identifier) => StepperIdentifier.create(node),
  BlockStatement: (node: es.BlockStatement) => StepperBlockStatement.create(node)
};

export function convert(node: es.BaseNode): StepperBaseNode {
  const converter = nodeConverters[node.type as keyof typeof nodeConverters];
  return converter ? converter(node as any) : undefinedNode;
}


// Explanation generator
export function explain(redex: StepperBaseNode): string {
  const explainers = {
    UnaryExpression: (node: StepperUnaryExpression) => {
      return "Unary expression " + generate(node) + " evaluated"
    },
    BinaryExpression: (node: StepperBinaryExpression) => {
      return "Binary expression " + generate(node) + " evaluated"
    },
    VariableDeclaration: (node: StepperVariableDeclaration) => {
      if (node.kind === "const") {
        return "Constant " + node.declarations.map(ast => ast.id.name).join(", ") + " declared and substituted into the rest of block"
      } else {
        return "..."
      }
    },
    ExpressionStatement: (node: StepperExpressionStatement) => {
      return generate(node.expression) + " finished evaluating"
    }, 
    Default: (_: StepperBaseNode) => {
      return "...";
    },
  }
  //@ts-ignore
  const explainer = explainers[redex.type] ?? explainers.Default;
  return explainer(redex);
}

