import { ancestor, findNodeAt, simple } from 'acorn-walk/dist/walk'
import {
  ArrowFunctionExpression,
  FunctionDeclaration,
  Identifier,
  Node,
  VariableDeclarator
} from 'estree'
import { Context } from './types'

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

export function findDeclarationNode(program: Node, identifier: Identifier): Node | undefined {
  const ancestors = findAncestors(program, identifier)
  if (!ancestors) return undefined

  const declarations: Node[] = []
  for (const root of ancestors) {
    simple(root, {
      VariableDeclarator(node: VariableDeclarator) {
        if ((node.id as Identifier).name === identifier.name) {
          declarations.push(node.id)
        }
      },
      FunctionDeclaration(node: FunctionDeclaration) {
        if (node.id && (node.id as Identifier).name === identifier.name) {
          declarations.push(node.id)
        } else {
          const param = node.params.find(n => (n as Identifier).name === identifier.name)
          if (param) {
            declarations.push(param)
          }
        }
      },
      ArrowFunctionExpression(node: ArrowFunctionExpression) {
        const param = node.params.find(n => (n as Identifier).name === identifier.name)
        if (param) {
          declarations.push(param)
        }
      }
    })
    if (declarations.length > 0) {
      return declarations.shift()
    }
  }

  return undefined
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
    VariablePattern: (node: any, ancestors: [Node]) => {
      if (identifier.name === node.name && identifier.loc === node.loc) {
        foundAncestors = Object.assign([], ancestors).reverse()
        foundAncestors.shift()
      }
    }
  })
  return foundAncestors
}
