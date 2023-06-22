import type * as es from 'estree'

import type { Context } from '../'
import { UNKNOWN_LOCATION } from '../constants'
import { findAncestors, findIdentifierNode } from '../finder'
import { ModuleConnectionError, ModuleNotFoundError } from '../modules/errors'
import { memoizedGetModuleDocsAsync } from '../modules/moduleLoaderAsync'
import syntaxBlacklist from '../parser/source/syntax'
import {
  isDeclaration,
  isFunctionNode,
  isImportDeclaration,
  isLoop,
  isSourceImport
} from '../utils/ast/typeGuards'

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
    if (ancestors.some(node => isFunctionNode(node))) {
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
export async function getProgramNames(
  prog: es.Node,
  comments: acorn.Comment[],
  cursorLoc: es.Position
): Promise<[NameDeclaration[], boolean]> {
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
    if (isFunctionNode(node)) {
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

  const names = await Promise.all(nameQueue.map(node => getNames(node, n => cursorInLoc(n.loc))))
  const res = names.flat().reduce(
    (prev, each, idx) => ({
      ...prev,
      [each.name]: { ...each, score: idx } // Deduplicate, ensure deeper declarations overwrite
    }),
    {} as Record<string, NameDeclaration>
  )

  // const res: any = {}
  // nameQueue
  //   .map(node => getNames(node, n => cursorInLoc(n.loc)))
  //   .reduce((prev, cur) => prev.concat(cur), []) // no flatmap feelsbad
  //   .forEach((decl, idx) => {
  //     res[decl.name] = { ...decl, score: idx }
  //   })
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
async function getNames(
  node: es.Node,
  locTest: (node: es.Node) => boolean
): Promise<NameDeclaration[]> {
  const createDocHtml = (header: string, desc: string) =>
    `<div><h4>${header}</h4><div class="description">${desc}</div></div>`

  switch (node.type) {
    case 'ImportDeclaration':
      const source = node.source.value as string
      if (!isSourceImport(source)) {
        return node.specifiers.map(({ local: { name } }) => ({
          name,
          meta: KIND_IMPORT,
          docHTML: createDocHtml(
            `Imported symbol ${name} from ${source}`,
            `No documentation available for <code>${name}</code> from <code>${source}</code>`
          )
        }))
      }

      const specs = node.specifiers.filter(x => !isDummyName(x.local.name))

      try {
        const docs = await memoizedGetModuleDocsAsync(source)

        if (!docs) {
          return specs.map(({ local: { name } }) => ({
            name,
            meta: KIND_IMPORT,
            docHTML: `Unable to retrieve documentation for <code>${name}</code> from ${source} module`
          }))
        }

        return specs.map(spec => {
          const localName = spec.local.name

          if (docs[spec.local.name] === undefined) {
            return {
              name: spec.local.name,
              meta: KIND_IMPORT,
              docHTML: `No documentation available for <code>${localName}</code> from ${source} module`
            }
          }

          switch (spec.type) {
            case 'ImportSpecifier':
              return {
                name: localName,
                meta: KIND_IMPORT,
                docHTML: docs[spec.imported.name]
              }
            case 'ImportDefaultSpecifier':
              return {
                name: localName,
                meta: KIND_IMPORT,
                docHTML: docs['default']
              }
            case 'ImportNamespaceSpecifier':
              return {
                name: localName,
                meta: KIND_IMPORT,
                docHTML: `${source} module namespace import`
              }
          }
        })
      } catch (err) {
        if (!(err instanceof ModuleNotFoundError || err instanceof ModuleConnectionError)) throw err

        return specs.map(({ local: { name } }) => ({
          name,
          meta: KIND_IMPORT,
          docHTML: `Unable to retrieve documentation for <code>${name}</code> from ${source} module`
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
          (decl.init && !isFunctionNode(decl.init) && locTest(decl.init)) // Avoid suggesting `let foo = foo`, but suggest recursion with arrow functions
        ) {
          continue
        }

        if (node.kind === KIND_CONST && decl.init && isFunctionNode(decl.init)) {
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
