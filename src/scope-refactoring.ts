import { simple } from 'acorn-walk/dist/walk'
import { SourceLocation } from 'acorn/dist/acorn'
import * as es from 'estree'
import { isInLoc } from './finder'
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
  const definitionStatements = getDeclarationStatements(program.body) as (
    | es.VariableDeclaration
    | es.FunctionDeclaration
  )[]
  const blockStatements = getBlockStatements(program.body)
  const forStatements = getForStatements(program.body)
  const ifStatements = getIfStatements(program.body)
  const whileStatements = getWhileStatements(program.body)
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

  const variableDefinitionNodes = variableStatements.map(statement =>
    scopeVariableDeclaration(statement)
  )
  const blockNodes = blockStatements.map(statement => scopeVariables(statement))
  let arrowFunctionNodes = arrowFunctions.map(statement => scopeArrowFunction(statement))
  // Arrow functions are found via parsing the global ast tree. However, we only want
  // the arrow functions which are not part of any child block at any point in time
  // Hence, the arrowFunctionNodes are the arrow functions which are declared in this block's scope
  arrowFunctionNodes = getBlockFramesInCurrentBlockFrame(
    arrowFunctionNodes,
    block.enclosingLoc as es.SourceLocation,
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
    // Assume that only one variable can be declared per line
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
  // node.loc refers to the loc of the entire function definition, not just its body
  const body = scopeVariables(node.body, node.loc)

  body.children = [...parameters, ...body.children]
  // Treat function parameters as definitions in the function body, since their scope is limited to the body.
  return { definition, body }
}

function scopeArrowFunction(node: es.ArrowFunctionExpression): BlockFrame {
  const params = node.params.map(param => ({
    name: (param as es.Identifier).name,
    type: 'DefinitionNode',
    isDeclaration: true,
    loc: param.loc
  }))
  // arrowFunctionBodies may not contain curly braces on the RHS of the arrow
  // For ease of processing, we treat the code on the RHS as a single expression being enclosed in {}
  // eg. map(x => x + 1) becomes map(x => {x + 1}) in the scopedVariableTree
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
  // Treat function parameters as definitions in the function body, since their scope is limited to the body.
  body.children = [...params, ...body.children]
  return body
}

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

// For statements may declare new variables whose scope is limited to the loop body
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
  // Any variable declared at the start of the for loop is inserted into the body
  // since its scope is limited to the body
  block.children = [...variables, ...block.children]
  return block
}

export function getScopeHelper(
  definitionLocation: es.SourceLocation,
  program: es.Program,
  target: string
): any {
  const lookupTree = scopeVariables(program)

  console.log(lookupTree)

  // Find closest ancestor of node.
  const block = getBlockFromLoc(definitionLocation, lookupTree)
  const parentRange = block.loc

  // Recurse on the children
  const nestedBlocks = block.children.filter(isBlockFrame)
  const nestedBlocksWithDefinitions = nestedBlocks.filter(
    child => getDefinitionsInChildScope(child, target).length > 0
  )
  console.log('nestedBlocksWithDefinitions', nestedBlocksWithDefinitions)
  nestedBlocksWithDefinitions.sort(sortByLoc)
  const rangeToExclude = nestedBlocksWithDefinitions.map(b => b.enclosingLoc)

  if (rangeToExclude.length === 0) {
    return [parentRange]
  }

  const ranges: SourceLocation[] = []
  let prevRange = rangeToExclude.shift()
  ranges.push({ start: (parentRange as any).start, end: (prevRange as any).start })
  rangeToExclude.map(range => {
    ranges.push({ start: (prevRange as any).end, end: (rangeToExclude.shift() as any).start })
    prevRange = range
  })
  ranges.push({ start: (prevRange as any).end, end: (parentRange as any).end })

  return ranges
}

function getDefinitionsInChildScope(
  block: BlockFrame,
  target: string
): (DefinitionNode | BlockFrame)[] {
  console.log('Getting definitons for', target, 'in', block)
  const definitionNodes = block.children
    .filter(isDefinitionNode)
    .filter(node => node.name === target)
    .filter(node => node.isDeclaration)
  return definitionNodes
}

// This function works by first searching for closest declaration of that variable in the parent scopes
// Then, using the block where the node is found as the root, recurse on the children and get all
// usages of the variable there
export function getAllOccurrencesInScopeHelper(
  definitionLocation: es.SourceLocation,
  program: es.Program,
  target: string
): es.SourceLocation[] {
  const lookupTree = scopeVariables(program)
  // Find closest declaration of node.
  const block = getBlockFromLoc(definitionLocation, lookupTree)
  const identifiers = getAllIdentifiers(program, target)
  // Recurse on teh children
  const nestedBlocks = block.children.filter(isBlockFrame)
  const occurences = getNodeLocsInCurrentBlockFrame(
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
  // If there is, return empty array because there's a new scope for the name in this node
  // and all subsequent child nodes
  const definitionNodes = block.children
    .filter(isDefinitionNode)
    .filter(node => node.name === target)
    .filter(node => node.isDeclaration)
  if (definitionNodes.length !== 0) {
    return []
  }

  // Only get identifiers that are not in another nested block
  const nestedBlocks = block.children.filter(isBlockFrame)
  const occurences = getNodeLocsInCurrentBlockFrame(
    identifiers,
    block.enclosingLoc as es.SourceLocation,
    nestedBlocks
  )
  const occurencesInChildScopes = nestedBlocks.map(child =>
    getAllOccurencesInChildScopes(target, child, identifiers)
  )
  return [...occurences, ...occurencesInChildScopes.reduce((x, y) => [...x, ...y], [])]
}

// Gets the enclosing block of a node.
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

// Adapted from src/transpiler.ts L345
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
function getBlockStatements(nodes: (es.Statement | es.ModuleDeclaration)[]): es.BlockStatement[] {
  return nodes.filter(statement => statement.type === 'BlockStatement') as es.BlockStatement[]
}

function getDeclarationStatements(
  nodes: (es.Statement | es.ModuleDeclaration)[]
): (es.Statement | es.ModuleDeclaration)[] {
  return nodes.filter(
    statement =>
      statement.type === 'FunctionDeclaration' || statement.type === 'VariableDeclaration'
  )
}

function getIfStatements(nodes: (es.Statement | es.ModuleDeclaration)[]): es.IfStatement[] {
  return nodes.filter(statement => statement.type === 'IfStatement') as es.IfStatement[]
}

function getForStatements(nodes: (es.Statement | es.ModuleDeclaration)[]): es.ForStatement[] {
  return nodes.filter(statement => statement.type === 'ForStatement') as es.ForStatement[]
}

function getWhileStatements(nodes: (es.Statement | es.ModuleDeclaration)[]): es.WhileStatement[] {
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
// sortByLoc is a comparator function that sorts the nodes by their row and column.
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

// This checks if a node is part of another node via its loc/enclosingLoc property.
function isPartOf(curr: es.SourceLocation, enclosing: es.SourceLocation): boolean {
  return (
    isInLoc(curr.start.line, curr.start.column, enclosing) &&
    isInLoc(curr.end.line, curr.end.column, enclosing)
  )
}

// Returns all nodes that are not within any nested blocks
function getNodeLocsInCurrentBlockFrame<E extends es.Node>(
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
        .map(block => block.enclosingLoc)
        .filter(notEmpty)
        .map(blockLoc => isPartOf(loc, blockLoc))
        .some(el => el === true)
  )
}

function getBlockFramesInCurrentBlockFrame(
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
        .map(block => block.enclosingLoc)
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
