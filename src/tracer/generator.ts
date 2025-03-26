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
import { StepperIfStatement } from './nodes/Statement/IfStatement'
import { StepperConditionalExpression } from './nodes/Expression/ConditionalExpression'
import { StepperArrowFunctionExpression } from './nodes/Expression/ArrowFunctionExpression'
import { StepperFunctionApplication } from './nodes/Expression/FunctionApplication'
import { StepperReturnStatement } from './nodes/Statement/ReturnStatement'
import { StepperFunctionDeclaration } from './nodes/Statement/FunctionDeclaration'
import { StepperArrayExpression } from './nodes/Expression/ArrayExpression'
import { StepperLogicalExpression } from './nodes/Expression/LogicalExpression'
const undefinedNode = new StepperLiteral('undefined');

const nodeConverters: {[Key: string]: (node: any) => StepperBaseNode} = {
  Literal: (node: es.SimpleLiteral) => StepperLiteral.create(node),
  UnaryExpression: (node: es.UnaryExpression) => StepperUnaryExpression.create(node),
  BinaryExpression: (node: es.BinaryExpression) => StepperBinaryExpression.create(node),
  LogicalExpression: (node: es.LogicalExpression) => StepperLogicalExpression.create(node),
  FunctionDeclaration: (node: es.FunctionDeclaration) => StepperFunctionDeclaration.create(node),
  ExpressionStatement: (node: es.ExpressionStatement) => StepperExpressionStatement.create(node),
  ConditionalExpression: (node: es.ConditionalExpression) => StepperConditionalExpression.create(node),
  ArrowFunctionExpression: (node: es.ArrowFunctionExpression) => StepperArrowFunctionExpression.create(node),
  ArrayExpression: (node: es.ArrayExpression) => StepperArrayExpression.create(node),
  CallExpression: (node: es.CallExpression) => StepperFunctionApplication.create(node as es.SimpleCallExpression),
  ReturnStatement: (node: es.ReturnStatement) => StepperReturnStatement.create(node),
  Program: (node: es.Program) => StepperProgram.create(node),
  VariableDeclaration: (node: es.VariableDeclaration) => StepperVariableDeclaration.create(node),
  VariableDeclarator: (node: es.VariableDeclarator) => StepperVariableDeclarator.create(node),
  Identifier: (node: es.Identifier) => StepperIdentifier.create(node),
  BlockStatement: (node: es.BlockStatement) => StepperBlockStatement.create(node),
  IfStatement: (node: es.IfStatement) => StepperIfStatement.create(node)
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
    ConditionalExpression: (node: StepperConditionalExpression) => {
      const test = node.test; // test should have typeof literal
      if (test.type !== 'Literal') {
        throw new Error("Invalid conditional contraction. `test` should be literal.")
      } 
      const testStatus = (test as StepperLiteral).value;
      if (typeof testStatus !== 'boolean') {
        throw new Error("Invalid conditional contraction. `test` should be boolean, got " + typeof testStatus + " instead.")
      }
      if (testStatus === true) {
        return "Conditional expression evaluated, condition is true, consequent evaluated";
      } else {
        return "Conditional expression evaluated, condition is false, alternate evaluated"
      }
    }, 
    /*
    CallExpression: (node: StepperFunctionApplication) => {
      if (node.callee.type !== "ArrowFunctionExpression" && node.callee.type !== "Identifier") { // TODO
        throw new Error("`callee` should be function expression.")
      }
      return node.arguments.map(generate).join(", ") + 
        " substituted into " + 
        (node.callee as StepperArrowFunctionExpression).params.map(generate).join(", ") + " of "
        + generate(node.callee);
    },
    */
    ArrowFunctionExpression: (node: StepperArrowFunctionExpression) => {
      throw new Error("Not implemented.")
    },
    Default: (_: StepperBaseNode) => {
      return "...";
    },
  }
  //@ts-ignore
  const explainer = explainers[redex.type] ?? explainers.Default;
  return explainer(redex);
}

