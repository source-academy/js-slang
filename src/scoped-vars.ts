import * as es from 'estree'
import { BlockFrame, DefinitionNode } from './types'

export function scopeVariables(node: es.Program | es.BlockStatement): BlockFrame {
  const block: BlockFrame = {
    loc: node.loc,
    type: 'BlockFrame',
    children: []
  }
  const definitionStatements = getDeclarationStatements(node.body) as Array<
    es.VariableDeclaration | es.FunctionDeclaration
  >
  const blockStatements = getBlockStatements(node.body) as es.BlockStatement[]

  const variableDefinitions = definitionStatements
    .filter(statement => isVariableDeclaration(statement))
    .map((statement: es.VariableDeclaration) => scopeVariableDeclaration(statement))
  const functionDeclarations = definitionStatements
    .filter(statement => !isVariableDeclaration(statement))
    .map((statement: es.FunctionDeclaration) => scopeFunctionDeclaration(statement))
  const blockNodes = blockStatements.map(statement => scopeVariables(statement))
  const functionDefinitions = functionDeclarations.map(declaration => declaration.definition)
  const functionBodies = functionDeclarations.map(declaration => declaration.body)

  block.children = [
    ...variableDefinitions,
    ...functionDefinitions,
    ...functionBodies,
    ...blockNodes
  ]
  block.children.sort(sortByLoc)

  return block
}

export function scopeVariableDeclaration(node: es.VariableDeclaration): DefinitionNode {
  return {
    name: (node.declarations[0].id as es.Identifier).name,
    type: 'DefinitionNode',
    loc: node.loc
  }
}

export function scopeFunctionDeclaration(
  node: es.FunctionDeclaration
): {
  definition: DefinitionNode
  body: BlockFrame
} {
  const definition = {
    name: (node.id as es.Identifier).name,
    type: 'DefinitionNode',
    loc: node.loc
  }
  const parameters = node.params.map((param: es.Identifier) => ({
    name: param.name,
    type: 'DefinitionNode',
    // overwrite loc because function parameters loc matches that of the function block
    loc:
      node.loc == null
        ? node.loc
        : {
            start: { line: node.loc.start.line, column: node.loc.start.column },
            end: { line: node.loc.start.line, column: node.loc.start.column }
          }
  }))
  const body = scopeVariables(node.body)

  // Modify the body's children attribute to add function parameters
  body.children = [...parameters, ...body.children]
  return { definition, body }
}

export function lookupDefinition(
  variableName: string,
  line: number,
  node: BlockFrame,
  currentDefinition?: DefinitionNode
): DefinitionNode | void {
  if (!isLineNumberInLoc(line, node.loc)) {
    return
  }

  const matches = (node.children.filter(child => !isBlockFrame(child)) as DefinitionNode[])
    .filter(child => child.name === variableName)
    .filter(child => (child.loc ? child.loc.end.line <= line : false)) // Only get those definitions above line
  currentDefinition = matches.length > 0 ? matches[matches.length - 1] : currentDefinition
  const blockToRecurse = (node.children.filter(child =>
    isBlockFrame(child)
  ) as BlockFrame[]).filter(block => isLineNumberInLoc(line, block.loc))

  return blockToRecurse.length === 1
    ? lookupDefinition(variableName, line, blockToRecurse[0], currentDefinition)
    : currentDefinition
}

function getBlockStatements(
  nodes: Array<es.Statement | es.ModuleDeclaration>
): Array<es.Statement | es.ModuleDeclaration> {
  return nodes.filter(statement => statement.type === 'BlockStatement')
}

function getDeclarationStatements(
  nodes: Array<es.Statement | es.ModuleDeclaration>
): Array<es.Statement | es.ModuleDeclaration> {
  return nodes.filter(
    statement =>
      statement.type === 'FunctionDeclaration' || statement.type === 'VariableDeclaration'
  )
}

// Type Guards
function isVariableDeclaration(
  statement: es.VariableDeclaration | es.FunctionDeclaration
): statement is es.VariableDeclaration {
  return statement.type === 'VariableDeclaration'
}

function isBlockFrame(node: DefinitionNode | BlockFrame): node is BlockFrame {
  return node.type === 'BlockFrame'
}

// Helper functions
// Sort by loc sorts the functions by their row. It assumes that there are no repeated definitions in a row
function sortByLoc(x: DefinitionNode | BlockFrame, y: DefinitionNode | BlockFrame): number {
  if (x.loc == null && y.loc == null) {
    return 0
  } else if (x.loc == null) {
    return -1
  } else if (y.loc == null) {
    return 1
  }

  if (x.loc.start.line === y.loc.start.line) {
    return 0
  } else if (x.loc.start.line < y.loc.start.line) {
    return -1
  } else {
    return 1
  }
}

function isLineNumberInLoc(line: number, location?: es.SourceLocation | null): boolean {
  if (location == null) {
    return false
  }

  const startLine = location.start.line
  const endLine = location.end.line
  return line >= startLine && line <= endLine
}
