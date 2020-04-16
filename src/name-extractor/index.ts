import * as es from 'estree'
import { findIdentifierNode, findAncestors } from '../finder'
import { Context } from '../'
import syntaxBlacklist from '../parser/syntaxBlacklist'

export interface NameDeclaration {
  name: string
  meta: string
  score?: number
}

const KIND_FUNCTION = 'func'
// const KIND_LET = 'let'
const KIND_PARAM = 'param'
const KIND_CONST = 'const'

function isDeclaration(node: es.Node): boolean {
  return node.type === 'VariableDeclaration' || node.type === 'FunctionDeclaration'
}

function isFunction(node: es.Node): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  )
}

// Update this to use exported check from "acorn-loose" package when it is released
function isDummyName(name: string): boolean {
  return name === '✖'
}

// Ensure that keywords are prioritized over names
const keywords: { [key: string]: NameDeclaration[] } = {
  // Return cannot always be suggested so it is handled specially
  // ReturnStatement: [{ name: 'return', meta: 'keyword', score: 20000 }],
  FunctionDeclaration: [{ name: 'function', meta: 'keyword', score: 20000 }],
  VariableDeclaration: [{ name: 'const', meta: 'keyword', score: 20000 }],
  AssignmentExpression: [{ name: 'let', meta: 'keyword', score: 20000 }],
  WhileStatement: [{ name: 'while', meta: 'keyword', score: 20000 }],
  IfStatement: [
    { name: 'if', meta: 'keyword', score: 20000 },
    { name: 'else', meta: 'keyword', score: 20000 }
  ],
  ForStatement: [{ name: 'for', meta: 'keyword', score: 20000 }]
}

export function getKeywords(
  prog: es.Node,
  cursorLoc: es.Position,
  context: Context
): NameDeclaration[] {
  const identifier = findIdentifierNode(prog, context, cursorLoc)
  if (!identifier) {
    return []
  }

  const ancestors = findAncestors(prog, identifier)
  if (!ancestors) {
    return []
  }

  // In the init part of a for statement, `let` is the only valid keyword
  if (
    ancestors[0].type === 'ForStatement' &&
    identifier === (ancestors[0] as es.ForStatement).init
  ) {
    return context.chapter >= syntaxBlacklist.AssignmentExpression
      ? keywords.AssignmentExpression
      : []
  }

  const keywordSuggestions: NameDeclaration[] = []

  // Suggest `return` only inside functions
  if (
    ancestors.some(node => isFunction(node)) &&
    context.chapter >= syntaxBlacklist.ReturnStatement
  ) {
    keywordSuggestions.push({ name: 'return', meta: 'keyword', score: 20000 })
  }

  // The rest of the keywords are only valid at the beginning of a statement
  if (
    ancestors[0].type === 'ExpressionStatement' &&
    ancestors[0].loc!.start === identifier.loc!.start
  ) {
    Object.entries(keywords)
      .filter(([nodeType]) => context.chapter >= syntaxBlacklist[nodeType])
      .forEach(([nodeType, decl]) => keywordSuggestions.push(...decl))
  }
  return keywordSuggestions
}

// Returns [suggestions, shouldPrompt].
// Don't prompt if user is typing comments, declaring a variable or declaring function arguments
export function getProgramNames(
  prog: es.Node,
  comments: acorn.Comment[],
  cursorLoc: es.Position
): [NameDeclaration[], boolean] {
  function before(first: es.Position, second: es.Position) {
    return first.line < second.line || (first.line === second.line && first.column <= second.column)
  }

  function cursorInLoc(nodeLoc: es.SourceLocation | null | undefined) {
    if (nodeLoc === null || nodeLoc === undefined) {
      return false
    }
    return before(nodeLoc.start, cursorLoc) && before(cursorLoc, nodeLoc.end)
  }

  for (const comment of comments) {
    if (cursorInLoc(comment.loc)) {
      // User is typing comments
      return [[], false]
    }
  }

  // BFS to get names
  const queue: es.Node[] = [prog]
  const nameQueue: es.Node[] = []

  while (queue.length > 0) {
    // Workaround due to minification problem
    // tslint:disable-next-line
    let node = queue.shift()!
    if (isFunction(node)) {
      // This is the only time we want raw identifiers
      nameQueue.push(...(node as any).params)
    }

    const body = getNodeChildren(node)
    for (const child of body) {
      if (isDeclaration(child)) {
        nameQueue.push(child)
      }

      if (cursorInLoc(child.loc)) {
        queue.push(child)
      }
    }
  }

  // Do not prompt user if he is declaring a variable
  for (const nameNode of nameQueue) {
    if (cursorInIdentifier(nameNode, n => cursorInLoc(n.loc))) {
      return [[], false]
    }
  }

  const res: any = {}
  nameQueue
    .map(node => getNames(node, n => cursorInLoc(n.loc)))
    .reduce((prev, cur) => prev.concat(cur), []) // no flatmap feelsbad
    .forEach((decl, idx) => {
      res[decl.name] = { ...decl, score: idx }
    }) // Deduplicate, ensure deeper declarations overwrite
  return [Object.values(res), true]
}

