import * as es from 'estree'
import {
  BlockFrame,
  DefinitionNode,
} from './types'

export function scopeVariables(node: es.Program | es.BlockStatement): (BlockFrame) {
  const block: BlockFrame = {
    loc: node.loc,
    type: "BlockFrame",
    children: []
  }
  const definitionStatements: Array<es.VariableDeclaration|es.FunctionDeclaration> =
    getDeclarationStatements(node.body) as Array<es.VariableDeclaration|es.FunctionDeclaration>
  const blockStatements: es.BlockStatement[] =
    getBlockStatements(node.body) as es.BlockStatement[];
  const definitionNodes = definitionStatements.map(statement => isVariableDeclaration(statement)
    ? scopeVariableDeclaration(statement)
    : scopeFunctionDeclaration(statement));
  const blockNodes = blockStatements.map(statement => scopeVariables(statement))
  block.children = [...definitionNodes, ...blockNodes]

  return block
}

export function scopeVariableDeclaration(node: es.VariableDeclaration): DefinitionNode {
  return {
    name: (node.declarations[0].id as es.Identifier).name,
    type: "DefinitionNode",
    loc: node.loc
  }
}

export function scopeFunctionDeclaration(node: es.FunctionDeclaration): DefinitionNode {
  return {
    name: (node.id as es.Identifier).name,
    type: "DefinitionNode",
    loc: node.loc
  }
}

export function lookupDefinition(
  variableName: string,
  line: number,
  node: BlockFrame,
  currentDefinition?: DefinitionNode
): DefinitionNode|void {
  if (!isLineNumberInLoc(line, node.loc)) {
    return
  }

  const matches = (node.children.filter(child => !isBlockFrame(child)) as DefinitionNode[])
    .filter(child => child.name === variableName)
    .filter(child => child.loc ? child.loc.end.line <= line : false) // Only get those definitions above line
  currentDefinition = matches[matches.length - 1]
  const blockToRecurse = (node.children.filter(child => isBlockFrame(child)) as BlockFrame[])
    .filter(block => isLineNumberInLoc(line, block.loc))

  return blockToRecurse.length === 1
    ? lookupDefinition(variableName, line, blockToRecurse[0], currentDefinition)
    : currentDefinition
}

function isLineNumberInLoc(line: number, location?: es.SourceLocation|null): boolean {
  if (location == null) {
    return false
  }

  const startLine = location.start.line
  const endLine = location.end.line
  return line >= startLine && line <= endLine
}

function getBlockStatements(nodes: Array<es.Statement|es.ModuleDeclaration>):
  Array<es.Statement|es.ModuleDeclaration> {
    return nodes.filter(statement => statement.type === "BlockStatement");
}

function getDeclarationStatements(nodes: Array<es.Statement|es.ModuleDeclaration>):
  Array<es.Statement|es.ModuleDeclaration> {
  return nodes.filter(statement => statement.type === "FunctionDeclaration"
    || statement.type === "VariableDeclaration")
}

// Type Guard
function isVariableDeclaration(statement: es.VariableDeclaration
  |es.FunctionDeclaration): statement is es.VariableDeclaration {
  return statement.type === "VariableDeclaration"
}

function isBlockFrame(node: DefinitionNode|BlockFrame): node is BlockFrame {
  return node.type === "BlockFrame"
}
