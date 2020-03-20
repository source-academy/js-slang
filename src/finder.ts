import { ancestor, findNodeAt} from 'acorn-walk/dist/walk'
import { ArrowFunctionExpression, FunctionDeclaration, Identifier, Node, VariableDeclarator } from 'estree'
import { Context } from './types'

export function findIdentifierNode(
  root: Node,
  context: Context,
  loc: { line: number; column: number }
): Identifier | undefined {
  function findByLocationPredicate(type: string, node: Node) {
    const location = node.loc
    if (type && location) {
      return (
        type === 'Identifier' &&
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

export function findDeclarationNode(
  root: Node,
  identifier: Identifier,
): Node | undefined {
  const ancestors = findAncestors(root, identifier)
  console.log('Found Ancestors:', ancestors)

  if (!ancestors)
    return undefined

  function findDeclarationPredicate(type: string, node: Node) {
    if (type === "VariableDeclarator") {
      return ((node as VariableDeclarator).id as Identifier).name  === identifier.name
    } else if (type === "FunctionDeclaration") {
      return (
        ((node as FunctionDeclaration).id as Identifier).name  === identifier.name ||
        (node as FunctionDeclaration).params.find(
          n => (n as Identifier).name  === identifier.name
        ) !== undefined
      )
    } else if (type === "ArrowFunctionExpression") {
      return (node as ArrowFunctionExpression).params.find(
        n => (n as Identifier).name  === identifier.name) !== undefined
    }
    return false
  }

  for (const anc of ancestors) {
    const declaration = findNodeAt(anc, undefined, undefined, findDeclarationPredicate)
    if (declaration) {
      return declaration.node
    }
  }

  return undefined
}

function findAncestors(
   root: Node,
   identifier: Identifier,
 ): Node[] | undefined {
  let foundAncestors: Node[] = []
   ancestor(root, {
     Identifier: (node: Identifier, ancestors: [Node]) => {
       if (identifier.name === node.name && identifier.loc === node.loc){
         foundAncestors = Object.assign([], ancestors).reverse()
         foundAncestors.shift() // Remove the identifier node
       }
     }
   })
   return foundAncestors
 }