function getNodeChildren(node: es.Node): es.Node[] {
  switch (node.type) {
    case 'Program':
      return node.body
    case 'BlockStatement':
      return node.body
    case 'WhileStatement':
      return [node.test, node.body]
    case 'ForStatement':
      return [node.init, node.test, node.update, node.body].filter(
        n => n !== undefined && n !== null
      ) as es.Node[]
    case 'ExpressionStatement':
      return [node.expression]
    case 'IfStatement':
      const children = [node.test, node.consequent]
      if (node.alternate !== undefined && node.alternate !== null) {
        children.push(node.alternate)
      }
      return children
    case 'ReturnStatement':
      return node.argument ? [node.argument] : []
    case 'FunctionDeclaration':
      return [node.body]
    case 'VariableDeclaration':
      return node.declarations
        .map(getNodeChildren)
        .reduce((prev: es.Node[], cur: es.Node[]) => prev.concat(cur))
    case 'VariableDeclarator':
      return node.init ? [node.init] : []
    case 'ArrowFunctionExpression':
      return [node.body]
    case 'FunctionExpression':
      return [node.body]
    case 'UnaryExpression':
      return [node.argument]
    case 'BinaryExpression':
      return [node.left, node.right]
    case 'LogicalExpression':
      return [node.left, node.right]
    case 'ConditionalExpression':
      return [node.test, node.alternate, node.consequent]
    case 'CallExpression':
      return [...node.arguments, node.callee]
    // case 'Identifier':
    // case 'DebuggerStatement':
    // case 'BreakStatement':
    // case 'ContinueStatement':
    // case 'MemberPattern':
    case 'ArrayExpression':
      return [...node.elements]
    case 'AssignmentExpression':
      return [node.left, node.right]
    case 'MemberExpression':
      return [node.object, node.property]
    case 'Property':
      return [node.key, node.value]
    case 'ObjectExpression':
      return [...node.properties]
    case 'NewExpression':
      return [...node.arguments, node.callee]
    default:
      return []
  }
}

function cursorInIdentifier(node: es.Node, locTest: (node: es.Node) => boolean): boolean {
  switch (node.type) {
    case 'VariableDeclaration':
      for (const decl of node.declarations) {
        if (locTest(decl.id)) {
          return true
        }
      }
      return false
    case 'FunctionDeclaration':
      return node.id ? locTest(node.id) : false
    case 'Identifier':
      return locTest(node)
    default:
      return false
  }
}

// locTest is a callback that returns whether cursor is in location of node
function getNames(node: es.Node, locTest: (node: es.Node) => boolean): NameDeclaration[] {
  switch (node.type) {
    case 'VariableDeclaration':
      const delcarations: NameDeclaration[] = []
      for (const decl of node.declarations) {
        const id = decl.id
        const name = (id as es.Identifier).name
        if (
          !name ||
          isDummyName(name) ||
          (decl.init && !isFunction(decl.init) && locTest(decl.init)) // Avoid suggesting `let foo = foo`, but suggest recursion with arrow functions
        ) {
          continue
        }

        if (node.kind === KIND_CONST && decl.init && isFunction(decl.init)) {
          // constant initialized with arrow function will always be a function
          delcarations.push({ name, meta: KIND_FUNCTION })
        } else {
          delcarations.push({ name, meta: node.kind })
        }
      }
      return delcarations
    case 'FunctionDeclaration':
      return node.id && !isDummyName(node.id.name)
        ? [{ name: node.id.name, meta: KIND_FUNCTION }]
        : []
    case 'Identifier': // Function/Arrow function param
      return !isDummyName(node.name) ? [{ name: node.name, meta: KIND_PARAM }] : []
    default:
      return []
  }
}
