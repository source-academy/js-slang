import { ancestor, findNodeAt, recursive, WalkerCallback } from 'acorn-walk/dist/walk'
import {
  ArrowFunctionExpression,
  BlockStatement,
  ForStatement,
  FunctionDeclaration,
  Identifier,
  Node,
  VariableDeclarator
} from 'estree'
import { Context } from './types'

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

  const found = findNodeAt(root, undefined, undefined, findByLocationPredicate)
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
        if (node.id && (node.id as Identifier).name === identifier.name) {
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
      VariableDeclarator(node: VariableDeclarator, state: any, callback: WalkerCallback<any>) {
        if ((node.id as Identifier).name === identifier.name) {
          declarations.push(node.id)
        }
      }
    })
    if (declarations.length > 0) {
      return declarations.shift()
    }
  }

  return undefined
}

function containsNode(nodeOuter: Node, nodeInner: Node) {
  const outerLoc = nodeOuter.loc
  const innerLoc = nodeInner.loc
  return (
    outerLoc &&
    innerLoc &&
    ((outerLoc.start.line < innerLoc.start.line && outerLoc.end.line >= innerLoc.end.line) ||
      (outerLoc.start.line === innerLoc.start.line &&
        outerLoc.end.line === innerLoc.end.line &&
        outerLoc.start.column <= innerLoc.start.column &&
        outerLoc.end.column >= innerLoc.end.column))
  )
}

function findAncestors(root: Node, identifier: Identifier): Node[] | undefined {
  let foundAncestors: Node[] = []
  ancestor(root, {
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
        foundAncestors.shift()
      }
    }
  })
  return foundAncestors
}
