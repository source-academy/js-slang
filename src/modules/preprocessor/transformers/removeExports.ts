import type es from 'estree'

import { mapAndFilter } from '../../../utils/misc'

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
export default function removeExports(program: es.Program): void {
  program.body = mapAndFilter(program.body, node => {
    switch (node.type) {
      case 'ExportDefaultDeclaration':
        // 'node.declaration' can be either a Declaration or an Expression.
        // If the ExportDefaultDeclaration node contains a declaration, replace
        // it with the declaration node in its parent node's body.
        return node.declaration.type === 'FunctionDeclaration' ||
          node.declaration.type === 'ClassDeclaration'
          ? (node.declaration as es.FunctionDeclaration)
          : undefined
      case 'ExportNamedDeclaration':
        // If the ExportNamedDeclaration node contains a declaration, replace
        // it with the declaration node in its parent node's body.
        return !node.declaration ? undefined : node.declaration
      case 'ExportAllDeclaration':
        return undefined
      default:
        return node
    }
  })
}
