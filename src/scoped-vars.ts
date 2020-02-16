import { simple } from 'acorn-walk/dist/walk'
import * as es from 'estree'
import { BlockFrame, DefinitionNode } from './types'

export function scopeVariables(program: es.Program | es.BlockStatement): BlockFrame {
  const block: BlockFrame = {
    loc: program.loc,
    type: 'BlockFrame',
    children: []
  }
  const definitionStatements = getDeclarationStatements(program.body) as Array<
    es.VariableDeclaration | es.FunctionDeclaration
  >
  const blockStatements = getBlockStatements(program.body) as es.BlockStatement[]
  const forStatements = getForStatements(program.body)
  const ifStatements = getIfStatements(program.body)
  const whileStatements = getWhileStatements(program.body)
  const assignmentStatements = getAssignmentStatements(program.body)
  const variableStatements = definitionStatements.filter(statement =>
    isVariableDeclaration(statement)
  ) as es.VariableDeclaration[]

  const arrowFunctions: es.ArrowFunctionExpression[] = []
  simple(program, {
    ArrowFunctionExpression(node: es.ArrowFunctionExpression) {
      arrowFunctions.push(node)
    }
  })

  const ifStatementNodes = scopeIfStatements(ifStatements)
  const whileStatementNodes = scopeWhileStatements(whileStatements)
  const forStatementNodes = scopeForStatements(forStatements)
  const forStatementVariables = forStatementNodes
    .map(node => node.variables)
    .reduce((x, y) => [...x, ...y], [])
  const forStatementBlocks = forStatementNodes.map(node => node.block)

  const functionDeclarations = definitionStatements
    .filter(statement => !isVariableDeclaration(statement))
    .map((statement: es.FunctionDeclaration) => scopeFunctionDeclaration(statement))
  const functionDefinitionNodes = functionDeclarations.map(declaration => declaration.definition)
  const functionBodyNodes = functionDeclarations.map(declaration => declaration.body)

  const variableAssignmentNodes = assignmentStatements.map(statement =>
    scopeAssignmentStatement(statement)
  )
  const variableDefinitionNodes = variableStatements.map(statement =>
    scopeVariableDeclaration(statement)
  )
  const blockNodes = blockStatements.map(statement => scopeVariables(statement))
  const arrowFunctionDefinitionsNodes = scopeArrowFunctions(arrowFunctions)

  block.children = [
    ...variableDefinitionNodes,
    ...functionDefinitionNodes,
    ...variableAssignmentNodes,
    ...functionBodyNodes,
    ...arrowFunctionDefinitionsNodes,
    ...ifStatementNodes,
    ...whileStatementNodes,
    ...forStatementVariables,
    ...forStatementBlocks,
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
    loc: node.loc
  }))
  const body = scopeVariables(node.body)

  // Modify the body's children attribute to add function parameters
  body.children = [...parameters, ...body.children]
  return { definition, body }
}

function scopeAssignmentStatement(node: es.ExpressionStatement): DefinitionNode {
  return {
    name: ((node.expression as es.AssignmentExpression).left as es.Identifier).name,
    type: 'DefinitionNode',
    loc: node.loc
  }
}

function scopeArrowFunctions(nodes: es.ArrowFunctionExpression[]): DefinitionNode[] {
  const arrowFunctionParamsNested = nodes.map(node =>
    node.params.map(param => ({
      name: (param as es.Identifier).name,
      type: 'DefinitionNode',
      loc: node.loc
    }))
  )
  return arrowFunctionParamsNested.reduce((x, y) => [...x, ...y], [])
}

// If statements contain nested predicate and consequent statements
function scopeIfStatements(nodes: es.IfStatement[]): BlockFrame[] {
  const nestedBlocks = nodes.map(node => scopeIfStatement(node))
  return nestedBlocks.reduce((x, y) => [...x, ...y], [])
}

function scopeIfStatement(node: es.IfStatement): BlockFrame[] {
  const block = node.consequent as es.BlockStatement
  if (node.alternate == null) {
    return [scopeVariables(block)]
  } else {
    return node.alternate.type === 'BlockStatement'
      ? [scopeVariables(block), scopeVariables(node.alternate)]
      : [scopeVariables(block), ...scopeIfStatement(node.alternate as es.IfStatement)]
  }
}

function scopeWhileStatements(nodes: es.WhileStatement[]): BlockFrame[] {
  return nodes.map(node => scopeVariables(node.body as es.BlockStatement))
}

