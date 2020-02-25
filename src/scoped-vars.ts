import { simple } from 'acorn-walk/dist/walk'
import * as es from 'estree'
import { BlockFrame, DefinitionNode } from './types'

export function scopeVariables(
  program: es.Program | es.BlockStatement,
  enclosingLoc?: es.SourceLocation | null
): BlockFrame {
  // If program is undefined due to parsing error, throw an error
  if (program === undefined) {
    throw new Error('Program to scope was undefined')
  }

  const block: BlockFrame = {
    type: 'BlockFrame',
    loc: program.loc,
    // By default, set enclosingLoc to be the same as loc
    enclosingLoc: enclosingLoc === undefined ? program.loc : enclosingLoc,
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
      if (node.loc != null) {
        arrowFunctions.push(node)
      }
    }
  })

  const ifStatementNodes = scopeIfStatements(ifStatements)
  const whileStatementNodes = scopeWhileStatements(whileStatements)
  const forStatementNodes = forStatements.map(statement => scopeForStatement(statement))

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
  let arrowFunctionNodes = arrowFunctions.map(statement => scopeArrowFunction(statement))
  arrowFunctionNodes = getNodesInCurrentBlock(
    arrowFunctionNodes,
    block.enclosingLoc as es.SourceLocation,
    // Need to filter it by all BlockFrames
    [
      ...blockNodes,
      ...forStatementNodes,
      ...whileStatementNodes,
      ...ifStatementNodes,
      ...functionBodyNodes,
      ...arrowFunctionNodes
    ]
  )

  block.children = [
    ...variableDefinitionNodes,
    ...functionDefinitionNodes,
    ...variableAssignmentNodes,
    ...functionBodyNodes,
    ...arrowFunctionNodes,
    ...ifStatementNodes,
    ...whileStatementNodes,
    ...forStatementNodes,
    ...blockNodes
  ]
  block.children.sort(sortByLoc)

  return block
}

