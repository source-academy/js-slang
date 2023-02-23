import es from 'estree'

import { ancestor } from '../../utils/walkers'
import { isFilePath } from '../filePaths'

/**
 * Returns whether a module name refers to a Source module.
 * We define a Source module name to be any string that is not
 * a file path.
 *
 * Source module import:           `import { x } from "module";`
 * Local (relative) module import: `import { x } from "./module";`
 * Local (absolute) module import: `import { x } from "/dir/dir2/module";`
 *
 * @param moduleName The name of the module.
 */
export const isSourceModule = (moduleName: string): boolean => {
  return !isFilePath(moduleName)
}

/**
 * Removes all non-Source module import-related nodes from the AST.
 *
 * All import-related nodes which are not removed in the pre-processing
 * step will be treated by the Source modules loader as a Source module.
 * If a Source module by the same name does not exist, the program
 * evaluation will error out. As such, this function removes all
 * import-related AST nodes which the Source module loader does not
 * support, as well as ImportDeclaration nodes for local module imports.
 *
 * The definition of whether a module is a local module or a Source
 * module depends on the implementation of the `isSourceModule` function.
 *
 * @param program The AST which should be stripped of non-Source module
 *                import-related nodes.
 */
export const removeNonSourceModuleImports = (program: es.Program): void => {
  // First pass: remove all import AST nodes which are unused by Source modules.
  ancestor(program, {
    ImportSpecifier(_node: es.ImportSpecifier, _state: es.Node[], _ancestors: es.Node[]): void {
      // Nothing to do here since ImportSpecifier nodes are used by Source modules.
    },
    ImportDefaultSpecifier(
      node: es.ImportDefaultSpecifier,
      _state: es.Node[],
      ancestors: es.Node[]
    ): void {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.
      const parent = ancestors[ancestors.length - 2]
      // The parent node of an ImportDefaultSpecifier node must be an ImportDeclaration node.
      if (parent.type !== 'ImportDeclaration') {
        return
      }
      const nodeIndex = parent.specifiers.findIndex(n => n === node)
      // Remove the ImportDefaultSpecifier node in its parent node's array of specifiers.
      // This is because Source modules do not support default imports.
      parent.specifiers.splice(nodeIndex, 1)
    },
    ImportNamespaceSpecifier(
      node: es.ImportNamespaceSpecifier,
      _state: es.Node[],
      ancestors: es.Node[]
    ): void {
      // The ancestors array contains the current node, meaning that the
      // parent node is the second last node of the array.
      const parent = ancestors[ancestors.length - 2]
      // The parent node of an ImportNamespaceSpecifier node must be an ImportDeclaration node.
      if (parent.type !== 'ImportDeclaration') {
        return
      }
      const nodeIndex = parent.specifiers.findIndex(n => n === node)
      // Remove the ImportNamespaceSpecifier node in its parent node's array of specifiers.
      // This is because Source modules do not support namespace imports.
      parent.specifiers.splice(nodeIndex, 1)
    }
  })

  // Operate on a copy of the Program node's body to prevent the walk from missing ImportDeclaration nodes.
  const programBody = [...program.body]
  const removeImportDeclaration = (node: es.ImportDeclaration, ancestors: es.Node[]): void => {
    // The ancestors array contains the current node, meaning that the
    // parent node is the second last node of the array.
    const parent = ancestors[ancestors.length - 2]
    // The parent node of an ImportDeclaration node must be a Program node.
    if (parent.type !== 'Program') {
      return
    }
    const nodeIndex = programBody.findIndex(n => n === node)
    // Remove the ImportDeclaration node in its parent node's body.
    programBody.splice(nodeIndex, 1)
  }
  // Second pass: remove all ImportDeclaration nodes for non-Source modules, or that do not
  // have any specifiers (thus being functionally useless).
  ancestor(program, {
    ImportDeclaration(node: es.ImportDeclaration, _state: es.Node[], ancestors: es.Node[]): void {
      if (typeof node.source.value !== 'string') {
        throw new Error('Module names must be strings.')
      }
      // ImportDeclaration nodes without any specifiers are functionally useless and are thus removed.
      if (node.specifiers.length === 0) {
        removeImportDeclaration(node, ancestors)
        return
      }
      // Non-Source modules should already have been handled in the pre-processing step and are no
      // longer needed. They must be removed to avoid being treated as Source modules.
      if (!isSourceModule(node.source.value)) {
        removeImportDeclaration(node, ancestors)
      }
    }
  })
  program.body = programBody
}