function scopeForStatements(
  nodes: es.ForStatement[]
): Array<{ variables: DefinitionNode[]; block: BlockFrame }> {
  return nodes.map(node => ({
    variables: node.init
      ? (node.init as es.VariableDeclaration).declarations.map((dec: es.VariableDeclarator) => ({
          type: 'DefinitionNode',
          name: (dec.id as es.Identifier).name,
          loc: dec.loc
        }))
      : [],
    block: scopeVariables(node.body as es.BlockStatement)
  }))
}

// Functions to lookup definition location of any variable
export function lookupDefinition(
  variableName: string,
  line: number,
  col: number,
  node: BlockFrame,
  currentDefinition?: DefinitionNode
): DefinitionNode | void {
  if (!isLineNumberInLoc(line, node.loc)) {
    return
  }

  const matches = (node.children.filter(child => !isBlockFrame(child)) as DefinitionNode[])
    .filter(child => child.name === variableName)
    .filter(child =>
      child.loc ? child.loc.start.line <= line && child.loc.start.column <= col : false
    ) // Only get those definitions above line
  currentDefinition = matches.length > 0 ? matches[matches.length - 1] : currentDefinition
  const blockToRecurse = (node.children.filter(child =>
    isBlockFrame(child)
  ) as BlockFrame[]).filter(block => isLineNumberInLoc(line, block.loc))

  return blockToRecurse.length === 1
    ? lookupDefinition(variableName, line, col, blockToRecurse[0], currentDefinition)
    : currentDefinition
}

// Function to do scope redeclaration
export function getAllOccurrencesInScope(
  target: string,
  line: number,
  col: number,
  program: es.Program,
  occurrences: es.SourceLocation[] = []
): es.SourceLocation[] {
  // First we check if there's a redeclaration of the target in the current scope
  // If there is, set the occurences array to empty because there's a new scope for the name
  const variableDeclarations = program.body.filter(
    statement => statement.type === 'VariableDeclaration'
  ) as es.VariableDeclaration[]
  if (
    variableDeclarations.filter(node => (node.declarations[0].id as es.Identifier).name === target)
      .length === 0
  ) {
    occurrences = []
  }

  // Get all the usages of the variable in the current scope/block
  const programWithoutBlocks = {
    ...program,
    body: program.body.filter(statement => statement.type !== 'BlockStatement')
  }
  const allIdentifiers: es.SourceLocation[] = []
  simple(programWithoutBlocks, {
    Identifier(node: es.Identifier) {
      if (node.name === target) {
        if (node.loc) {
          allIdentifiers.push(node.loc)
        }
      }
    }
  })
  occurrences = occurrences.concat(allIdentifiers)

  // Get the block where the target lies
  const nextBlock = (program.body.filter(
    statement => statement.type === 'BlockStatement'
  ) as es.BlockStatement[]).filter(node => isLineNumberInLoc(line, node.loc))
  if (nextBlock.length === 0) {
    return occurrences
  }

  return getAllOccurrencesInScope(
    target,
    line,
    col,
    {
      type: 'Program',
      loc: nextBlock[0].loc,
      body: nextBlock[0].body,
      sourceType: 'script' // Junk value
    },
    occurrences
  )
}

// Helper functions to filter nodes
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

function getAssignmentStatements(
  nodes: Array<es.Statement | es.ModuleDeclaration>
): es.ExpressionStatement[] {
  return nodes.filter(
    statement =>
      statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'AssignmentExpression'
  ) as es.ExpressionStatement[]
}

function getIfStatements(nodes: Array<es.Statement | es.ModuleDeclaration>): es.IfStatement[] {
  return nodes.filter(statement => statement.type === 'IfStatement') as es.IfStatement[]
}

function getForStatements(nodes: Array<es.Statement | es.ModuleDeclaration>): es.ForStatement[] {
  return nodes.filter(statement => statement.type === 'ForStatement') as es.ForStatement[]
}

function getWhileStatements(
  nodes: Array<es.Statement | es.ModuleDeclaration>
): es.WhileStatement[] {
  return nodes.filter(statement => statement.type === 'WhileStatement') as es.WhileStatement[]
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

  if (x.loc.start.line > y.loc.start.line) {
    return 1
  } else if (x.loc.start.line < y.loc.start.line) {
    return -1
  } else {
    return x.loc.start.column - y.loc.start.column
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
