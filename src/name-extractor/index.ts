import acorn from 'acorn'
import type es from 'estree'

import type { Context } from '../'
import { UNKNOWN_LOCATION } from '../constants'
import { findAncestors, findIdentifierNode } from '../finder'
import { ModuleConnectionError, ModuleNotFoundError } from '../modules/errors'
import { memoizedGetModuleDocsAsync } from '../modules/loader/moduleLoaderAsync'
import type { ModuleDocsEntry } from '../modules/moduleTypes'
import { isSourceModule } from '../modules/utils'
import syntaxBlacklist from '../parser/source/syntax'
import { getImportedName, getModuleDeclarationSource } from '../utils/ast/helpers'
import { isDeclaration, isImportDeclaration } from '../utils/ast/typeGuards'

export enum DeclarationKind {
  KIND_IMPORT = 'import',
  KIND_FUNCTION = 'func',
  KIND_LET = 'let',
  KIND_PARAM = 'param',
  KIND_CONST = 'const',
  KIND_KEYWORD = 'keyword'
}

export interface NameDeclaration {
  name: string
  meta: DeclarationKind
  score?: number
}

type FunctionType = es.FunctionDeclaration | es.ArrowFunctionExpression | es.FunctionExpression
function isFunction(node: es.Node): node is FunctionType {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  )
}

type LoopNode = es.WhileStatement | es.ForStatement
function isLoop(node: es.Node): node is LoopNode {
  return node.type === 'WhileStatement' || node.type === 'ForStatement'
}

// Update this to use exported check from "acorn-loose" package when it is released
function isDummyName(name: string): boolean {
  return name === '✖'
}

const KEYWORD_SCORE = 20000

// Ensure that keywords are prioritized over names
const keywordsInBlock: { [key: string]: NameDeclaration[] } = {
  FunctionDeclaration: [
    { name: 'function', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE }
  ],
  VariableDeclaration: [
    { name: 'const', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE }
  ],
  AssignmentExpression: [{ name: 'let', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE }],
  WhileStatement: [{ name: 'while', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE }],
  IfStatement: [
    { name: 'if', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE },
    { name: 'else', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE }
  ],
  ForStatement: [{ name: 'for', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE }]
}

const keywordsInLoop: { [key: string]: NameDeclaration[] } = {
  BreakStatement: [{ name: 'break', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE }],
  ContinueStatement: [
    { name: 'continue', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE }
  ]
}

const keywordsInFunction: { [key: string]: NameDeclaration[] } = {
  ReturnStatement: [{ name: 'return', meta: DeclarationKind.KIND_KEYWORD, score: KEYWORD_SCORE }]
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
  if (ancestors[0].type === 'ForStatement' && identifier === ancestors[0].init) {
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
    if (isFunction(node)) {
      // This is the only time we want raw identifiers
      nameQueue.push(...node.params)
    }

    const body = getNodeChildren(node)
    for (const child of body) {
      if (isImportDeclaration(child as any)) {
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

  // This implementation is order dependent, so we can't
  // use something like Promise.all
  const res: Record<string, NameDeclaration> = {}
  let idx = 0
  for (const node of nameQueue) {
    const names = await getNames(node, n => cursorInLoc(n.loc))
    names.forEach(decl => {
      // Deduplicate, ensure deeper declarations overwrite
      res[decl.name] = { ...decl, score: idx }
      idx++
    })
  }

  return [Object.values(res), true]
}

function isNotNull<T>(x: T): x is Exclude<T, null> {
  // This function exists to appease the mighty typescript type checker
  return x !== null
}

function isNotNullOrUndefined<T>(x: T): x is Exclude<T, null | undefined> {
  // This function also exists to appease the mighty typescript type checker
  return x !== undefined && isNotNull(x)
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
        isNotNullOrUndefined
        // n => n !== undefined && n !== null
      )
    case 'ExpressionStatement':
      return [node.expression]
    case 'IfStatement':
      const children = [node.test, node.consequent]
      if (isNotNullOrUndefined(node.alternate)) {
        children.push(node.alternate)
      }
      return children
    case 'ReturnStatement':
      return node.argument ? [node.argument] : []
    case 'FunctionDeclaration':
      return [node.body]
    case 'VariableDeclaration':
      return node.declarations.flatMap(getNodeChildren)
    // .map(getNodeChildren)
    // .reduce((prev: es.Node[], cur: es.Node[]) => prev.concat(cur))
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

function docsToHtml(obj: ModuleDocsEntry): string {
  if (obj.kind === 'function') {
    const params = Object.entries(obj.params)
    let paramStr: string

    if (params.length === 0) {
      paramStr = '()'
    } else {
      paramStr = `(${params.map(([name, type]) => `${name}: ${type}`).join(', ')})`
    }

    const header = `${obj.name}${paramStr} → {${obj.retType}}`
    return `<div><h4>${header}</h4><div class="description">${obj.description}</div></div>`
  }


  return `<div><h4>${obj.name}: ${obj.type}</h4><div class="description">${obj.description}</div></div>`
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
  switch (node.type) {
    case 'ImportDeclaration':
      const specs = node.specifiers.filter(x => !isDummyName(x.local.name))
      const moduleName = getModuleDeclarationSource(node)

      // Don't try to load documentation for local modules
      if (!isSourceModule(moduleName)) return []

      try {
        const docs = await memoizedGetModuleDocsAsync(moduleName)

        if (!docs) {
          return specs.map(spec => ({
            name: spec.local.name,
            meta: DeclarationKind.KIND_IMPORT,
            docHTML: `Unable to retrieve documentation for <code>${spec.local.name}</code> from ${moduleName} module`
          }))
        }

        return specs.map(spec => {
          if (spec.type === 'ImportNamespaceSpecifier') {
            return {
              name: moduleName,
              meta: DeclarationKind.KIND_IMPORT,
              docHTML: `Namespace import ${moduleName}`
            }
          }

          const importedName = getImportedName(spec)

          if (docs[importedName] === undefined) {
            return {
              name: importedName,
              meta: DeclarationKind.KIND_IMPORT,
              docHTML: `No documentation available for <code>${spec.local.name}</code> from ${moduleName} module`
            }
          } else {
            return {
              name: importedName,
              meta: DeclarationKind.KIND_IMPORT,
              docHTML: docsToHtml(docs[importedName])
            }
          }
        })
      } catch (err) {
        if (!(err instanceof ModuleNotFoundError || err instanceof ModuleConnectionError)) throw err

        return specs.map(spec => ({
          name: spec.local.name,
          meta: DeclarationKind.KIND_IMPORT,
          docHTML: `Unable to retrieve documentation for <code>${spec.local.name}</code> from ${moduleName} module`
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

        if (node.kind === DeclarationKind.KIND_CONST && decl.init && isFunction(decl.init)) {
          // constant initialized with arrow function will always be a function
          declarations.push({ name, meta: DeclarationKind.KIND_FUNCTION })
        } else {
          declarations.push({ name, meta: node.kind as DeclarationKind })
        }
      }
      return declarations
    case 'FunctionDeclaration':
      return node.id && !isDummyName(node.id.name)
        ? [{ name: node.id.name, meta: DeclarationKind.KIND_FUNCTION }]
        : []
    case 'Identifier': // Function/Arrow function param
      return !isDummyName(node.name) ? [{ name: node.name, meta: DeclarationKind.KIND_PARAM }] : []
    default:
      return []
  }
}