export function scopeVariableDeclaration(node: es.VariableDeclaration): DefinitionNode {
  return {
    name: (node.declarations[0].id as es.Identifier).name,
    type: 'DefinitionNode',
    isDeclaration: true,
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
    isDeclaration: true,
    loc: (node.id as es.Identifier).loc
  }
  const parameters = node.params.map((param: es.Identifier) => ({
    name: param.name,
    type: 'DefinitionNode',
    isDeclaration: true,
    loc: param.loc
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
    isDeclaration: false,
    loc: ((node.expression as es.AssignmentExpression).left as es.Identifier).loc
  }
}

function scopeArrowFunction(node: es.ArrowFunctionExpression): BlockFrame {
  const params = node.params.map(param => ({
    name: (param as es.Identifier).name,
    type: 'DefinitionNode',
    isDeclaration: true,
    loc: param.loc
  }))
  const body =
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
  // Include parameters in the body
  body.children = [...params, ...body.children]
  return body
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

function scopeForStatement(node: es.ForStatement): BlockFrame {
  const variables = node.init
    ? (node.init as es.VariableDeclaration).declarations.map((dec: es.VariableDeclarator) => ({
        type: 'DefinitionNode',
        name: (dec.id as es.Identifier).name,
        isDeclaration: true,
        loc: (dec.id as es.Identifier).loc
      }))
    : []
  const block = scopeVariables(node.body as es.BlockStatement, node.loc)
  block.children = [...variables, ...block.children]
  return block
}

// Functions to lookup definition location of any variable
export function lookupDefinition(
  variableName: string,
  line: number,
  col: number,
  node: BlockFrame,
  currentDefinition?: DefinitionNode,
  lookupOriginalDeclaration: boolean = false
): DefinitionNode | void {
  if (!isInLoc(line, col, node.enclosingLoc as es.SourceLocation)) {
    return undefined
  }

  const matches = (node.children.filter(child => !isBlockFrame(child)) as DefinitionNode[])
    .filter(child => child.name === variableName)
    // If the lookupOriginalDeclaration is true, we only search for the original declaration
    // of the variable. Redefinitions of let variables are hence excluded
    .filter(child => (lookupOriginalDeclaration ? child.isDeclaration : true))
    .filter(child =>
      child.loc
        ? child.loc.start.line < line ||
          (child.loc.start.line === line && child.loc.start.column <= col)
        : false
    ) // Only get those definitions above line
  currentDefinition = matches.length > 0 ? matches[matches.length - 1] : currentDefinition
  const blockToRecurse = node.children
    .filter(isBlockFrame)
    .filter(block => isInLoc(line, col, block.enclosingLoc as es.SourceLocation))

  return blockToRecurse.length === 1
    ? lookupDefinition(
        variableName,
        line,
        col,
        blockToRecurse[0],
        currentDefinition,
        lookupOriginalDeclaration
      )
    : currentDefinition
}

export function getAllOccurrencesInScope(
  target: string,
  line: number,
  col: number,
  program: es.Program
): es.SourceLocation[] {
  const lookupTree = scopeVariables(program)
  const defNode = lookupDefinition(target, line, col, lookupTree, undefined, true)
  if (defNode == null || defNode.loc == null) {
    return []
  }
  const defLoc = defNode.loc
  const block = getBlockFromLoc(defLoc, lookupTree)
  const identifiers = getAllIdentifiers(program, target)
  const nestedBlocks = block.children.filter(isBlockFrame)
  const occurences = getNodeLocsInCurrentBlock(
    identifiers,
    block.enclosingLoc as es.SourceLocation,
    nestedBlocks
  )
  const occurencesInChildScopes = nestedBlocks.map(child =>
    getAllOccurencesInChildScopes(target, child, identifiers)
  )
  return [...occurences, ...occurencesInChildScopes.reduce((x, y) => [...x, ...y], [])]
}

function getAllOccurencesInChildScopes(
  target: string,
  block: BlockFrame,
  identifiers: es.Identifier[]
): es.SourceLocation[] {
  // First we check if there's a redeclaration of the target in the current scope
  // If there is, return empty array because there's a new scope for the name
  const definitionNodes = block.children
    .filter(isDefinitionNode)
    .filter(node => node.name === target)
    .filter(node => node.isDeclaration)
  if (definitionNodes.length !== 0) {
    return []
  }

  // Only get identifiers that are not in another nested block
  const nestedBlocks = block.children.filter(isBlockFrame)
  const occurences = getNodeLocsInCurrentBlock(
    identifiers,
    block.enclosingLoc as es.SourceLocation,
    nestedBlocks
  )
  const occurencesInChildScopes = nestedBlocks.map(child =>
    getAllOccurencesInChildScopes(target, child, identifiers)
  )
  return [...occurences, ...occurencesInChildScopes.reduce((x, y) => [...x, ...y], [])]
}

function getBlockFromLoc(loc: es.SourceLocation, block: BlockFrame): BlockFrame {
  let childBlocks = block.children.filter(isBlockFrame)
  let isPartOfChildBlock = childBlocks.some(node =>
    isPartOf(loc, node.enclosingLoc as es.SourceLocation)
  )
  while (isPartOfChildBlock) {
    // A block containing the loc must necessarily exist by the earlier check
    block = childBlocks.filter(node => isPartOf(loc, node.enclosingLoc as es.SourceLocation))[0]
    childBlocks = block.children.filter(isBlockFrame)
    isPartOfChildBlock = childBlocks.some(node =>
      isPartOf(loc, node.enclosingLoc as es.SourceLocation)
    )
  }
  return block
}

function getAllIdentifiers(program: es.Program, target: string): es.Identifier[] {
  const identifiers: es.Identifier[] = []

  simple(program, {
    Identifier(node: es.Identifier) {
      if (notEmpty(node.loc) && node.name === target) {
        identifiers.push(node)
      }
    },
    Pattern(node: es.Pattern) {
      if (node.type === 'Identifier') {
        if (node.name === target) {
          identifiers.push(node)
        }
      } else if (node.type === 'MemberExpression') {
        if (node.object.type === 'Identifier') {
          if (node.object.name === target) {
            identifiers.push(node.object)
          }
        }
      }
    }
  })

  return identifiers
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

function isInLoc(line: number, col: number, location: es.SourceLocation): boolean {
  if (location == null) {
    return false
  }

  if (location.start.line < line && location.end.line > line) {
    return true
  } else if (location.start.line === line && location.end.line > line) {
    return location.start.column <= col
  } else if (location.start.line < line && location.end.line === line) {
    return location.end.column >= col
  } else if (location.start.line === line && location.end.line === line) {
    if (location.start.column <= col && location.end.column >= col) {
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}

function isPartOf(curr: es.SourceLocation, enclosing: es.SourceLocation): boolean {
  return (
    isInLoc(curr.start.line, curr.start.column, enclosing) &&
    isInLoc(curr.end.line, curr.end.column, enclosing)
  )
}

// Returns all nodes that are not within any nested blocks
function getNodeLocsInCurrentBlock<E extends es.Node>(
  nodes: E[],
  currentLoc: es.SourceLocation,
  blocks: BlockFrame[]
): es.SourceLocation[] {
  const filteredLocs: es.SourceLocation[] = nodes
    .map(node => node.loc)
    .filter(notEmpty)
    .filter(loc => isPartOf(loc, currentLoc))
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

// Returns all nodes that are not within any nested blocks
// TODO: Refactor this function
function getNodesInCurrentBlock(
  nodes: BlockFrame[],
  currentLoc: es.SourceLocation,
  blocks: BlockFrame[]
): BlockFrame[] {
  const filteredNodes = nodes
    .filter(node => notEmpty(node.enclosingLoc))
    .filter(node => isPartOf(node.enclosingLoc as es.SourceLocation, currentLoc))
  return filteredNodes.filter(
    node =>
      !blocks
        // Always select enclosing loc if it is available
        .map(block => (notEmpty(block.enclosingLoc) ? block.enclosingLoc : block.loc))
        .filter(notEmpty)
        .map(
          blockLoc =>
            isPartOf(node.enclosingLoc as es.SourceLocation, blockLoc) &&
            !areLocsEqual(node.enclosingLoc as es.SourceLocation, blockLoc)
        )
        .some(el => el === true)
  )
}

function areLocsEqual(loc1: es.SourceLocation, loc2: es.SourceLocation): boolean {
  return (
    loc1.start.line === loc2.start.line &&
    loc1.start.column === loc2.start.column &&
    loc1.end.line === loc2.end.line &&
    loc1.end.column === loc2.end.column
  )
}
