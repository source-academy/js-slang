import acorn from 'acorn'
import * as es from 'estree'

import { Context } from '../'
import { UNKNOWN_LOCATION } from '../constants'
import { ModuleConnectionError, ModuleNotFoundError } from '../errors/moduleErrors'
import { findAncestors, findIdentifierNode } from '../finder'
import { memoizedloadModuleDocs } from '../modules/moduleLoader'
import syntaxBlacklist from '../parser/source/syntax'

export interface NameDeclaration {
  name: string
  meta: string
  score?: number
}

const KIND_IMPORT = 'import'
const KIND_FUNCTION = 'func'
// const KIND_LET = 'let'
const KIND_PARAM = 'param'
const KIND_CONST = 'const'

function isImportDeclaration(node: es.Node): boolean {
  return node.type === 'ImportDeclaration'
}

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

function isLoop(node: es.Node): boolean {
  return node.type === 'WhileStatement' || node.type === 'ForStatement'
}

// Update this to use exported check from "acorn-loose" package when it is released
function isDummyName(name: string): boolean {
  return name === '✖'
}

const KEYWORD_SCORE = 20000

// Ensure that keywords are prioritized over names
const keywordsInBlock: { [key: string]: NameDeclaration[] } = {
  FunctionDeclaration: [{ name: 'function', meta: 'keyword', score: KEYWORD_SCORE }],
  VariableDeclaration: [{ name: 'const', meta: 'keyword', score: KEYWORD_SCORE }],
  AssignmentExpression: [{ name: 'let', meta: 'keyword', score: KEYWORD_SCORE }],
  WhileStatement: [{ name: 'while', meta: 'keyword', score: KEYWORD_SCORE }],
  IfStatement: [
    { name: 'if', meta: 'keyword', score: KEYWORD_SCORE },
    { name: 'else', meta: 'keyword', score: KEYWORD_SCORE }
  ],
  ForStatement: [{ name: 'for', meta: 'keyword', score: KEYWORD_SCORE }]
}

const keywordsInLoop: { [key: string]: NameDeclaration[] } = {
  BreakStatement: [{ name: 'break', meta: 'keyword', score: KEYWORD_SCORE }],
  ContinueStatement: [{ name: 'continue', meta: 'keyword', score: KEYWORD_SCORE }]
}

const keywordsInFunction: { [key: string]: NameDeclaration[] } = {
  ReturnStatement: [{ name: 'return', meta: 'keyword', score: KEYWORD_SCORE }]
}

/**
 * Retrieves keyword suggestions based on what node the cursor is currently over.
 * For example, only suggest `let` when the cursor is over the init part of a for
 * statement
 * @param prog Program to parse
 * @param cursorLoc Current location of the cursor
 * @param context Evaluation context
 * @returns A list of keywords as suggestions
 */
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
      ? keywordsInBlock.AssignmentExpression
      : []
  }

  const keywordSuggestions: NameDeclaration[] = []
  function addAllowedKeywords(keywords: { [key: string]: NameDeclaration[] }) {
    Object.entries(keywords)
      .filter(([nodeType]) => context.chapter >= syntaxBlacklist[nodeType])
      .forEach(([_nodeType, decl]) => keywordSuggestions.push(...decl))
  }

  // The rest of the keywords are only valid at the beginning of a statement
  if (
    ancestors[0].type === 'ExpressionStatement' &&
    (ancestors[0].loc ?? UNKNOWN_LOCATION).start === (identifier.loc ?? UNKNOWN_LOCATION).start
  ) {
    addAllowedKeywords(keywordsInBlock)
    // Keywords only allowed in functions
    if (ancestors.some(node => isFunction(node))) {
      addAllowedKeywords(keywordsInFunction)
    }

    // Keywords only allowed in loops
    if (ancestors.some(node => isLoop(node))) {
      addAllowedKeywords(keywordsInLoop)
    }
  }

  return keywordSuggestions
}

/**
 * Retrieve the list of names present within the program. If the cursor is within a comment,
 * or when the user is declaring a variable or function arguments, suggestions should not be displayed,
 * indicated by the second part of the return value of this function.
 * @param prog Program to parse for names
 * @param comments Comments found within the program
 * @param cursorLoc Current location of the cursor
 * @returns Tuple consisting of the list of suggestions, and a boolean value indicating if
 * suggestions should be displayed, i.e. `[suggestions, shouldPrompt]`
 */
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
    const node = queue.shift()!
    if (isFunction(node)) {
      // This is the only time we want raw identifiers
      nameQueue.push(...(node as any).params)
    }

    const body = getNodeChildren(node)
    for (const child of body) {
      if (isImportDeclaration(child)) {
        nameQueue.push(child)
      }

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

function isNotNull<T>(x: T): x is Exclude<T, null> {
  // This function exists to appease the mighty typescript type checker
  return x !== null
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
      return node.elements.filter(isNotNull)
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
/**
 * Gets a list of `NameDeclarations` from the given node
 * @param node Node to search for names
 * @param locTest Callback of type `(node: es.Node) => boolean`. Should return true if the cursor
 * is located within the node, false otherwise
 * @returns List of found names
 */
function getNames(node: es.Node, locTest: (node: es.Node) => boolean): NameDeclaration[] {
  switch (node.type) {
    case 'ImportDeclaration':
      const specs = node.specifiers.filter(x => !isDummyName(x.local.name))

      try {
        const docs = memoizedloadModuleDocs(node.source.value as string, node)

        if (!docs) {
          return specs.map(spec => ({
            name: spec.local.name,
            meta: KIND_IMPORT,
            docHTML: `Unable to retrieve documentation for <code>${spec.local.name}</code> from ${node.source.value} module`
          }))
        }

        return specs.map(spec => {
          if (spec.type !== 'ImportSpecifier' || docs[spec.local.name] === undefined) {
            return {
              name: spec.local.name,
              meta: KIND_IMPORT,
              docHTML: `No documentation available for <code>${spec.local.name}</code> from ${node.source.value} module`
            }
          } else {
            return {
              name: spec.local.name,
              meta: KIND_IMPORT,
              docHTML: docs[spec.local.name]
            }
          }
        })
      } catch (err) {
        if (!(err instanceof ModuleNotFoundError || err instanceof ModuleConnectionError)) throw err

        return specs.map(spec => ({
          name: spec.local.name,
          meta: KIND_IMPORT,
          docHTML: `Unable to retrieve documentation for <code>${spec.local.name}</code> from ${node.source.value} module`
        }))
      }
    case 'VariableDeclaration':
      const declarations: NameDeclaration[] = []
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
          declarations.push({ name, meta: KIND_FUNCTION })
        } else {
          declarations.push({ name, meta: node.kind })
        }
      }
      return declarations
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
