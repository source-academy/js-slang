import {
  ArrowFunctionExpression,
  BlockStatement,
  ForStatement,
  FunctionDeclaration,
  Identifier,
  ImportSpecifier,
  Node,
  SourceLocation,
  VariableDeclarator
} from 'estree'

import { Context } from './types'
import {
  ancestor,
  base,
  findNodeAt,
  FullWalkerCallback,
  recursive,
  WalkerCallback
} from './utils/walkers'

// Finds the innermost node that matches the given location
export function findIdentifierNode(
  root: Node,
  context: Context,
  loc: { line: number; column: number }
): Identifier | undefined {
  function findByLocationPredicate(type: string, node: Node) {
    const location = node.loc
    const nodeType = node.type
    if (nodeType && location) {
      return (
        nodeType === 'Identifier' &&
        location.start.line === loc.line &&
        location.start.column <= loc.column &&
        location.end.column >= loc.column
      )
    }
    return false
  }

  const found = findNodeAt(root, undefined, undefined, findByLocationPredicate, customWalker)
  return found?.node as Identifier
}

// Recursively searches up the ancestors of the identifier from innermost to outermost scope
export function findDeclarationNode(program: Node, identifier: Identifier): Node | undefined {
  const ancestors = findAncestors(program, identifier)
  if (!ancestors) return undefined

  const declarations: Node[] = []
  for (const root of ancestors) {
    recursive(root, undefined, {
      BlockStatement(node: BlockStatement, state: any, callback) {
        if (containsNode(node, identifier)) {
          node.body.map(n => callback(n, state))
        }
      },
      ForStatement(node: ForStatement, state: any, callback: WalkerCallback<any>) {
        if (containsNode(node, identifier)) {
          callback(node.init as any, state)
          callback(node.body, state)
        }
      },
      FunctionDeclaration(node: FunctionDeclaration, state: any, callback: WalkerCallback<any>) {
        if (node.id && node.id.name === identifier.name) {
          declarations.push(node.id)
        } else if (containsNode(node, identifier)) {
          const param = node.params.find(n => (n as Identifier).name === identifier.name)
          if (param) {
            declarations.push(param)
          } else {
            callback(node.body, state)
          }
        }
      },
      ArrowFunctionExpression(node: ArrowFunctionExpression, state: any, callback: any) {
        if (containsNode(node, identifier)) {
          const param = node.params.find(n => (n as Identifier).name === identifier.name)
          if (param) {
            declarations.push(param)
          } else {
            callback(node.body, state)
          }
        }
      },
      VariableDeclarator(node: VariableDeclarator, _state: any, _callback: WalkerCallback<any>) {
        if ((node.id as Identifier).name === identifier.name) {
          declarations.push(node.id)
        }
      },
      ImportSpecifier(node: ImportSpecifier, _state: any, _callback: WalkerCallback<any>) {
        if ((node.imported as Identifier).name === identifier.name) {
          declarations.push(node.imported)
        }
      }
    })
    if (declarations.length > 0) {
      return declarations.shift()
    }
  }

  return undefined
}

function containsNode(nodeOuter: Node, nodeInner: Node): boolean {
  const outerLoc = nodeOuter.loc
  const innerLoc = nodeInner.loc

  return (
    outerLoc != null &&
    innerLoc != null &&
    isInLoc(innerLoc.start.line, innerLoc.start.column, outerLoc) &&
    isInLoc(innerLoc.end.line, innerLoc.end.column, outerLoc)
  )
}

// This checks if a given (line, col) value is part of another node.
export function isInLoc(line: number, col: number, location: SourceLocation): boolean {
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

export function findAncestors(root: Node, identifier: Identifier): Node[] | undefined {
  let foundAncestors: Node[] = []
  ancestor(
    root,
    {
      Identifier: (node: Identifier, ancestors: [Node]) => {
        if (identifier.name === node.name && identifier.loc === node.loc) {
          foundAncestors = Object.assign([], ancestors).reverse()
          foundAncestors.shift() // Remove the identifier node
        }
      },
      /* We need a separate visitor for VariablePattern because
    acorn walk ignores Identifers on the left side of expressions.
    Here is a github issue in acorn-walk related to this:
    https://github.com/acornjs/acorn/issues/686
    */
      VariablePattern: (node: any, ancestors: [Node]) => {
        if (identifier.name === node.name && identifier.loc === node.loc) {
          foundAncestors = Object.assign([], ancestors).reverse()
        }
      }
    },
    customWalker
  )
  return foundAncestors
}

const customWalker = {
  ...base,
  ImportSpecifier(node: ImportSpecifier, st: never, c: FullWalkerCallback<never>) {
    c(node.imported, st, 'Expression')
  }
}
