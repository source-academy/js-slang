import { simple } from '../walkers'
import type { Node, NodeTypeToNode } from '../../types'

const locationKeys = ['loc', 'start', 'end']

// Certain properties on each type of node are only present sometimes
// For our purposes, those properties aren't important, so we can
// remove them from the corresponding node
const propertiesToDelete: {
  [K in Node['type']]?: (keyof NodeTypeToNode<K>)[]
} = {
  CallExpression: ['optional'],
  // Honestly not sure where the 'expression' property comes from
  FunctionDeclaration: ['expression' as any, 'generator'],
  Literal: ['raw']
}

const sanitizers = Object.entries(propertiesToDelete).reduce(
  (res, [nodeType, props]) => ({
    ...res,
    [nodeType](node: Node) {
      for (const prop of props) {
        delete node[prop]
      }
    }
  }),
  {}
)

/**
 * Strips out extra properties from an AST and converts Nodes to regular
 * javascript objects
 *
 * The local imports test suites only care about the structure of the
 * transformed AST. The line & column numbers, as well as the character
 * offsets of each node in the ASTs derived from parsing the pre-transform
 * code & the equivalent post-transform code will not be the same.
 * Note that it is insufficient to pass in 'locations: false' into the acorn
 * parser as there will still be 'start' & 'end' properties attached to nodes
 * which represent character offsets.
 *
 * @param node The AST which should be stripped of extra properties
 */
export function sanitizeAST(node: Node) {
  const convertNode = (obj: Node): Node => {
    return Object.entries(obj).reduce((res, [key, value]) => {
      // Filter out location related properties and don't
      // return them with the created object
      if (locationKeys.includes(key)) return res

      if (Array.isArray(value)) {
        return {
          ...res,
          [key]: value.map(convertNode)
        }
      }
      if (typeof value === 'object' && value !== null) {
        return {
          ...res,
          [key]: convertNode(value)
        }
      }

      return {
        ...res,
        [key]: value
      }
    }, {} as Node)
  }

  simple(node, sanitizers)

  return convertNode(node)
}
