import es from 'estree'

import { ancestor } from '../../utils/walkers'
import { isDeclaration } from '../typeGuards'

/**
 * Removes all export-related nodes from the AST.
 *
 * Export-related AST nodes are only needed in the local imports pre-processing
 * step to determine which functions/variables/expressions should be made
 * available to other files/modules. After which, they have no functional effect
 * on program evaluation.
 *
 * @param program The AST which should be stripped of export-related nodes.
 */
export const removeExports = (program: es.Program): void => {
  ancestor(program, {
    // TODO: Handle other export AST nodes.
    ExportNamedDeclaration(
      node: es.ExportNamedDeclaration,
      _state: es.Node[],
      ancestors: es.Node[]
    ) {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.
      const parent = ancestors[ancestors.length - 2]
      // The parent node of an ExportNamedDeclaration node must be a Program node.
      if (parent.type !== 'Program') {
        return
      }
      const nodeIndex = parent.body.findIndex(n => n === node)
      if (node.declaration) {
        // If the ExportNamedDeclaration node contains a declaration, replace
        // it with the declaration node in its parent node's body.
        parent.body[nodeIndex] = node.declaration
      } else {
        // Otherwise, remove the ExportNamedDeclaration node in its parent node's body.
        parent.body.splice(nodeIndex, 1)
      }
    },
    ExportDefaultDeclaration(
      node: es.ExportDefaultDeclaration,
      _state: es.Node[],
      ancestors: es.Node[]
    ) {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.
      const parent = ancestors[ancestors.length - 2]
      // The parent node of an ExportNamedDeclaration node must be a Program node.
      if (parent.type !== 'Program') {
        return
      }
      const nodeIndex = parent.body.findIndex(n => n === node)
      // 'node.declaration' can be either a Declaration or an Expression.
      if (isDeclaration(node.declaration)) {
        // If the ExportDefaultDeclaration node contains a declaration, replace
        // it with the declaration node in its parent node's body.
        parent.body[nodeIndex] = node.declaration
      } else {
        // Otherwise, the ExportDefaultDeclaration node contains a statement.
        // Remove the ExportDefaultDeclaration node in its parent node's body.
        parent.body.splice(nodeIndex, 1)
      }
    }
  })
}
