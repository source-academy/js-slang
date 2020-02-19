import { simple } from 'acorn-walk/dist/walk'
import * as es from 'estree'
import { BlockFrame, DefinitionNode } from './types'

export function scopeVariables(
  program: es.Program | es.BlockStatement,
  enclosingLoc?: es.SourceLocation | null
): BlockFrame {
  const block: BlockFrame = {
    type: 'BlockFrame',
    loc: program.loc,
    enclosingLoc,
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
  const arrowFunctionNodes = scopeArrowFunctions(arrowFunctions)

  block.children = [
    ...variableDefinitionNodes,
    ...functionDefinitionNodes,
    ...variableAssignmentNodes,
    ...functionBodyNodes,
    ...arrowFunctionNodes.params,
    ...arrowFunctionNodes.blocks,
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
    loc: node.declarations[0].id.loc
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
  const body = scopeVariables(node.body, node.loc)

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

function scopeArrowFunctions(
  nodes: es.ArrowFunctionExpression[]
): { params: DefinitionNode[]; blocks: BlockFrame[] } {
  const arrowFunctionParamsNested = nodes.map(node =>
    node.params.map(param => ({
      name: (param as es.Identifier).name,
      type: 'DefinitionNode',
      loc: node.loc
    }))
  )

  // When processing the arrow function body, we always convert it to a block
  // for easier processing that has the same loc as the current expression
  const blocks = nodes.map(node =>
    node.body.type === 'BlockStatement'
      ? scopeVariables(node.body, node.loc)
      : scopeVariables(
          {
            type: 'BlockStatement',
            loc: node.body.loc,
            body: [{ type: 'ExpressionStatement', expression: node.body }]
          },
          node.loc
        )
  )
  return { params: arrowFunctionParamsNested.reduce((x, y) => [...x, ...y], []), blocks }
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
    block: scopeVariables(node.body as es.BlockStatement, node.loc)
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

export function getAllOccurrencesInScope(
  target: string,
  line: number,
  col: number,
  program: es.Program
): es.SourceLocation[] {
  const lookupTree = scopeVariables(program)
  const identifiers: es.Identifier[] = []

  simple(program, {
    Identifier(node: es.Identifier) {
      if (notEmpty(node.loc) && node.name === target) {
        identifiers.push(node)
      }
    }
  })

  return getAllOccurrencesInScopeHelper(target, line, col, lookupTree, identifiers, [])
}

export function getAllOccurrencesInScopeHelper(
  target: string,
  line: number,
  col: number,
  block: BlockFrame,
  identifiers: es.Identifier[],
  occurrences: es.SourceLocation[]
): es.SourceLocation[] {
  // First we check if there's a redeclaration of the target in the current scope
  // If there is, set the occurences array to empty because there's a new scope for the name
  const definitionNodes = block.children.filter(isDefinitionNode)
  if (definitionNodes.length !== 0) {
    occurrences = []
  }

  // Only get identifiers that are not in another nested block
  const nestedBlocks = block.children.filter(isBlockFrame)
  const identifiersInCurrentBlock = getIdentifiersInCurrentBlock(identifiers, nestedBlocks)
  occurrences = [...occurrences, ...identifiersInCurrentBlock]

  // Get the block where the target lies, and the identifiers that lie within it
  const blocksToRecurse = (block.children.filter(child =>
    isBlockFrame(child)
  ) as BlockFrame[]).filter(childBlock => isLineNumberInLoc(line, childBlock.loc))

  if (blocksToRecurse.length === 0) {
    return occurrences
  }
  const blockToRecurse = blocksToRecurse[0]
  // TODO: Find a way to neaten the structure of the block to ensure cleaner recursion
  // We look for any identifiers that are outside the smaller loc and inside the enclosing loc
  if (notEmpty(blockToRecurse.enclosingLoc)) {
    const enclosingDefinitions = definitionNodes.filter(
      node =>
        isPartOf(node.loc as es.SourceLocation, blockToRecurse.enclosingLoc as es.SourceLocation) &&
        !isPartOf(node.loc as es.SourceLocation, blockToRecurse.loc as es.SourceLocation)
    )
    if (enclosingDefinitions.length !== 0) {
      occurrences = []
    }
  }

  const identifiersInBlockToRecurse = identifiers.filter(identifier =>
    isPartOf(identifier.loc as es.SourceLocation, blockToRecurse.enclosingLoc as es.SourceLocation)
  )
  return getAllOccurrencesInScopeHelper(
    target,
    line,
    col,
    blockToRecurse,
    identifiersInBlockToRecurse,
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

function isDefinitionNode(node: DefinitionNode | BlockFrame): node is DefinitionNode {
  return node.type === 'DefinitionNode'
}

function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
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

function isPartOf(curr: es.SourceLocation, enclosing: es.SourceLocation): boolean {
  if (enclosing.start.line < curr.start.line && enclosing.end.line > curr.end.line) {
    return true
  } else if (enclosing.start.line === curr.start.line && enclosing.end.line > curr.end.line) {
    return curr.start.column >= enclosing.start.column
  } else if (enclosing.start.line < curr.start.line && enclosing.end.line === curr.end.line) {
    return curr.end.column <= enclosing.end.column
  } else if (enclosing.start.line === curr.start.line && enclosing.end.line === curr.end.line) {
    if (enclosing.start.column <= curr.start.column && enclosing.end.column >= curr.end.column) {
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}

// Returns all identifiers that are not within any nested blocks
function getIdentifiersInCurrentBlock(
  identifiers: es.Identifier[],
  blocks: BlockFrame[]
): es.SourceLocation[] {
  const filteredLocs: es.SourceLocation[] = identifiers
    .map(identifier => identifier.loc)
    .filter(notEmpty)
  return filteredLocs.filter(
    loc =>
      !blocks
        // Always select enclosing loc if it is available
        .map(block => (notEmpty(block.enclosingLoc) ? block.enclosingLoc : block.loc))
        .filter(notEmpty)
        .map(blockLoc => isPartOf(loc, blockLoc))
        .some(el => el === true)
  )
}
