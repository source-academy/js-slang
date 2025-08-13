import acorn from 'acorn'
import type es from 'estree'
import { partition } from 'lodash'
import type { Context } from '../'
import { UNKNOWN_LOCATION } from '../constants'
import { findAncestors, findIdentifierNode } from '../finder'
import { memoizedGetModuleDocsAsync, memoizedGetModuleManifestAsync } from '../modules/loader'
import type { ModuleDocsEntry } from '../modules/moduleTypes'
import { isSourceModule } from '../modules/utils'
import syntaxBlacklist from '../parser/source/syntax'
import type { Node } from '../types'
import { getImportedName, getModuleDeclarationSource } from '../utils/ast/helpers'
import { isDeclaration, isImportDeclaration, isNamespaceSpecifier } from '../utils/ast/typeGuards'

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
function isFunction(node: Node): node is FunctionType {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  )
}

type LoopNode = es.WhileStatement | es.ForStatement
function isLoop(node: Node): node is LoopNode {
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
  prog: Node,
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
  prog: Node,
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
  const queue: Node[] = [prog]
  const nameQueue: Node[] = []

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

function getNodeChildren(node: Node): es.Node[] {
  switch (node.type) {
    case 'Program':
      return node.body
    case 'BlockStatement':
      return node.body
    case 'WhileStatement':
      return [node.test, node.body]
    case 'ForStatement':
      return [node.init, node.test, node.update, node.body].filter(isNotNullOrUndefined)
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

function cursorInIdentifier(node: Node, locTest: (node: Node) => boolean): boolean {
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

function docsToHtml(
  spec: es.ImportSpecifier | es.ImportDefaultSpecifier,
  obj: ModuleDocsEntry
): string {
  const importedName = getImportedName(spec)
  const nameStr = importedName === spec.local.name ? '' : `Imported as ${spec.local.name}\n`

  switch (obj.kind) {
    case 'function': {
      let paramStr: string

      if (obj.params.length === 0) {
        paramStr = '()'
      } else {
        paramStr = `(${obj.params.map(([name, type]) => `${name}: ${type}`).join(', ')})`
      }

      const header = `${importedName}${paramStr} → {${obj.retType}}`
      return `<div><h4>${header}</h4><div class="description">${nameStr}${obj.description}</div></div>`
    }
    case 'variable':
      return `<div><h4>${importedName}: ${obj.type}</h4><div class="description">${nameStr}${obj.description}</div></div>`
    case 'unknown':
      return `<div><h4>${importedName}: unknown</h4><div class="description">${nameStr}No description available</div></div>`
  }
}

// locTest is a callback that returns whether cursor is in location of node
/**
 * Gets a list of `NameDeclarations` from the given node
 * @param node Node to search for names
 * @param locTest Callback of type `(node: Node) => boolean`. Should return true if the cursor
 * is located within the node, false otherwise
 * @returns List of found names
 */
async function getNames(node: Node, locTest: (node: Node) => boolean): Promise<NameDeclaration[]> {
  switch (node.type) {
    case 'ImportDeclaration':
      const specs = node.specifiers.filter(x => !isDummyName(x.local.name))
      const moduleName = getModuleDeclarationSource(node)

      // Don't try to load documentation for local modules
      if (!isSourceModule(moduleName)) {
        return specs.map(spec => {
          if (spec.type === 'ImportNamespaceSpecifier') {
            return {
              name: spec.local.name,
              meta: DeclarationKind.KIND_IMPORT,
              docHTML: `Namespace import of '${moduleName}'`
            }
          }

          return {
            name: spec.local.name,
            meta: DeclarationKind.KIND_IMPORT,
            docHTML: `Import '${getImportedName(spec)}' from '${moduleName}'`
          }
        })
      }

      try {
        const [namespaceSpecs, otherSpecs] = partition(specs, isNamespaceSpecifier)
        const manifest = await memoizedGetModuleManifestAsync()

        if (!(moduleName in manifest)) {
          // Unknown module
          const namespaceDecls = namespaceSpecs.map(spec => ({
            name: spec.local.name,
            meta: DeclarationKind.KIND_IMPORT,
            docHTML: `Namespace import of unknown module '${moduleName}'`
          }))

          const otherDecls = (otherSpecs as (es.ImportSpecifier | es.ImportDefaultSpecifier)[]).map(
            spec => ({
              name: spec.local.name,
              meta: DeclarationKind.KIND_IMPORT,
              docHTML: `Import from unknown module '${moduleName}'`
            })
          )
          return namespaceDecls.concat(otherDecls)
        }

        const namespaceDecls = namespaceSpecs.map(spec => ({
          name: spec.local.name,
          meta: DeclarationKind.KIND_IMPORT,
          docHTML: `Namespace import of '${moduleName}'`
        }))

        // If there are only namespace specifiers, then don't bother
        // loading the documentation
        if (otherSpecs.length === 0) return namespaceDecls

        const docs = await memoizedGetModuleDocsAsync(moduleName, true)
        return namespaceDecls.concat(
          (otherSpecs as (es.ImportSpecifier | es.ImportDefaultSpecifier)[]).map(spec => {
            const importedName = getImportedName(spec)

            if (docs[importedName] === undefined) {
              return {
                name: spec.local.name,
                meta: DeclarationKind.KIND_IMPORT,
                docHTML: `No documentation available for <code>${importedName}</code> from '${moduleName}'`
              }
            } else {
              return {
                name: spec.local.name,
                meta: DeclarationKind.KIND_IMPORT,
                docHTML: docsToHtml(spec, docs[importedName])
              }
            }
          })
        )
      } catch (err) {
        // Failed to load docs for whatever reason
        return specs.map(spec => ({
          name: spec.local.name,
          meta: DeclarationKind.KIND_IMPORT,
          docHTML: `Unable to retrieve documentation for '${moduleName}'`
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
